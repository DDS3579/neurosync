"use client";

import { BRAIN_REGIONS } from "@/data/brainRegions";
import { cn } from "@/lib/utils";
import type { RegionId } from "@/types/domain";

export interface BrainExplorerProps {
  mode: "anatomy" | "functional" | "activity";
  selectedRegion: RegionId | null;
  activity: Partial<Record<RegionId, number>>; // 0..1, drives 'activity' mode
  onSelectRegion: (id: RegionId | null) => void;
  onHoverRegion?: (id: RegionId | null) => void;
  quality?: "auto" | "low" | "high";
  className?: string;
}

const MODE_LABEL: Record<BrainExplorerProps["mode"], string> = {
  anatomy: "Anatomy",
  functional: "Functional networks",
  activity: "Activity associations",
};

// TODO(stub): replaced by Opus output
export function BrainExplorer({
  mode,
  selectedRegion,
  activity,
  onSelectRegion,
  onHoverRegion,
  quality = "auto",
  className,
}: BrainExplorerProps) {
  const selected = selectedRegion
    ? BRAIN_REGIONS.find((region) => region.id === selectedRegion)
    : null;

  return (
    <div
      data-quality={quality}
      className={cn("flex flex-col gap-4 rounded-xl border border-border bg-surface p-4", className)}
    >
      <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/60 text-center">
        <p className="font-heading text-sm font-medium">{MODE_LABEL[mode]} view</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          3D viewport placeholder. Region links are educational associations, never measurements.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BRAIN_REGIONS.map((region) => {
          const intensity = activity[region.id];
          const isSelected = selectedRegion === region.id;

          return (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelectRegion(isSelected ? null : region.id)}
              onMouseEnter={() => onHoverRegion?.(region.id)}
              onMouseLeave={() => onHoverRegion?.(null)}
              aria-pressed={isSelected}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                isSelected
                  ? "border-violet/40 bg-violet/15 text-foreground"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
            >
              {region.name}
              {mode === "activity" && intensity !== undefined ? (
                <span className="ml-1.5 font-mono tabular-nums">
                  {Math.round(intensity * 100)}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-sm font-medium">{selected.name}</p>
          <p className="text-xs text-muted-foreground">{selected.shortDescription}</p>
          <p className="text-xs text-muted-foreground">{selected.caveat}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select a region to read its educational note.</p>
      )}
    </div>
  );
}
