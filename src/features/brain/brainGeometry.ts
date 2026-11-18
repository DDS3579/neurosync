/**
 * Deterministic particle-brain geometry wrapper.
 *
 * - generateBrainPoints(): synchronous procedural brain (cached).
 * - generateBrainPointsNonBlocking(): Web Worker + Transferable Float32Array buffers
 *   with time-sliced async fallback so loader animations hold 60fps.
 * - sampleBrainFromObject(): samples a loaded GLB with MeshSurfaceSampler.
 */
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

import {
  BRAIN_MIX,
  BRAIN_SEED,
  HEMI,
  KIND_DEEP,
  KIND_SURFACE,
  KIND_VOLUME,
  createNoise3D,
  createPointWriter,
  createProceduralContext,
  emitAmygdalaPoint,
  emitCortexPoint,
  emitHippocampusPoint,
  generateProceduralBrainPoints,
  generateProceduralBrainPointsAsync,
  mulberry32,
  sulci,
  type BrainPointData,
} from "./proceduralBrainCore";
import type { GeometryWorkerMessage } from "./brainGeometry.worker";
import {
  INTERNAL_REGIONS,
  classifyPoint,
  matchRegionName,
  regionIndex,
} from "./regionZones";

export {
  BRAIN_SEED,
  KIND_DEEP,
  KIND_SURFACE,
  KIND_VOLUME,
  mulberry32,
  type BrainPointData,
};

const cache = new Map<string, BrainPointData>();

/** Procedural brain. Fully deterministic for a given `(count, seed)`. Cached. */
export function generateBrainPoints(count: number, seed: number = BRAIN_SEED): BrainPointData {
  const key = `${count}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = generateProceduralBrainPoints(count, seed);
  cache.set(key, data);
  return data;
}

export interface NonBlockingGeometryOptions {
  seed?: number;
  onProgress?: (placed: number, total: number) => void;
  signal?: { cancelled: boolean };
}

/**
 * Generates procedural geometry off the main thread in a Web Worker using
 * Transferable ArrayBuffers, falling back seamlessly to a time-sliced
 * async loop if Workers are unavailable or blocked.
 */
export async function generateBrainPointsNonBlocking(
  count: number,
  options: NonBlockingGeometryOptions = {},
): Promise<BrainPointData> {
  const { seed = BRAIN_SEED, onProgress, signal } = options;
  const key = `${count}:${seed}`;
  const hit = cache.get(key);
  if (hit) {
    onProgress?.(count, count);
    return hit;
  }

  if (typeof Worker !== "undefined") {
    try {
      const data = await new Promise<BrainPointData>((resolve, reject) => {
        let settled = false;
        const worker = new Worker(new URL("./brainGeometry.worker.ts", import.meta.url));
        const cleanup = () => {
          worker.onmessage = null;
          worker.onerror = null;
          worker.terminate();
        };

        worker.onmessage = (event: MessageEvent<GeometryWorkerMessage>) => {
          if (signal?.cancelled) {
            settled = true;
            cleanup();
            return;
          }
          const msg = event.data;
          if (msg.type === "progress") {
            onProgress?.(msg.placed, msg.total);
            return;
          }
          if (msg.type === "done") {
            settled = true;
            cleanup();
            resolve({
              count: msg.count,
              positions: new Float32Array(msg.positions),
              normals: new Float32Array(msg.normals),
              regions: new Float32Array(msg.regions),
              seeds: new Float32Array(msg.seeds),
              kinds: new Float32Array(msg.kinds),
              folds: new Float32Array(msg.folds),
              scatter: new Float32Array(msg.scatter),
            });
          }
        };

        worker.onerror = (err) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(err instanceof Error ? err : new Error("Geometry worker failed"));
          }
        };

        worker.postMessage({ count, seed });
      });

      if (!signal?.cancelled) {
        cache.set(key, data);
      }
      return data;
    } catch {
      // Fall through to time-sliced main-thread generation.
    }
  }

  const data = await generateProceduralBrainPointsAsync(count, seed, {
    chunkSize: 6000,
    yieldBetweenChunks: true,
    onProgress,
    signal,
  });
  if (!signal?.cancelled) {
    cache.set(key, data);
  }
  return data;
}

/**
 * Sample a loaded GLB scene. The model is centred and scaled so its longest axis spans [-1, 1];
 * it must already follow the contract orientation (+z anterior, +y up).
 * Meshes named after a RegionId provide region assignment; everything else uses spatial zones.
 */
export function sampleBrainFromObject(
  root: THREE.Object3D,
  count: number,
  seed: number = BRAIN_SEED,
): BrainPointData {
  const rand = mulberry32(seed);
  const noise = createNoise3D(mulberry32(seed ^ 0x9e3779b9));
  const w = createPointWriter(count, rand);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z, 1e-6);

  interface Part {
    sampler: MeshSurfaceSampler;
    geo: THREE.BufferGeometry;
    region: number | null;
    weight: number;
  }
  const parts: Part[] = [];
  let hasDeep = false;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geo = (obj.geometry as THREE.BufferGeometry).clone();
    geo.applyMatrix4(obj.matrixWorld);
    geo.translate(-center.x, -center.y, -center.z);
    geo.scale(scale, scale, scale);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    let named: ReturnType<typeof matchRegionName> = null;
    for (let o: THREE.Object3D | null = obj; o && !named; o = o.parent) {
      named = matchRegionName(o.name);
    }
    if (named && INTERNAL_REGIONS.has(named)) hasDeep = true;
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)) as MeshSurfaceSampler & {
      setRandomGenerator?: (fn: () => number) => MeshSurfaceSampler;
    };
    sampler.setRandomGenerator?.(rand);
    sampler.build();
    const dist = sampler.distribution;
    const area = dist && dist.length > 0 ? dist[dist.length - 1] : 0;
    // Internal structures are tiny; boost them so they read as bright clusters.
    const weight = area * (named && INTERNAL_REGIONS.has(named) ? 6 : 1);
    if (weight > 0) parts.push({ sampler, geo, region: named ? regionIndex(named) : null, weight });
    else geo.dispose();
  });

  const deepBudget = hasDeep ? 0 : Math.round(count * (BRAIN_MIX.hippocampus + BRAIN_MIX.amygdala));
  const volumeBudget = Math.round(count * BRAIN_MIX.volume);
  const surfaceBudget = count - deepBudget - volumeBudget;
  const total = parts.reduce((s, p) => s + p.weight, 0);
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const surface: number[] = [];

  if (total > 0) {
    let written = 0;
    parts.forEach((part, idx) => {
      const n =
        idx === parts.length - 1
          ? surfaceBudget - written
          : Math.round((surfaceBudget * part.weight) / total);
      for (let i = 0; i < n; i++) {
        part.sampler.sample(pos, nrm);
        const region = part.region ?? classifyPoint(pos.x, pos.y, pos.z);
        const deep =
          region === regionIndex("hippocampus") || region === regionIndex("amygdala");
        const fold = 0.45 + 0.55 * (1 - sulci(noise, pos.x, pos.y, pos.z));
        w.push(pos.x, pos.y, pos.z, nrm, region, deep ? KIND_DEEP : KIND_SURFACE, fold);
        if (!deep && surface.length < 30000) surface.push(pos.x, pos.y, pos.z);
      }
      written += n;
    });
  }
  parts.forEach((p) => p.geo.dispose());

  const ctx = createProceduralContext(count, seed);
  ctx.rand = rand;
  ctx.noise = noise;
  ctx.w = w;

  for (let i = 0; i < volumeBudget && surface.length > 0; i++) {
    const j = Math.floor(rand() * (surface.length / 3)) * 3;
    const k = 0.35 + 0.5 * rand();
    const sx = surface[j];
    const cx = Math.sign(sx) * HEMI.centerX;
    const x = cx + (sx - cx) * k;
    const y = surface[j + 1] * k;
    const z = surface[j + 2] * k;
    const region = classifyPoint(x, y, z, true);
    const deep = region === regionIndex("hippocampus") || region === regionIndex("amygdala");
    nrm.set(x, y, z).normalize();
    w.push(x, y, z, nrm, region, deep ? KIND_DEEP : KIND_VOLUME, 0.5);
  }
  const hippoBudget = Math.round(deepBudget * 0.62);
  for (let i = 0; i < hippoBudget; i++) emitHippocampusPoint(ctx);
  for (let i = 0; i < deepBudget - hippoBudget; i++) emitAmygdalaPoint(ctx);
  while (w.size() < count) emitCortexPoint(ctx); // safety top-up (e.g. GLB without meshes)
  return w.data;
}
