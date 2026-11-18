/**
 * Zero-Three pure procedural particle-brain generator shared by:
 * - Main-thread sync callers / tests (`generateProceduralBrainPoints`)
 * - Web Worker & time-sliced async generator (`generateProceduralBrainPointsAsync`)
 * - Build-time 2D silhouette extractor (`scripts/generate-intro-silhouette.ts`)
 */
import {
  AMYGDALA,
  HIPPOCAMPUS,
  UNASSIGNED_INDEX,
  classifyPoint,
  hippocampusPath,
  regionIndex,
  temporalTopY,
  type Vec3,
} from "./regionZones";

export const BRAIN_SEED = 1337;

/** Share of the point budget per structure (remainder goes to cortex). */
export const BRAIN_MIX = {
  cerebellum: 0.12,
  stem: 0.025,
  volume: 0.06,
  hippocampus: 0.035,
  amygdala: 0.02,
} as const;

export const HEMI = {
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
const OCCIPITAL_LIFT = 0.14;
const SYLVIAN = { depth: 0.05, width: 0.035 } as const;
const GYRI = {
  freq: 3.6,
  warp: 0.35,
  sharpness: 7,
  depth: 0.045,
  crown: 0.01,
  shellJitter: 0.012,
} as const;
const CEREBELLUM = {
  center: [0, -0.37, -0.6] as Vec3,
  radii: [0.47, 0.22, 0.31] as Vec3,
  folia: 30,
  amp: 0.018,
} as const;
const STEM = {
  top: [0, -0.28, -0.2] as Vec3,
  bottom: [0, -0.9, -0.32] as Vec3,
  radius: 0.1,
} as const;
const VOLUME_SCALE = 0.8;
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

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

class MutableVec3 implements Vec3Like {
  x = 0;
  y = 0;
  z = 0;

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  normalize(): this {
    const len = Math.hypot(this.x, this.y, this.z);
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }
}

export type Rand = () => number;
export type Noise3 = (x: number, y: number, z: number) => number;

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
export function createNoise3D(rand: Rand): Noise3 {
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
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const X = xi & 255;
    const Y = yi & 255;
    const Z = zi & 255;
    const fx = x - xi;
    const fy = y - yi;
    const fz = z - zi;
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(perm[AA], fx, fy, fz), grad(perm[BA], fx - 1, fy, fz)),
        lerp(u, grad(perm[AB], fx, fy - 1, fz), grad(perm[BB], fx - 1, fy - 1, fz)),
      ),
      lerp(
        v,
        lerp(u, grad(perm[AA + 1], fx, fy, fz - 1), grad(perm[BA + 1], fx - 1, fy, fz - 1)),
        lerp(u, grad(perm[AB + 1], fx, fy - 1, fz - 1), grad(perm[BB + 1], fx - 1, fy - 1, fz - 1)),
      ),
    );
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
function randomDir(rand: Rand, out: MutableVec3): MutableVec3 {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), r * Math.sin(a), z);
}

/** 0 on gyral crowns, ->1 inside sulci. Two octaves of domain-warped zero-crossing lines. */
export function sulci(noise: Noise3, x: number, y: number, z: number): number {
  const f = GYRI.freq;
  const wx = noise(x * 1.7 + 13.1, y * 1.7, z * 1.7) * GYRI.warp;
  const wy = noise(x * 1.7, y * 1.7 + 41.7, z * 1.7) * GYRI.warp;
  const wz = noise(x * 1.7, y * 1.7, z * 1.7 + 77.3) * GYRI.warp;
  const X = (x + wx) * f;
  const Y = (y + wy) * f;
  const Z = (z + wz) * f;
  const s1 = Math.pow(1 - Math.abs(noise(X, Y, Z)), GYRI.sharpness);
  const s2 =
    Math.pow(1 - Math.abs(noise(X * 2.03 + 7.7, Y * 2.03, Z * 2.03)), GYRI.sharpness + 2) * 0.55;
  return Math.min(1, s1 + s2);
}

export interface PointWriter {
  data: BrainPointData;
  size: () => number;
  push: (
    x: number,
    y: number,
    z: number,
    n: Vec3Like,
    region: number,
    kind: number,
    fold: number,
  ) => void;
}

export function createPointWriter(count: number, rand: Rand): PointWriter {
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
  const push: PointWriter["push"] = (x, y, z, n, region, kind, fold) => {
    if (i >= count) return;
    const i3 = i * 3;
    data.positions[i3] = x;
    data.positions[i3 + 1] = y;
    data.positions[i3 + 2] = z;
    data.normals[i3] = n.x;
    data.normals[i3 + 1] = n.y;
    data.normals[i3 + 2] = n.z;
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

interface CoreScratch {
  d: MutableVec3;
  n: MutableVec3;
  r: MutableVec3;
  hp: Vec3;
}

function createScratch(): CoreScratch {
  return {
    d: new MutableVec3(),
    n: new MutableVec3(),
    r: new MutableVec3(),
    hp: [0, 0, 0],
  };
}

interface Ctx {
  rand: Rand;
  noise: Noise3;
  w: PointWriter;
  s: CoreScratch;
}

function sampleShellDir(
  rand: Rand,
  s: CoreScratch,
  radiiFor: (d: MutableVec3, out: MutableVec3) => void,
  bound: number,
): void {
  for (let tries = 0; tries < 12; tries++) {
    randomDir(rand, s.d);
    radiiFor(s.d, s.r);
    const area =
      s.r.x * s.r.y * s.r.z * Math.hypot(s.d.x / s.r.x, s.d.y / s.r.y, s.d.z / s.r.z);
    if (rand() * bound <= area) return;
  }
}

const HEMI_BOUND = (HEMI.rxLateral * HEMI.ryTop * HEMI.rzBack) / HEMI.rxMedial;
export function emitCortexPoint({ rand, noise, w, s }: Ctx): void {
  const side = rand() < 0.5 ? -1 : 1;
  sampleShellDir(
    rand,
    s,
    (d, out) => {
      const taper = 1 - HEMI.frontTaper * Math.max(0, d.z);
      out.set(
        (d.x * side >= 0 ? HEMI.rxLateral : HEMI.rxMedial) * taper,
        (d.y >= 0 ? HEMI.ryTop : HEMI.ryBottom) * taper,
        d.z >= 0 ? HEMI.rzFront : HEMI.rzBack,
      );
    },
    HEMI_BOUND,
  );
  const lateral = s.d.x * side;
  let x = HEMI.centerX * side + s.d.x * s.r.x;
  let y = HEMI.centerY + s.d.y * s.r.y;
  let z = s.d.z * s.r.z;
  s.n.set(s.d.x / s.r.x, s.d.y / s.r.y, s.d.z / s.r.z).normalize();

  const tb =
    gauss((z - TEMPORAL_BULGE.z) / TEMPORAL_BULGE.zWidth) *
    smoothstep(0.1, 0.75, lateral) *
    smoothstep(0.05, -0.7, s.d.y);
  x += side * TEMPORAL_BULGE.out * tb;
  y -= TEMPORAL_BULGE.down * tb;
  y += OCCIPITAL_LIFT * smoothstep(-0.35, -0.95, z) * smoothstep(0.1, -0.6, s.d.y);

  const sul = sulci(noise, x, y, z);
  const syl =
    gauss((y - temporalTopY(z)) / SYLVIAN.width) *
    smoothstep(0.25, 0.7, lateral) *
    smoothstep(-0.6, -0.4, z) *
    smoothstep(0.62, 0.42, z);
  let fold = (1 - 0.8 * sul) * (1 - 0.85 * syl);
  fold *= 0.55 + 0.45 * smoothstep(0.02, 0.14, Math.abs(x));
  const disp =
    -sul * GYRI.depth +
    (1 - sul) * GYRI.crown -
    syl * SYLVIAN.depth +
    (rand() - 0.5) * GYRI.shellJitter;
  x += s.n.x * disp;
  y += s.n.y * disp;
  z += s.n.z * disp;
  w.push(x, y, z, s.n, classifyPoint(x, y, z), KIND_SURFACE, fold);
}

const CB_BOUND =
  (CEREBELLUM.radii[0] * CEREBELLUM.radii[1] * CEREBELLUM.radii[2]) /
  (CEREBELLUM.radii[1] * 0.8);
function emitCerebellumPoint({ rand, noise, w, s }: Ctx): void {
  const [rx, ry, rz] = CEREBELLUM.radii;
  sampleShellDir(
    rand,
    s,
    (d, out) => {
      out.set(rx, d.y >= 0 ? ry * 0.8 : ry, rz);
    },
    CB_BOUND,
  );
  const [cx, cy, cz] = CEREBELLUM.center;
  let x = cx + s.d.x * s.r.x;
  let y = cy + s.d.y * s.r.y;
  let z = cz + s.d.z * s.r.z;
  if (s.d.z < 0) z += 0.04 * gauss(x / 0.06);
  s.n.set(s.d.x / s.r.x, s.d.y / s.r.y, s.d.z / s.r.z).normalize();
  const a = Math.atan2(s.d.y, -s.d.z);
  const f = 0.5 + 0.5 * Math.cos(a * CEREBELLUM.folia + noise(x * 4, y * 4, z * 4) * 2);
  const disp = (f - 0.5) * CEREBELLUM.amp;
  x += s.n.x * disp;
  y += s.n.y * disp;
  z += s.n.z * disp;
  w.push(x, y, z, s.n, regionIndex("cerebellum"), KIND_SURFACE, 0.35 + 0.65 * Math.pow(f, 1.5));
}

function emitStemPoint({ rand, w, s }: Ctx): void {
  const t = rand();
  const a = rand() * Math.PI * 2;
  const [, ty, tz] = STEM.top;
  const [, by, bz] = STEM.bottom;
  const rad = STEM.radius * (1 - 0.35 * t) + 0.035 * gauss((t - 0.3) / 0.12);
  s.n.set(Math.cos(a), 0, Math.sin(a));
  w.push(
    s.n.x * rad,
    ty + (by - ty) * t,
    tz + (bz - tz) * t + s.n.z * rad * 0.9,
    s.n,
    UNASSIGNED_INDEX,
    KIND_SURFACE,
    0.5 + 0.3 * rand(),
  );
}

function emitVolumePoint({ rand, w, s }: Ctx): void {
  const side = rand() < 0.5 ? -1 : 1;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  do {
    vx = rand() * 2 - 1;
    vy = rand() * 2 - 1;
    vz = rand() * 2 - 1;
  } while (vx * vx + vy * vy + vz * vz > 1);
  const x = HEMI.centerX * side + vx * HEMI.rxLateral * VOLUME_SCALE * 0.8;
  const y = HEMI.centerY + vy * 0.5 * VOLUME_SCALE;
  const z = vz * 0.9 * VOLUME_SCALE;
  s.n.set(x, y, z).normalize();
  w.push(x, y, z, s.n, classifyPoint(x, y, z), KIND_VOLUME, 0.5);
}

export function emitHippocampusPoint({ rand, w, s }: Ctx): void {
  const side = rand() < 0.5 ? -1 : 1;
  const t = rand();
  hippocampusPath(t, side, s.hp);
  randomDir(rand, s.n);
  const rad = HIPPOCAMPUS.radius * (1 - 0.45 * t) * (0.7 + 0.3 * rand());
  w.push(
    s.hp[0] + s.n.x * rad,
    s.hp[1] + s.n.y * rad * 0.8,
    s.hp[2] + s.n.z * rad * 0.6,
    s.n,
    regionIndex("hippocampus"),
    KIND_DEEP,
    0.85,
  );
}

export function emitAmygdalaPoint({ rand, w, s }: Ctx): void {
  const side = rand() < 0.5 ? -1 : 1;
  randomDir(rand, s.n);
  const rad = AMYGDALA.radius * (0.6 + 0.4 * rand());
  const [cx, cy, cz] = AMYGDALA.center;
  w.push(
    cx * side + s.n.x * rad,
    cy + s.n.y * rad,
    cz + s.n.z * rad,
    s.n,
    regionIndex("amygdala"),
    KIND_DEEP,
    0.9,
  );
}

export function createProceduralContext(count: number, seed: number = BRAIN_SEED): Ctx {
  const rand = mulberry32(seed);
  return {
    rand,
    noise: createNoise3D(mulberry32(seed ^ 0x9e3779b9)),
    w: createPointWriter(count, rand),
    s: createScratch(),
  };
}

/** Synchronous procedural generator. Deterministic for `(count, seed)`. */
export function generateProceduralBrainPoints(
  count: number,
  seed: number = BRAIN_SEED,
): BrainPointData {
  const ctx = createProceduralContext(count, seed);
  const steps: Array<[number, (c: Ctx) => void]> = [
    [Math.round(count * BRAIN_MIX.cerebellum), emitCerebellumPoint],
    [Math.round(count * BRAIN_MIX.stem), emitStemPoint],
    [Math.round(count * BRAIN_MIX.volume), emitVolumePoint],
    [Math.round(count * BRAIN_MIX.hippocampus), emitHippocampusPoint],
    [Math.round(count * BRAIN_MIX.amygdala), emitAmygdalaPoint],
  ];
  for (const [n, fn] of steps) {
    for (let i = 0; i < n; i++) fn(ctx);
  }
  while (ctx.w.size() < count) emitCortexPoint(ctx);
  return ctx.w.data;
}

export interface AsyncGeometryOptions {
  chunkSize?: number;
  yieldBetweenChunks?: boolean;
  onProgress?: (placed: number, total: number) => void;
  signal?: { cancelled: boolean };
}

function yieldControl(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched && typeof sched.yield === "function") {
    return sched.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Chunked procedural brain generator that reports real placement counts
 * and optionally yields between batches so UI animations never drop frames.
 */
export async function generateProceduralBrainPointsAsync(
  count: number,
  seed: number = BRAIN_SEED,
  options: AsyncGeometryOptions = {},
): Promise<BrainPointData> {
  const {
    chunkSize = 6000,
    yieldBetweenChunks = true,
    onProgress,
    signal,
  } = options;
  const ctx = createProceduralContext(count, seed);
  const cerebellumN = Math.round(count * BRAIN_MIX.cerebellum);
  const stemN = Math.round(count * BRAIN_MIX.stem);
  const volumeN = Math.round(count * BRAIN_MIX.volume);
  const hippoN = Math.round(count * BRAIN_MIX.hippocampus);
  const amygN = Math.round(count * BRAIN_MIX.amygdala);

  const schedule: Array<[number, (c: Ctx) => void]> = [
    [cerebellumN, emitCerebellumPoint],
    [stemN, emitStemPoint],
    [volumeN, emitVolumePoint],
    [hippoN, emitHippocampusPoint],
    [amygN, emitAmygdalaPoint],
    [Math.max(0, count - (cerebellumN + stemN + volumeN + hippoN + amygN)), emitCortexPoint],
  ];

  let placedInChunk = 0;
  for (const [totalForPart, fn] of schedule) {
    let remaining = totalForPart;
    while (remaining > 0 && ctx.w.size() < count) {
      if (signal?.cancelled) return ctx.w.data;
      const batch = Math.min(remaining, Math.max(1, chunkSize - placedInChunk));
      for (let i = 0; i < batch && ctx.w.size() < count; i++) {
        fn(ctx);
      }
      remaining -= batch;
      placedInChunk += batch;
      if (placedInChunk >= chunkSize) {
        placedInChunk = 0;
        onProgress?.(ctx.w.size(), count);
        if (yieldBetweenChunks) {
          await yieldControl();
        }
      }
    }
  }
  while (ctx.w.size() < count) {
    emitCortexPoint(ctx);
  }
  onProgress?.(ctx.w.size(), count);
  return ctx.w.data;
}
