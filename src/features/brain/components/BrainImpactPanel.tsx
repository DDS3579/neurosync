"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAIN_REGIONS } from "@/data/brainRegions";
import {
  getRegionImpactContributions,
  rankLoggedActivitiesForImpact,
  type LoggedActivitySummary,
} from "@/features/brain/brainActivity";
import { cn } from "@/lib/utils";
import type { ActivityKind, RegionId } from "@/types/domain";

export const IMPACT_DISCLAIMER =
  "Educational association, not a measurement of your brain activity.";

export interface BrainImpactPanelProps {
  selectedRegion: RegionId | null;
  items: readonly LoggedActivitySummary[];
  windowDays: 7 | 30;
  windowStart: string;
  windowEnd: string;
  activeDateLabel?: string;
  highlightedActivity: ActivityKind | null;
  onHighlightActivity: (kind: ActivityKind | null) => void;
  onClearSelectedRegion?: () => void;
  hasAnyData: boolean;
  onLoadDemo?: () => Promise<void>;
}

const REGION_NAME_BY_ID = new Map(BRAIN_REGIONS.map((r) => [r.id, r.name]));

export function BrainImpactPanel({
  selectedRegion,
  items,
  windowDays,
  windowStart,
  windowEnd,
  activeDateLabel,
  highlightedActivity,
  onHighlightActivity,
  onClearSelectedRegion,
  hasAnyData,
  onLoadDemo,
}: BrainImpactPanelProps) {
  const [loadingDemo, setLoadingDemo] = useState(false);

  const rankedActivities = useMemo(() => rankLoggedActivitiesForImpact(items), [items]);
  const regionContributions = useMemo(
    () =>
      selectedRegion ? getRegionImpactContributions(selectedRegion, items) : [],
    [selectedRegion, items],
  );

  const selectedRegionName = selectedRegion
    ? (REGION_NAME_BY_ID.get(selectedRegion) ?? selectedRegion)
    : null;

  const handleLoadDemo = async () => {
    if (!onLoadDemo || loadingDemo) return;
    setLoadingDemo(true);
    try {
      await onLoadDemo();
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
            {selectedRegionName
              ? `Region · ${selectedRegionName}`
              : `Logged window · ${windowDays}d`}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {activeDateLabel ?? `${windowStart} → ${windowEnd}`}
          </p>
        </div>

        {selectedRegion && onClearSelectedRegion ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClearSelectedRegion}
            className="h-7 px-2 text-caption text-muted-foreground hover:text-foreground"
          >
            All activities
          </Button>
        ) : highlightedActivity ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onHighlightActivity(null)}
            className="h-7 px-2 text-caption text-cyan hover:text-cyan"
          >
            Clear filter
          </Button>
        ) : null}
      </div>

      {selectedRegion ? (
        regionContributions.length === 0 ? (
          <div className="space-y-3 py-1">
            <p className="text-caption leading-relaxed text-muted-foreground">
              No activities commonly associated with {selectedRegionName} appear in this view
              based on what you logged. Log focus sessions, movement, sleep, mindfulness, or
              personal activities to explore educational region links.
            </p>
            {!hasAnyData && onLoadDemo ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingDemo}
                onClick={handleLoadDemo}
                className="gap-1.5 rounded-control text-caption"
              >
                <Sparkles className="size-3.5 text-cyan" aria-hidden />
                {loadingDemo ? "Loading demo data…" : "Load demo data"}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-caption text-muted-foreground">
              Logged activities commonly associated with {selectedRegionName}, ranked by
              weighted share based on what you logged:
            </p>
            <ul className="space-y-2.5">
              {regionContributions.map((entry) => {
                const sharePct = Math.round(entry.share * 100);
                return (
                  <li
                    key={entry.kind}
                    className="space-y-1.5 rounded-control border border-border bg-surface-2/60 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-medium text-foreground">
                        {entry.label}
                      </span>
                      <span className="font-mono text-[11px] text-cyan tabular-nums">
                        {entry.minutes}m · {sharePct}% share
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-cyan"
                        style={{ width: `${Math.max(4, sharePct)}%` }}
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {entry.explanation}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : rankedActivities.length === 0 ? (
        <div className="space-y-3 py-1">
          <p className="text-caption leading-relaxed text-muted-foreground">
            Nothing logged in this {windowDays}-day window yet. Log a focus session, movement,
            sleep, mindfulness, or personal activity to see which brain regions they are
            commonly associated with based on what you logged.
          </p>
          {!hasAnyData && onLoadDemo ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingDemo}
              onClick={handleLoadDemo}
              className="gap-1.5 rounded-control text-caption"
            >
              <Sparkles className="size-3.5 text-cyan" aria-hidden />
              {loadingDemo ? "Loading demo data…" : "Load demo data"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-caption text-muted-foreground">
            Ranked by minutes based on what you logged. Select an activity to highlight the
            regions it is commonly associated with:
          </p>
          <ul className="space-y-2">
            {rankedActivities.map((item) => {
              const active = highlightedActivity === item.kind;
              return (
                <li key={item.kind}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onHighlightActivity(active ? null : item.kind)}
                    className={cn(
                      "w-full space-y-2 rounded-control border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active
                        ? "border-cyan/60 bg-cyan/10"
                        : "border-border bg-surface-2/60 hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-caption font-medium text-foreground">
                        {item.label}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                        {item.minutes}m · {item.count} {item.count === 1 ? "log" : "logs"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {item.regions.map((reg) => (
                        <div key={reg.region} className="flex items-center gap-2 text-[11px]">
                          <span className="w-28 shrink-0 truncate text-muted-foreground">
                            {reg.regionName}
                          </span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                active ? "bg-cyan" : "bg-violet",
                              )}
                              style={{ width: `${Math.round(reg.weight * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p
        role="note"
        className="border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted-foreground"
      >
        {IMPACT_DISCLAIMER}
      </p>
    </div>
  );
}
