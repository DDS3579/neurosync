/**
 * Build-time generator projecting the procedural 3D particle brain onto a
 * deterministic side-view 2D silhouette (~2,450 points across all 7 valid regions),
 * quantized and delta-encoded into `src/features/landing/intro/silhouetteData.ts`.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BRAIN_SEED,
  KIND_DEEP,
  KIND_SURFACE,
  generateProceduralBrainPoints,
} from "../src/features/brain/proceduralBrainCore";
import { REGION_IDS } from "../src/features/brain/regionZones";
import {
  SILHOUETTE_GRID,
  encodeZigZagDelta,
} from "../src/features/landing/intro/silhouetteCodec";

export const SILHOUETTE_TARGET_COUNTS: Record<(typeof REGION_IDS)[number], number> = {
  prefrontal: 500,
  parietal: 440,
  temporal: 420,
  occipital: 300,
  cerebellum: 350,
  hippocampus: 260,
  amygdala: 180,
};

export interface ProjectedSilhouettePoint {
  u: number;
  v: number;
  regionIdx: number;
}

/**
 * Deterministic spatial cell declustering so ~2,450 projected points distribute
 * cleanly across the cortical contour and internal nuclei without piling onto 1 pixel.
 */
function pickSpreadPoints(
  candidates: Array<{ u: number; v: number }>,
  target: number,
  regionIdx: number,
): ProjectedSilhouettePoint[] {
  if (candidates.length <= target) {
    return candidates.map((p) => ({ ...p, regionIdx }));
  }

  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const c of candidates) {
    if (c.u < uMin) uMin = c.u;
    if (c.u > uMax) uMax = c.u;
    if (c.v < vMin) vMin = c.v;
    if (c.v > vMax) vMax = c.v;
  }

  const bins = Math.ceil(Math.sqrt(target * 1.45));
  const used = new Uint8Array(bins * bins);
  const picked: ProjectedSilhouettePoint[] = [];
  const leftovers: ProjectedSilhouettePoint[] = [];
  const uSpan = Math.max(1e-6, uMax - uMin);
  const vSpan = Math.max(1e-6, vMax - vMin);

  for (const c of candidates) {
    const bx = Math.min(bins - 1, Math.floor(((c.u - uMin) / uSpan) * bins));
    const by = Math.min(bins - 1, Math.floor(((c.v - vMin) / vSpan) * bins));
    const cell = by * bins + bx;
    if (!used[cell] && picked.length < target) {
      used[cell] = 1;
      picked.push({ u: c.u, v: c.v, regionIdx });
    } else {
      leftovers.push({ u: c.u, v: c.v, regionIdx });
    }
  }

  if (picked.length < target && leftovers.length > 0) {
    const need = target - picked.length;
    const step = leftovers.length / need;
    for (let i = 0; i < need; i++) {
      const idx = Math.min(leftovers.length - 1, Math.floor(i * step));
      picked.push(leftovers[idx]);
    }
  }

  return picked;
}

export function buildIntroSilhouettePoints(): ProjectedSilhouettePoint[] {
  const cloud = generateProceduralBrainPoints(65000, BRAIN_SEED);
  const perRegion: Array<Array<{ u: number; v: number }>> = REGION_IDS.map(() => []);

  for (let i = 0; i < cloud.count; i++) {
    const reg = cloud.regions[i];
    if (reg < 0 || reg >= REGION_IDS.length) continue;

    const kind = cloud.kinds[i];
    const x = cloud.positions[i * 3];
    const y = cloud.positions[i * 3 + 1];
    const z = cloud.positions[i * 3 + 2];

    const isDeep = kind === KIND_DEEP;
    if (!isDeep && kind !== KIND_SURFACE) continue;
    // Right hemisphere side-view projection (+z -> right/anterior, -y -> screen down)
    if (x < -0.02) continue;

    // Slight perspective fold from x gives gentle 3D shading around cortical poles
    const u = z + x * 0.08;
    const v = -y;
    perRegion[reg].push({ u, v });
  }

  const all: ProjectedSilhouettePoint[] = [];
  for (let r = 0; r < REGION_IDS.length; r++) {
    const id = REGION_IDS[r];
    all.push(...pickSpreadPoints(perRegion[r], SILHOUETTE_TARGET_COUNTS[id], r));
  }
  return all;
}

export function encodeSilhouetteDataset(points: ProjectedSilhouettePoint[]): string {
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const p of points) {
    if (p.u < uMin) uMin = p.u;
    if (p.u > uMax) uMax = p.u;
    if (p.v < vMin) vMin = p.v;
    if (p.v > vMax) vMax = p.v;
  }

  const span = Math.max(uMax - uMin, vMax - vMin, 1e-6);
  const uMid = (uMin + uMax) / 2;
  const vMid = (vMin + vMax) / 2;
  const margin = 8;
  const usable = SILHOUETTE_GRID - margin * 2;

  const grouped: Array<Array<{ qx: number; qy: number }>> = REGION_IDS.map(() => []);
  for (const p of points) {
    const qx = Math.round(((p.u - uMid) / span + 0.5) * usable + margin);
    const qy = Math.round(((p.v - vMid) / span + 0.5) * usable + margin);
    grouped[p.regionIdx].push({
      qx: Math.max(0, Math.min(SILHOUETTE_GRID, qx)),
      qy: Math.max(0, Math.min(SILHOUETTE_GRID, qy)),
    });
  }

  const runs = grouped.map((pts) => {
    pts.sort((a, b) => (a.qy !== b.qy ? a.qy - b.qy : a.qx - b.qx));
    let prevX = 0;
    let prevY = 0;
    let out = "";
    for (const pt of pts) {
      out += encodeZigZagDelta(pt.qx - prevX);
      out += encodeZigZagDelta(pt.qy - prevY);
      prevX = pt.qx;
      prevY = pt.qy;
    }
    return out;
  });

  return runs.join("|");
}

export function renderSilhouetteModule(payload: string): string {
  return `/**
 * AUTO-GENERATED by scripts/generate-intro-silhouette.ts from proceduralBrainCore.
 * Do not edit manually; regenerate via \`pnpm run generate:intro-silhouette\`.
 */
import type { RegionId } from "@/types/domain";
import { decodeSilhouettePayload, type DecodedSilhouette } from "./silhouetteCodec";

/** Fixed ignition order for First Light region highlights. */
export const IGNITION_ORDER: readonly RegionId[] = [
  "prefrontal",
  "parietal",
  "temporal",
  "occipital",
  "cerebellum",
  "hippocampus",
  "amygdala",
] as const;

/** Hedged educational 1-line captions aligned with BRAIN_REGIONS (src/data/brainRegions.ts). */
export const REGION_CAPTIONS: Record<RegionId, string> = {
  prefrontal: "Prefrontal cortex: commonly associated with planning and working memory",
  parietal: "Parietal lobe: commonly associated with spatial awareness and attention",
  temporal: "Temporal lobe: commonly associated with language, hearing, and memory",
  occipital: "Occipital lobe: commonly associated with visual edges, color, and motion",
  cerebellum: "Cerebellum: commonly associated with movement coordination and balance",
  hippocampus: "Hippocampus: commonly associated with forming memories and navigation",
  amygdala: "Amygdala: commonly associated with emotional salience and emotional learning",
};

export const INTRO_DISCLAIMER = "Educational associations, not measurements.";

/** Quantized, delta-encoded 2D side-view silhouette of ~2,450 brain points. */
export const INTRO_SILHOUETTE_PAYLOAD =
  ${JSON.stringify(payload)};

let cachedSilhouette: DecodedSilhouette | null = null;

export function getIntroSilhouette(): DecodedSilhouette {
  if (!cachedSilhouette) {
    cachedSilhouette = decodeSilhouettePayload(INTRO_SILHOUETTE_PAYLOAD, IGNITION_ORDER.length);
  }
  return cachedSilhouette;
}
`;
}

const selfPath = resolve(fileURLToPath(import.meta.url));
const isVitest = Boolean((globalThis as { __vitest_worker__?: unknown }).__vitest_worker__);
const isCli =
  !isVitest &&
  typeof process !== "undefined" &&
  process.argv.slice(1, 3).some((arg) => Boolean(arg) && resolve(arg) === selfPath);

if (isCli) {
  const pts = buildIntroSilhouettePoints();
  const payload = encodeSilhouetteDataset(pts);
  const content = renderSilhouetteModule(payload);
  const outPath = resolve(process.cwd(), "src/features/landing/intro/silhouetteData.ts");
  writeFileSync(outPath, content, "utf8");
  console.log(
    `Generated ${pts.length} silhouette points -> ${outPath} (${payload.length} payload chars)`,
  );
}
