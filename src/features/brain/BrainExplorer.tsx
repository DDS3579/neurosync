"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { BRAIN_REGIONS } from "@/data/brainRegions";
import { cn } from "@/lib/utils";
import type { RegionId } from "@/types/domain";
import { BrainFallback } from "./BrainFallback";
import type { BrainMode } from "./regionZones";
import { useBrainQuality, useBrainStage, usePrefersReducedMotion, type QualityPref } from "./useBrainQuality";

/* ------------------------------------------------------------------ */
/* PUBLIC CONSTANTS & TYPES                                            */
/* ------------------------------------------------------------------ */
export const ACTIVITY_DISCLAIMER = "Educational association, not a measurement of your brain activity.";

export interface BrainExplorerProps {
  mode: BrainMode;
  selectedRegion: RegionId | null;
  activity: Partial<Record<RegionId, number>>; // 0..1, drives 'activity' mode
  onSelectRegion: (id: RegionId | null) => void;
  onHoverRegion?: (id: RegionId | null) => void;
  quality?: QualityPref;
  className?: string;
}

const BrainExplorerCanvas = dynamic(
  () => import("./BrainScene").then((m) => m.BrainExplorerCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#060913] text-xs text-[#8A93AD]">
        Initializing 3D atlas…
      </div>
    ),
  },
);

export function BrainExplorer({
  mode,
  selectedRegion,
  activity,
  onSelectRegion,
  onHoverRegion,
  quality = "auto",
  className,
}: BrainExplorerProps) {
  const qualityState = useBrainQuality(quality);
  const reducedMotion = usePrefersReducedMotion();
  const { ref, webgl, active, lost, markLost, retry } = useBrainStage<HTMLDivElement>();

  // Esc clears the active region selection.
  useEffect(() => {
    if (!selectedRegion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelectRegion(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRegion, onSelectRegion]);

  const selectedInfo = selectedRegion
    ? BRAIN_REGIONS.find((r) => r.id === selectedRegion) ?? null
    : null;

  return (
    <div
      ref={ref}
      data-quality={qualityState.tier}
      className={cn(
        "relative h-[460px] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#060913] sm:h-[520px]",
        className,
      )}
    >
      {/* Screen-reader & keyboard navigation list (Tab through regions, Enter to toggle) */}
      <nav aria-label="Brain regions" className="sr-only">
        <ul>
          {BRAIN_REGIONS.map((region) => {
            const isSelected = selectedRegion === region.id;
            return (
              <li key={region.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectRegion(isSelected ? null : region.id)}
                  onFocus={() => onHoverRegion?.(region.id)}
                  onBlur={() => onHoverRegion?.(null)}
                >
                  {region.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div aria-live="polite" className="sr-only">
        {selectedInfo
          ? `${selectedInfo.name} selected. ${selectedInfo.shortDescription}`
          : "No brain region selected."}
      </div>

      {webgl === false || lost ? (
        <BrainFallback lost={lost} onRetry={retry} />
      ) : webgl === true ? (
        <BrainExplorerCanvas
          mode={mode}
          selectedRegion={selectedRegion}
          activity={activity}
          onSelectRegion={onSelectRegion}
          onHoverRegion={onHoverRegion}
          quality={qualityState}
          qualityPref={quality}
          reducedMotion={reducedMotion}
          active={active}
          onContextLost={markLost}
        />
      ) : (
        <div className="h-full w-full bg-[#060913]" />
      )}

      {mode === "activity" ? (
        <p className="pointer-events-none absolute inset-x-3 bottom-3 text-center text-[11px] text-[#8A93AD]">
          {ACTIVITY_DISCLAIMER}
        </p>
      ) : null}
    </div>
  );
}

export default BrainExplorer;
