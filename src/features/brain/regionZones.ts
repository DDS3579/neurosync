/**
 * Region assignment for the particle brain.
 *
 * Coordinate convention (contract): x +right, y +up, z +front (anterior).
 * The brain is normalised to roughly [-1, 1] on each axis.
 *
 * Every particle gets a float region index (0..6 = REGION_IDS order, 7 = unassigned:
 * brainstem, motor strip, deep filler). The GPU highlights by that index.
 * These are coarse EDUCATIONAL zones, not an anatomical segmentation.
 */
import type { RegionId } from "@/types/domain";

export type Vec3 = [number, number, number];
export type BrainMode = "anatomy" | "functional" | "activity";

export const REGION_IDS: readonly RegionId[] = [
  "prefrontal",
  "parietal",
  "temporal",
  "occipital",
  "cerebellum",
  "hippocampus",
  "amygdala",
];
/** Uniform array length: 7 regions + 1 "unassigned" slot. */
export const REGION_SLOTS = 8;
export const UNASSIGNED_INDEX = 7;
export const INTERNAL_REGIONS: ReadonlySet<RegionId> = new Set<RegionId>(["hippocampus", "amygdala"]);

export function regionIndex(id: RegionId): number {
  return REGION_IDS.indexOf(id);
}
export function isRegionId(value: string): value is RegionId {
  return (REGION_IDS as readonly string[]).includes(value);
}
/** Match a GLB mesh/node name such as "Temporal_L" or "hippocampus.001". */
export function matchRegionName(name: string): RegionId | null {
  const n = name.toLowerCase();
  return REGION_IDS.find((id) => n.includes(id)) ?? null;
}

/* ------------------------------------------------------------------ */
/* TUNABLE ZONES                                                       */
/* ------------------------------------------------------------------ */
export const ZONES = {
  prefrontal: { zMin: 0.4 },
  parietal: { yMin: 0.12, zMin: -0.62, zMax: 0.15 },
  occipital: { zMax: -0.55, yMin: -0.28 },
  /** Upper edge follows the Sylvian fissure, which rises towards the back. */
  temporal: { absXMin: 0.45, yMin: -0.7, topAtZ0: 0.06, topSlope: -0.16, zMin: -0.58, zMax: 0.58 },
  cerebellum: { yMax: -0.3, zMax: -0.15 },
} as const;

/** Internal structures (right hemisphere; mirrored on x). */
export const HIPPOCAMPUS = { x0: 0.29, x1: 0.4, y0: -0.24, rise: 0.13, z0: 0.07, z1: -0.3, radius: 0.05 } as const;
export const AMYGDALA = { center: [0.28, -0.25, 0.15] as Vec3, radius: 0.05 } as const;

/** y of the Sylvian fissure / temporal upper boundary at a given z. */
export function temporalTopY(z: number): number {
  return ZONES.temporal.topAtZ0 + ZONES.temporal.topSlope * z;
}

/** Centre of the hippocampal tube at parameter t (0 = anterior head, 1 = posterior tail). */
export function hippocampusPath(t: number, side: number, out: Vec3): Vec3 {
  const H = HIPPOCAMPUS;
  out[0] = side * (H.x0 + (H.x1 - H.x0) * t);
  out[1] = H.y0 + H.rise * t * t;
  out[2] = H.z0 + (H.z1 - H.z0) * t;
  return out;
}

const _hp: Vec3 = [0, 0, 0];
/**
 * Classify a point into a region index. `deep` also tests the internal blobs
 * (used for GLB volume points; procedural internal points are tagged explicitly).
 */
export function classifyPoint(x: number, y: number, z: number, deep = false): number {
  const ax = Math.abs(x);
  if (deep) {
    const [cx, cy, cz] = AMYGDALA.center;
    if (Math.hypot(ax - cx, y - cy, z - cz) < AMYGDALA.radius * 1.5) return regionIndex("amygdala");
    const t = Math.min(1, Math.max(0, (z - HIPPOCAMPUS.z0) / (HIPPOCAMPUS.z1 - HIPPOCAMPUS.z0)));
    hippocampusPath(t, 1, _hp);
    if (Math.hypot(ax - _hp[0], y - _hp[1], z - _hp[2]) < HIPPOCAMPUS.radius * 1.5) return regionIndex("hippocampus");
  }
  const T = ZONES.temporal;
  if (ax > T.absXMin && y > T.yMin && y < temporalTopY(z) && z > T.zMin && z < T.zMax) return regionIndex("temporal");
  if (y < ZONES.cerebellum.yMax && z < ZONES.cerebellum.zMax) return regionIndex("cerebellum");
  if (z > ZONES.prefrontal.zMin) return regionIndex("prefrontal");
  if (z < ZONES.occipital.zMax && y > ZONES.occipital.yMin) return regionIndex("occipital");
  const P = ZONES.parietal;
  if (y > P.yMin && z > P.zMin && z < P.zMax) return regionIndex("parietal");
  return UNASSIGNED_INDEX;
}

/* ------------------------------------------------------------------ */
/* RAYCAST PROXIES, LABEL ANCHORS, CAMERA VIEWS                        */
/* ------------------------------------------------------------------ */
export interface RegionProxy {
  region: RegionId;
  center: Vec3;
  radii: Vec3;
}
const mirrored = (p: RegionProxy): RegionProxy[] => [p, { ...p, center: [-p.center[0], p.center[1], p.center[2]] }];

/** Low-poly ellipsoids used only for hover/click raycasting (never rendered). */
export const REGION_PROXIES: RegionProxy[] = [
  { region: "prefrontal", center: [0, 0.12, 0.68], radii: [0.72, 0.52, 0.34] },
  { region: "parietal", center: [0, 0.42, -0.22], radii: [0.74, 0.32, 0.44] },
  { region: "occipital", center: [0, 0.08, -0.82], radii: [0.62, 0.36, 0.24] },
  ...mirrored({ region: "temporal", center: [0.64, -0.2, 0.04], radii: [0.22, 0.24, 0.52] }),
  { region: "cerebellum", center: [0, -0.4, -0.6], radii: [0.5, 0.26, 0.32] },
  ...mirrored({ region: "hippocampus", center: [0.34, -0.18, -0.1], radii: [0.08, 0.09, 0.22] }),
  ...mirrored({ region: "amygdala", center: [0.28, -0.25, 0.15], radii: [0.07, 0.07, 0.07] }),
];

/** Label anchor / pulse origin per region (right side; shaders mirror with abs(x)). */
export const REGION_ANCHORS: Record<RegionId, Vec3> = {
  prefrontal: [0.22, 0.28, 0.8],
  parietal: [0.3, 0.55, -0.25],
  temporal: [0.68, -0.22, 0.08],
  occipital: [0.22, 0.18, -0.88],
  cerebellum: [0.25, -0.42, -0.65],
  hippocampus: [0.34, -0.17, -0.1],
  amygdala: [0.28, -0.25, 0.15],
};

/** Camera direction (from the region's focus point) and distance when a region is selected. */
export const REGION_VIEWS: Record<RegionId, { dir: Vec3; distance: number }> = {
  prefrontal: { dir: [0.35, 0.35, 1], distance: 3.1 },
  parietal: { dir: [0.3, 1, -0.35], distance: 3.1 },
  temporal: { dir: [1, -0.1, 0.15], distance: 2.9 },
  occipital: { dir: [0.3, 0.3, -1], distance: 3.1 },
  cerebellum: { dir: [0.45, -0.45, -1], distance: 3 },
  hippocampus: { dir: [1, -0.1, -0.25], distance: 2.4 },
  amygdala: { dir: [1, -0.15, 0.45], distance: 2.4 },
};
