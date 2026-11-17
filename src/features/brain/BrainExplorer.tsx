"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo } from "react";

import { ACTIVITY_META, BRAIN_REGIONS } from "@/data/brainRegions";
import { cn } from "@/lib/utils";
import type { ActivityKind, RegionId } from "@/types/domain";
import { BrainFallback } from "./BrainFallback";
import type { BrainCameraAction } from "./BrainScene";
import { CUT_AXIS_DEFAULTS, type BrainMode, type CrossSectionConfig } from "./regionZones";
import {
  useBrainQuality,
  useBrainStage,
  useHighContrast,
  usePrefersReducedMotion,
  useTextSize,
  type QualityPref,
} from "./useBrainQuality";

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
  isolated?: boolean;
  onExitIsolation?: () => void;
  compare?: { activityA: ActivityKind; activityB: ActivityKind } | null;
  crossSection?: CrossSectionConfig | null;
  focusRequestKey?: number;
  onGlbStatusChange?: (hasGlb: boolean) => void;
  brainSize?: number;
  cameraAction?: BrainCameraAction | null;
}

const BrainExplorerCanvas = dynamic(
  () => import("./BrainScene").then((m) => m.BrainExplorerCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#060913] text-xs text-muted-foreground">
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
  isolated = false,
  onExitIsolation,
  compare = null,
  crossSection = null,
  focusRequestKey = 0,
  onGlbStatusChange,
  brainSize = 1,
  cameraAction = null,
}: BrainExplorerProps) {
  const qualityState = useBrainQuality(quality);
  const reducedMotion = usePrefersReducedMotion();
  const highContrast = useHighContrast();
  const textSize = useTextSize();
  const descriptionId = useId();
  const { ref, webgl, active, lost, markLost, retry } = useBrainStage<HTMLDivElement>();

  // Esc exits isolation first; otherwise clears the active region selection.
  useEffect(() => {
    if (!selectedRegion && !isolated) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isolated && onExitIsolation) {
        onExitIsolation();
      } else {
        onSelectRegion(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRegion, isolated, onExitIsolation, onSelectRegion]);

  const selectedInfo = selectedRegion
    ? BRAIN_REGIONS.find((r) => r.id === selectedRegion) ?? null
    : null;

  const canvasDescription = useMemo(() => {
    const modeLabel =
      mode === "anatomy"
        ? "Anatomy view"
        : mode === "functional"
          ? "Functional networks view showing connection arcs"
          : mode === "activity"
            ? "Activity associations view"
            : compare
              ? `Compare view showing ${ACTIVITY_META[compare.activityA].label} and ${ACTIVITY_META[compare.activityB].label}`
              : "Compare view";

    const parts: string[] = [
      `3D particle brain atlas in ${modeLabel}.`,
    ];

    if (selectedInfo) {
      parts.push(
        isolated
          ? `Isolated region: ${selectedInfo.name}. Other regions are faded out; press Escape to exit isolation.`
          : `Selected region: ${selectedInfo.name}. ${selectedInfo.shortDescription}`,
      );
    } else {
      parts.push("No region selected. Tab into the region list or pick a region below the canvas.");
    }

    if (crossSection?.enabled) {
      parts.push(
        `Cross-section cut enabled along ${CUT_AXIS_DEFAULTS[crossSection.axis].label} at position ${crossSection.position.toFixed(2)}, keeping hippocampus and amygdala visible.`,
      );
    }

    if (mode === "activity") {
      const highlighted = BRAIN_REGIONS.filter((r) => (activity[r.id] ?? 0) > 0)
        .map((r) => `${r.name} ${Math.round((activity[r.id] ?? 0) * 100)}%`)
        .join(", ");
      parts.push(
        highlighted
          ? `Active educational region associations: ${highlighted}.`
          : "No logged activity intensities yet.",
      );
    }

    return parts.join(" ");
  }, [activity, compare, crossSection, isolated, mode, selectedInfo]);

  const liveAnnouncement = selectedInfo
    ? isolated
      ? `${selectedInfo.name} isolated. Press Escape to exit isolation.`
      : `${selectedInfo.name} selected. ${selectedInfo.shortDescription}`
    : mode === "compare" && compare
      ? `Comparing ${ACTIVITY_META[compare.activityA].label} and ${ACTIVITY_META[compare.activityB].label}.`
      : "No brain region selected.";

  return (
    <div
      ref={ref}
      role="region"
      tabIndex={-1}
      aria-label="Interactive 3D brain atlas"
      aria-describedby={descriptionId}
      data-brain-canvas-focus="true"
      data-quality={qualityState.tier}
      data-high-contrast={highContrast ? "true" : "false"}
      data-text-size={textSize}
      className={cn(
        "relative h-[460px] w-full overflow-hidden rounded-xl border bg-[#060913] outline-none sm:h-[520px]",
        highContrast ? "border-border-strong" : "border-white/[0.08]",
        className,
      )}
    >
      <p id={descriptionId} className="sr-only">
        {canvasDescription}
      </p>

      {/* Keyboard-accessible region selector: stays offscreen until focused so focus rings are always visible. */}
      <nav
        aria-label="Brain regions"
        className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:inset-x-3 focus-within:top-3 focus-within:z-20 focus-within:rounded-control focus-within:border focus-within:border-border-strong focus-within:bg-surface/95 focus-within:p-2 focus-within:backdrop-blur-md"
      >
        <ul className="flex flex-wrap gap-1.5">
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
                  className={cn(
                    "rounded-chip border px-2.5 py-1 text-caption font-medium transition-colors",
                    isSelected
                      ? "border-cyan bg-cyan/15 text-foreground"
                      : "border-border bg-surface-2 text-foreground hover:border-border-strong",
                  )}
                >
                  {region.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {webgl === false || lost ? (
        <BrainFallback lost={lost} onRetry={retry} description={canvasDescription} />
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
          highContrast={highContrast}
          active={active}
          onContextLost={markLost}
          isolated={isolated}
          compare={compare}
          crossSection={crossSection}
          focusRequestKey={focusRequestKey}
          onGlbStatusChange={onGlbStatusChange}
          brainSize={brainSize}
          cameraAction={cameraAction}
        />
      ) : (
        <div className="h-full w-full bg-[#060913]" />
      )}

      {mode === "activity" || mode === "compare" ? (
        <p
          className={cn(
            "pointer-events-none absolute inset-x-3 bottom-16 text-center text-caption md:bottom-3",
            highContrast ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {ACTIVITY_DISCLAIMER}
        </p>
      ) : null}
    </div>
  );
}

export default BrainExplorer;
