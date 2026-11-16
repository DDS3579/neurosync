/**
 * Deterministic particle-brain geometry.
 *
 * - generateBrainPoints(): procedural brain (hemispheres + gyri/sulci + temporal bulge +
 *   Sylvian fissure + striated cerebellum + brainstem + inner structures).
 * - sampleBrainFromObject(): samples a loaded GLB with MeshSurfaceSampler.
 *
 * Both return the same BrainPointData layout consumed by the points shader.
 */
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

import {
  AMYGDALA,
  HIPPOCAMPUS,
  INTERNAL_REGIONS,
  UNASSIGNED_INDEX,
  classifyPoint,
  hippocampusPath,
  matchRegionName,
  regionIndex,
  temporalTopY,
  type Vec3,
} from "./regionZones";

/* ------------------------------------------------------------------ */
/* TUNABLES                                                            */
/* ------------------------------------------------------------------ */
export const BRAIN_SEED = 1337;

/** Share of the point budget per structure (remainder goes to cortex). */
const MIX = { cerebellum: 0.12, stem: 0.025, volume: 0.06, hippocampus: 0.035, amygdala: 0.02 } as const;

/** Hemisphere ellipsoid (piecewise radii, so each half can be shaped independently). */
const HEMI = {
  centerX: 0.33,
  centerY: 0.06,
  rxLateral: 0.45,
  rxMedial: 0.28, // medial wall sits ~0.05 from the midline -> longitudinal fissure
  ryTop: 0.62,
  ryBottom: 0.36,
  rzFront: 0.93,
  rzBack: 1.0,
  frontTaper: 0.14, // frontal pole narrower than occipital
} as const;
const TEMPORAL_BULGE = { z: 0.1, zWidth: 0.34, out: 0.08, down: 0.17 } as const;
const OCCIPITAL_LIFT = 0.14; // raise posterior underside to seat the cerebellum
const SYLVIAN = { depth: 0.05, width: 0.035 } as const;
/** Sulci = zero-crossings of warped noise (thin dark lines); gyri = broad crowns between them. */
const GYRI = { freq: 3.6, warp: 0.35, sharpness: 7, depth: 0.045, crown: 0.01, shellJitter: 0.012 } as const;
const CEREBELLUM = { center: [0, -0.37, -0.6] as Vec3, radii: [0.47, 0.22, 0.31] as Vec3, folia: 30, amp: 0.018 } as const;
const STEM = { top: [0, -0.28, -0.2] as Vec3, bottom: [0, -0.9, -0.32] as Vec3, radius: 0.1 } as const;
const VOLUME_SCALE = 0.8;
/** Hero "nebula" start positions: a loose 3-arm spiral disc. */
const SCATTER = { rMin: 1.6, rSpread: 4.4, arms: 3, twist: 0.9, thickness: 0.35 } as const;

export const KIND_SURFACE = 0;
export const KIND_VOLUME = 1;
export const KIND_DEEP = 2;

export interface BrainPointData {
  count: number;
  positions: Float32Array;
  normals: Float32Array;
  regions: Float32Array; // region index (float) per point
  seeds: Float32Array; // 0..1 random per point
  kinds: Float32Array; // 0 surface, 1 inner volume, 2 deep structure
  folds: Float32Array; // 0 sulcus .. 1 gyral crown
  scatter: Float32Array; // hero nebula positions
}

/* ------------------------------------------------------------------ */
/* RNG + NOISE                                                         */
/* ------------------------------------------------------------------ */
type Rand = () => number;
type Noise3 = (x: number, y: number, z: number) => number;

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded classic Perlin noise, output roughly [-1, 1]. */
function createNoise3D(rand: Rand): Noise3 {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const X = xi & 255, Y = yi & 255, Z = zi & 255;
    x -= xi; y -= yi; z -= zi;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(w,
      lerp(v, lerp(u, grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z)),
        lerp(u, grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1))));
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number) => Math.exp(-x * x);
function gaussRand(rand: Rand): number {
  return Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
}
function randomDir(rand: Rand, out: THREE.Vector3): THREE.Vector3 {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), r * Math.sin(a), z);
}

/** 0 on gyral crowns, ->1 inside sulci. Two octaves of domain-warped zero-crossing lines. */
function sulci(noise: Noise3, x: number, y: number, z: number): number {
  const f = GYRI.freq;
  const wx = noise(x * 1.7 + 13.1, y * 1.7, z * 1.7) * GYRI.warp;
  const wy = noise(x * 1.7, y * 1.7 + 41.7, z * 1.7) * GYRI.warp;
  const wz = noise(x * 1.7, y * 1.7, z * 1.7 + 77.3) * GYRI.warp;
  const X = (x + wx) * f, Y = (y + wy) * f, Z = (z + wz) * f;
  const s1 = Math.pow(1 - Math.abs(noise(X, Y, Z)), GYRI.sharpness);
  const s2 = Math.pow(1 - Math.abs(noise(X * 2.03 + 7.7, Y * 2.03, Z * 2.03)), GYRI.sharpness + 2) * 0.55;
  return Math.min(1, s1 + s2);
}

/* ------------------------------------------------------------------ */
/* WRITER                                                              */
/* ------------------------------------------------------------------ */
interface Writer {
  data: BrainPointData;
  size: () => number;
  push: (x: number, y: number, z: number, n: THREE.Vector3, region: number, kind: number, fold: number) => void;
}

function createWriter(count: number, rand: Rand): Writer {
  const data: BrainPointData = {
    count,
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
    regions: new Float32Array(count),
    seeds: new Float32Array(count),
    kinds: new Float32Array(count),
    folds: new Float32Array(count),
    scatter: new Float32Array(count * 3),
  };
  let i = 0;
  const push: Writer["push"] = (x, y, z, n, region, kind, fold) => {
    if (i >= count) return;
    const i3 = i * 3;
    data.positions[i3] = x; data.positions[i3 + 1] = y; data.positions[i3 + 2] = z;
    data.normals[i3] = n.x; data.normals[i3 + 1] = n.y; data.normals[i3 + 2] = n.z;
    data.regions[i] = region;
    data.kinds[i] = kind;
    data.folds[i] = clamp01(fold);
    data.seeds[i] = rand();
    const r = SCATTER.rMin + SCATTER.rSpread * Math.pow(rand(), 0.75);
    const arm = Math.floor(rand() * SCATTER.arms);
    const a = arm * ((Math.PI * 2) / SCATTER.arms) + r * SCATTER.twist + gaussRand(rand) * 0.3;
    data.scatter[i3] = Math.cos(a) * r;
    data.scatter[i3 + 1] = gaussRand(rand) * SCATTER.thickness * (0.6 + r * 0.12);
    data.scatter[i3 + 2] = Math.sin(a) * r;
    i++;
  };
  return { data, push, size: () => i };
}

/* ------------------------------------------------------------------ */
/* STRUCTURES                                                          */
/* ------------------------------------------------------------------ */
interface Ctx { rand: Rand; noise: Noise3; w: Writer; }
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();
const _r = new THREE.Vector3();
const _hp: Vec3 = [0, 0, 0];

/**
 * Pick a direction on the unit sphere with rejection so the mapped ellipsoid
 * surface has roughly uniform point density.
 */
function sampleShellDir(rand: Rand, radiiFor: (d: THREE.Vector3, out: THREE.Vector3) => void, bound: number): void {
  for (let tries = 0; tries < 12; tries++) {
    randomDir(rand, _d);
    radiiFor(_d, _r);
    const area = _r.x * _r.y * _r.z * Math.hypot(_d.x / _r.x, _d.y / _r.y, _d.z / _r.z);
    if (rand() * bound <= area) return;
  }
}

const HEMI_BOUND = (HEMI.rxLateral * HEMI.ryTop * HEMI.rzBack) / HEMI.rxMedial;
function cortexPoint({ rand, noise, w }: Ctx): void {
  const s = rand() < 0.5 ? -1 : 1;
  sampleShellDir(rand, (d, out) => {
    const taper = 1 - HEMI.frontTaper * Math.max(0, d.z);
    out.set(
      (d.x * s >= 0 ? HEMI.rxLateral : HEMI.rxMedial) * taper,
      (d.y >= 0 ? HEMI.ryTop : HEMI.ryBottom) * taper,
      d.z >= 0 ? HEMI.rzFront : HEMI.rzBack,
    );
  }, HEMI_BOUND);
  const lateral = _d.x * s;
  let x = HEMI.centerX * s + _d.x * _r.x;
  let y = HEMI.centerY + _d.y * _r.y;
  let z = _d.z * _r.z;
  _n.set(_d.x / _r.x, _d.y / _r.y, _d.z / _r.z).normalize();

  // Temporal lobe: bulge down and out on the lower lateral side.
  const tb = gauss((z - TEMPORAL_BULGE.z) / TEMPORAL_BULGE.zWidth) * smoothstep(0.1, 0.75, lateral) * smoothstep(0.05, -0.7, _d.y);
  x += s * TEMPORAL_BULGE.out * tb;
  y -= TEMPORAL_BULGE.down * tb;
  // Occipital underside lifted to make room for the cerebellum.
  y += OCCIPITAL_LIFT * smoothstep(-0.35, -0.95, z) * smoothstep(0.1, -0.6, _d.y);

  // Gyri / sulci.
  const sul = sulci(noise, x, y, z);
  // Sylvian (lateral) fissure, aligned with the temporal zone boundary.
  const syl = gauss((y - temporalTopY(z)) / SYLVIAN.width) * smoothstep(0.25, 0.7, lateral)
    * smoothstep(-0.6, -0.4, z) * smoothstep(0.62, 0.42, z);
  let fold = (1 - 0.8 * sul) * (1 - 0.85 * syl);
  fold *= 0.55 + 0.45 * smoothstep(0.02, 0.14, Math.abs(x)); // dim medial wall
  const disp = -sul * GYRI.depth + (1 - sul) * GYRI.crown - syl * SYLVIAN.depth + (rand() - 0.5) * GYRI.shellJitter;
  x += _n.x * disp; y += _n.y * disp; z += _n.z * disp;
  w.push(x, y, z, _n, classifyPoint(x, y, z), KIND_SURFACE, fold);
}

const CB_BOUND = (CEREBELLUM.radii[0] * CEREBELLUM.radii[1] * CEREBELLUM.radii[2]) / (CEREBELLUM.radii[1] * 0.8);
function cerebellumPoint({ rand, noise, w }: Ctx): void {
  const [rx, ry, rz] = CEREBELLUM.radii;
  sampleShellDir(rand, (d, out) => { out.set(rx, d.y >= 0 ? ry * 0.8 : ry, rz); }, CB_BOUND);
  const [cx, cy, cz] = CEREBELLUM.center;
  let x = cx + _d.x * _r.x;
  let y = cy + _d.y * _r.y;
  let z = cz + _d.z * _r.z;
  if (_d.z < 0) z += 0.04 * gauss(x / 0.06); // vermis notch at the posterior midline
  _n.set(_d.x / _r.x, _d.y / _r.y, _d.z / _r.z).normalize();
  // Folia: fine transverse striations wrapping around the y-z profile.
  const a = Math.atan2(_d.y, -_d.z);
  const f = 0.5 + 0.5 * Math.cos(a * CEREBELLUM.folia + noise(x * 4, y * 4, z * 4) * 2);
  const disp = (f - 0.5) * CEREBELLUM.amp;
  x += _n.x * disp; y += _n.y * disp; z += _n.z * disp;
  w.push(x, y, z, _n, regionIndex("cerebellum"), KIND_SURFACE, 0.35 + 0.65 * Math.pow(f, 1.5));
}

function stemPoint({ rand, w }: Ctx): void {
  const t = rand();
  const a = rand() * Math.PI * 2;
  const [, ty, tz] = STEM.top;
  const [, by, bz] = STEM.bottom;
  const rad = STEM.radius * (1 - 0.35 * t) + 0.035 * gauss((t - 0.3) / 0.12); // pons bulge
  _n.set(Math.cos(a), 0, Math.sin(a));
  w.push(_n.x * rad, ty + (by - ty) * t, tz + (bz - tz) * t + _n.z * rad * 0.9, _n, UNASSIGNED_INDEX, KIND_SURFACE, 0.5 + 0.3 * rand());
}

function volumePoint({ rand, w }: Ctx): void {
  const s = rand() < 0.5 ? -1 : 1;
  let vx = 0, vy = 0, vz = 0;
  do { vx = rand() * 2 - 1; vy = rand() * 2 - 1; vz = rand() * 2 - 1; } while (vx * vx + vy * vy + vz * vz > 1);
  const x = HEMI.centerX * s + vx * HEMI.rxLateral * VOLUME_SCALE * 0.8;
  const y = HEMI.centerY + vy * 0.5 * VOLUME_SCALE;
  const z = vz * 0.9 * VOLUME_SCALE;
  _n.set(x, y, z).normalize();
  w.push(x, y, z, _n, classifyPoint(x, y, z), KIND_VOLUME, 0.5);
}

function hippocampusPoint({ rand, w }: Ctx): void {
  const s = rand() < 0.5 ? -1 : 1;
  const t = rand();
  hippocampusPath(t, s, _hp);
  randomDir(rand, _n);
  const rad = HIPPOCAMPUS.radius * (1 - 0.45 * t) * (0.7 + 0.3 * rand());
  w.push(_hp[0] + _n.x * rad, _hp[1] + _n.y * rad * 0.8, _hp[2] + _n.z * rad * 0.6, _n, regionIndex("hippocampus"), KIND_DEEP, 0.85);
}

function amygdalaPoint({ rand, w }: Ctx): void {
  const s = rand() < 0.5 ? -1 : 1;
  randomDir(rand, _n);
  const rad = AMYGDALA.radius * (0.6 + 0.4 * rand());
  const [cx, cy, cz] = AMYGDALA.center;
  w.push(cx * s + _n.x * rad, cy + _n.y * rad, cz + _n.z * rad, _n, regionIndex("amygdala"), KIND_DEEP, 0.9);
}

function emit(ctx: Ctx, n: number, fn: (c: Ctx) => void): void {
  for (let i = 0; i < n; i++) fn(ctx);
}

/* ------------------------------------------------------------------ */
/* PUBLIC                                                              */
/* ------------------------------------------------------------------ */
const cache = new Map<string, BrainPointData>();

/** Procedural brain. Fully deterministic for a given (count, seed). Cached. */
export function generateBrainPoints(count: number, seed: number = BRAIN_SEED): BrainPointData {
  const key = `${count}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = mulberry32(seed);
  const ctx: Ctx = { rand, noise: createNoise3D(mulberry32(seed ^ 0x9e3779b9)), w: createWriter(count, rand) };
  emit(ctx, Math.round(count * MIX.cerebellum), cerebellumPoint);
  emit(ctx, Math.round(count * MIX.stem), stemPoint);
  emit(ctx, Math.round(count * MIX.volume), volumePoint);
  emit(ctx, Math.round(count * MIX.hippocampus), hippocampusPoint);
  emit(ctx, Math.round(count * MIX.amygdala), amygdalaPoint);
  while (ctx.w.size() < count) cortexPoint(ctx);
  cache.set(key, ctx.w.data);
  return ctx.w.data;
}

/**
 * Sample a loaded GLB scene. The model is centred and scaled so its longest axis spans [-1, 1];
 * it must already follow the contract orientation (+z anterior, +y up).
 * Meshes named after a RegionId provide region assignment; everything else uses spatial zones.
 */
export function sampleBrainFromObject(root: THREE.Object3D, count: number, seed: number = BRAIN_SEED): BrainPointData {
  const rand = mulberry32(seed);
  const noise = createNoise3D(mulberry32(seed ^ 0x9e3779b9));
  const w = createWriter(count, rand);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z, 1e-6);

  interface Part { sampler: MeshSurfaceSampler; geo: THREE.BufferGeometry; region: number | null; weight: number; }
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
    for (let o: THREE.Object3D | null = obj; o && !named; o = o.parent) named = matchRegionName(o.name);
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

  const deepBudget = hasDeep ? 0 : Math.round(count * (MIX.hippocampus + MIX.amygdala));
  const volumeBudget = Math.round(count * MIX.volume);
  const surfaceBudget = count - deepBudget - volumeBudget;
  const total = parts.reduce((s, p) => s + p.weight, 0);
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const surface: number[] = [];

  if (total > 0) {
    let written = 0;
    parts.forEach((part, idx) => {
      const n = idx === parts.length - 1 ? surfaceBudget - written : Math.round((surfaceBudget * part.weight) / total);
      for (let i = 0; i < n; i++) {
        part.sampler.sample(pos, nrm);
        const region = part.region ?? classifyPoint(pos.x, pos.y, pos.z);
        const deep = region === regionIndex("hippocampus") || region === regionIndex("amygdala");
        const fold = 0.45 + 0.55 * (1 - sulci(noise, pos.x, pos.y, pos.z));
        w.push(pos.x, pos.y, pos.z, nrm, region, deep ? KIND_DEEP : KIND_SURFACE, fold);
        if (!deep && surface.length < 30000) surface.push(pos.x, pos.y, pos.z);
      }
      written += n;
    });
  }
  parts.forEach((p) => p.geo.dispose());

  // Inner volume: shrink random surface samples towards the hemisphere centres.
  const ctx: Ctx = { rand, noise, w };
  for (let i = 0; i < volumeBudget && surface.length > 0; i++) {
    const j = Math.floor(rand() * (surface.length / 3)) * 3;
    const k = 0.35 + 0.5 * rand();
    const sx = surface[j], cx = Math.sign(sx) * HEMI.centerX;
    const x = cx + (sx - cx) * k, y = surface[j + 1] * k, z = surface[j + 2] * k;
    const region = classifyPoint(x, y, z, true);
    const deep = region === regionIndex("hippocampus") || region === regionIndex("amygdala");
    nrm.set(x, y, z).normalize();
    w.push(x, y, z, nrm, region, deep ? KIND_DEEP : KIND_VOLUME, 0.5);
  }
  const hippoBudget = Math.round(deepBudget * 0.62);
  emit(ctx, hippoBudget, hippocampusPoint);
  emit(ctx, deepBudget - hippoBudget, amygdalaPoint);
  while (w.size() < count) cortexPoint(ctx); // safety top-up (e.g. GLB without meshes)
  return w.data;
}
