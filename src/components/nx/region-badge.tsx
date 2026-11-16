import { BRAIN_REGIONS } from "@/data/brainRegions";
import type { RegionId } from "@/types/domain";

export interface RegionBadgeProps {
  region: RegionId;
}

/** One fixed dot colour per region, shared with the atlas palettes. */
const REGION_DOT_COLOR: Record<RegionId, string> = {
  prefrontal: "#8B5CF6",
  parietal: "#22D3EE",
  temporal: "#34D399",
  occipital: "#60A5FA",
  cerebellum: "#FBBF24",
  hippocampus: "#F472B6",
  amygdala: "#FB7185",
};

export function RegionBadge({ region }: RegionBadgeProps) {
  const info = BRAIN_REGIONS.find((entry) => entry.id === region);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border border-border bg-surface-2 px-2.5 py-1 text-caption text-muted-foreground">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: REGION_DOT_COLOR[region] }}
      />
      {info?.name ?? region}
    </span>
  );
}
