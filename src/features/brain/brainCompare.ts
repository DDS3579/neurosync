import { ACTIVITY_META, ACTIVITY_REGION_MAP, BRAIN_REGIONS } from "@/data/brainRegions";
import type { ActivityKind, RegionId } from "@/types/domain";
import { INTERNAL_REGIONS, REGION_IDS, REGION_SLOTS } from "./regionZones";

export type CompareRegionStatus = "both" | "onlyA" | "onlyB" | "none";

export interface RegionComparisonItem {
  regionId: RegionId;
  name: string;
  weightA: number;
  weightB: number;
  status: CompareRegionStatus;
}

export interface ActivityComparison {
  activityA: ActivityKind;
  activityB: ActivityKind;
  sameActivity: boolean;
  items: RegionComparisonItem[];
  sharedRegions: RegionComparisonItem[];
  onlyARegions: RegionComparisonItem[];
  onlyBRegions: RegionComparisonItem[];
  byRegion: Record<RegionId, RegionComparisonItem>;
  summary: string;
}

export const ACTIVITY_COMPARE_OPTIONS: ReadonlyArray<{
  kind: ActivityKind;
  label: string;
  description: string;
}> = (Object.keys(ACTIVITY_META) as ActivityKind[]).map((kind) => ({
  kind,
  label: ACTIVITY_META[kind].label,
  description: ACTIVITY_META[kind].description,
}));

function weightMapForActivity(kind: ActivityKind): Map<RegionId, number> {
  const map = new Map<RegionId, number>();
  for (const entry of ACTIVITY_REGION_MAP[kind] ?? []) {
    if (entry.weight > 0) {
      map.set(entry.region, Math.min(1, Math.max(0, entry.weight)));
    }
  }
  return map;
}

function joinNatural(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function buildComparisonSummary(params: {
  activityA: ActivityKind;
  activityB: ActivityKind;
  sharedRegions: readonly RegionComparisonItem[];
  onlyARegions: readonly RegionComparisonItem[];
  onlyBRegions: readonly RegionComparisonItem[];
}): string {
  const { activityA, activityB, sharedRegions, onlyARegions, onlyBRegions } = params;
  const labelA = ACTIVITY_META[activityA].label;
  const labelB = ACTIVITY_META[activityB].label;

  if (activityA === activityB) {
    const involved = joinNatural(sharedRegions.map((r) => r.name));
    return involved
      ? `Both pickers show ${labelA}, which is commonly associated with ${involved}. Pick a second activity to compare shared and distinct regions.`
      : `Both pickers show ${labelA}. Pick a second activity to compare shared and distinct regions.`;
  }

  const sharedPart =
    sharedRegions.length > 0
      ? `Both ${labelA} and ${labelB} are commonly associated with ${joinNatural(sharedRegions.map((r) => r.name))}.`
      : `${labelA} and ${labelB} point to distinct primary regions in this educational atlas with no overlap.`;

  let distinctPart = "";
  if (onlyARegions.length > 0 && onlyBRegions.length > 0) {
    distinctPart = `${labelA} additionally highlights ${joinNatural(onlyARegions.map((r) => r.name))}, while ${labelB} uniquely emphasizes ${joinNatural(onlyBRegions.map((r) => r.name))}.`;
  } else if (onlyARegions.length > 0) {
    distinctPart = `${labelA} also includes ${joinNatural(onlyARegions.map((r) => r.name))}.`;
  } else if (onlyBRegions.length > 0) {
    distinctPart = `${labelB} also includes ${joinNatural(onlyBRegions.map((r) => r.name))}.`;
  } else {
    distinctPart = "Both activities map to the same set of regions here, with slightly different illustrative emphasis.";
  }

  return `${sharedPart} ${distinctPart}`;
}

/**
 * Pure comparison of two activities' illustrative region associations.
 */
export function compareActivities(
  activityA: ActivityKind,
  activityB: ActivityKind,
): ActivityComparison {
  const mapA = weightMapForActivity(activityA);
  const mapB = weightMapForActivity(activityB);

  const items: RegionComparisonItem[] = BRAIN_REGIONS.map((region) => {
    const weightA = mapA.get(region.id) ?? 0;
    const weightB = mapB.get(region.id) ?? 0;
    const status: CompareRegionStatus =
      weightA > 0 && weightB > 0
        ? "both"
        : weightA > 0
          ? "onlyA"
          : weightB > 0
            ? "onlyB"
            : "none";
    return {
      regionId: region.id,
      name: region.name,
      weightA,
      weightB,
      status,
    };
  });

  const sharedRegions = items
    .filter((item) => item.status === "both")
    .sort((a, b) => Math.max(b.weightA, b.weightB) - Math.max(a.weightA, a.weightB));

  const onlyARegions = items
    .filter((item) => item.status === "onlyA")
    .sort((a, b) => b.weightA - a.weightA);

  const onlyBRegions = items
    .filter((item) => item.status === "onlyB")
    .sort((a, b) => b.weightB - a.weightB);

  const byRegion = Object.fromEntries(
    items.map((item) => [item.regionId, item]),
  ) as Record<RegionId, RegionComparisonItem>;

  const summary = buildComparisonSummary({
    activityA,
    activityB,
    sharedRegions,
    onlyARegions,
    onlyBRegions,
  });

  return {
    activityA,
    activityB,
    sameActivity: activityA === activityB,
    items,
    sharedRegions,
    onlyARegions,
    onlyBRegions,
    byRegion,
    summary,
  };
}

/**
 * Converts two compared activities into fixed-length (REGION_SLOTS = 8) arrays
 * consumed by the 3D shader uniforms.
 */
export function compareToSlotWeights(
  activityA: ActivityKind,
  activityB: ActivityKind,
): {
  weightsA: number[];
  weightsB: number[];
  involvesDeep: boolean;
} {
  const mapA = weightMapForActivity(activityA);
  const mapB = weightMapForActivity(activityB);
  const weightsA = new Array<number>(REGION_SLOTS).fill(0);
  const weightsB = new Array<number>(REGION_SLOTS).fill(0);
  let involvesDeep = false;

  REGION_IDS.forEach((id, idx) => {
    const wa = mapA.get(id) ?? 0;
    const wb = mapB.get(id) ?? 0;
    weightsA[idx] = wa;
    weightsB[idx] = wb;
    if ((wa > 0 || wb > 0) && INTERNAL_REGIONS.has(id)) {
      involvesDeep = true;
    }
  });

  return { weightsA, weightsB, involvesDeep };
}

/**
 * Picks a sensible distinct partner activity when jumping into Compare mode
 * from a region panel's "Related activities" chip.
 */
export function pickDefaultComparePartner(
  primary: ActivityKind,
  currentPartner?: ActivityKind,
): ActivityKind {
  if (currentPartner && currentPartner !== primary) return currentPartner;
  const fallbackOrder: ActivityKind[] = ["mindfulness", "deep_focus", "exercise", "sleep_rest"];
  return fallbackOrder.find((candidate) => candidate !== primary) ?? "active_recall";
}
