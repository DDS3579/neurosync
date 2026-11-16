"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { PageHeader, RegionBadge } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACTIVITY_META, BRAIN_REGIONS } from "@/data/brainRegions";
import type { LoggedActivitySummary } from "@/features/brain/brainActivity";
import type { BrainMode } from "@/features/brain/regionZones";
import type { RegionId } from "@/types/domain";

const ACTIVITY_DISCLAIMER =
  "Educational association, not a measurement of your brain activity.";

const DynamicBrainExplorer = dynamic(
  () => import("@/features/brain").then((m) => m.BrainExplorer),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-[460px] w-full rounded-xl border border-white/[0.08] sm:h-[520px]" />
    ),
  },
);

const MODES: ReadonlyArray<{ value: BrainMode; label: string }> = [
  { value: "anatomy", label: "Anatomy" },
  { value: "functional", label: "Functional" },
  { value: "activity", label: "Activity" },
];

export interface BrainExplorerWorkspaceProps {
  activity: Partial<Record<RegionId, number>>;
  loggedItems: LoggedActivitySummary[];
  windowStart: string;
  windowEnd: string;
}

export function BrainExplorerWorkspace({
  activity,
  loggedItems,
  windowStart,
  windowEnd,
}: BrainExplorerWorkspaceProps) {
  const [mode, setMode] = useState<BrainMode>("anatomy");
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>("prefrontal");

  const regionInfo = useMemo(
    () =>
      selectedRegion
        ? (BRAIN_REGIONS.find((r) => r.id === selectedRegion) ?? null)
        : null,
    [selectedRegion],
  );

  const regionNameById = useMemo(
    () => new Map(BRAIN_REGIONS.map((r) => [r.id, r.name])),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brain Explorer"
        description="Seven regions with educational notes on networks and everyday activities. Nothing here measures your brain."
        actions={
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(next) => {
              if (next) setMode(next as BrainMode);
            }}
            variant="outline"
            size="sm"
            aria-label="Brain explorer mode"
          >
            {MODES.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      {mode === "activity" ? (
        <p
          role="note"
          className="rounded-control border border-cyan/30 bg-cyan/10 px-4 py-2.5 text-caption text-foreground"
        >
          {ACTIVITY_DISCLAIMER}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <DynamicBrainExplorer
            mode={mode}
            selectedRegion={selectedRegion}
            activity={activity}
            onSelectRegion={setSelectedRegion}
            quality="auto"
          />

          {/* Accessible quick-pick chips */}
          <div
            role="group"
            aria-label="Select a brain region"
            className="flex flex-wrap gap-1.5"
          >
            {BRAIN_REGIONS.map((region) => {
              const selected = selectedRegion === region.id;
              return (
                <Button
                  key={region.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() => setSelectedRegion(selected ? null : region.id)}
                  className="rounded-chip"
                >
                  {region.name}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <aside aria-label="Selected region details" className="space-y-4 lg:col-span-5">
          <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
            {regionInfo ? (
              <div className="space-y-5">
                <div className="space-y-2 border-b border-border pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <RegionBadge region={regionInfo.id} />
                    {mode === "activity" ? (
                      <span className="font-mono text-caption text-cyan tabular-nums">
                        Index {Math.round((activity[regionInfo.id] ?? 0) * 100)}%
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-section font-medium text-foreground">
                    {regionInfo.name}
                  </h2>
                  <p className="text-body text-muted-foreground">
                    {regionInfo.shortDescription}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-mono text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Common associations
                  </h3>
                  <ul className="space-y-1.5 text-body text-foreground/90">
                    {regionInfo.associatedWith.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden className="text-cyan">
                          ·
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-mono text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Connected regions
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {regionInfo.connectedTo.map((connId) => (
                      <Button
                        key={connId}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRegion(connId)}
                        className="rounded-chip text-caption"
                      >
                        {regionNameById.get(connId) ?? connId}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-mono text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Related activities
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {regionInfo.relatedActivities.map((act) => (
                      <span
                        key={act}
                        className="rounded-chip border border-border bg-surface-2 px-2.5 py-1 text-caption text-muted-foreground"
                      >
                        {ACTIVITY_META[act].label}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="border-t border-border pt-3 text-caption text-muted-foreground">
                  {regionInfo.caveat}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-section font-medium text-foreground">
                  Select a region
                </h2>
                <p className="text-body text-muted-foreground">
                  Click any region on the 3D atlas or choose one below to inspect its networks,
                  connected regions, and related everyday activities.
                </p>
              </div>
            )}
          </Card>

          <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <h2 className="text-section font-medium text-foreground">
                Your logged activities
              </h2>
              <span className="font-mono text-caption text-muted-foreground tabular-nums">
                {windowStart} → {windowEnd}
              </span>
            </div>

            {loggedItems.length === 0 ? (
              <p className="mt-3 text-body text-muted-foreground">
                No focus, movement, sleep, or habit entries in the last 7 days yet. Log activities
                to light up Activity mode with educational associations.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {loggedItems.map((item) => (
                  <li
                    key={item.kind}
                    className="flex items-center justify-between gap-2 text-body"
                  >
                    <span className="text-foreground">{item.label}</span>
                    <span className="font-mono text-caption text-muted-foreground tabular-nums">
                      {item.count} {item.count === 1 ? "entry" : "entries"} · {item.minutes}m
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
              {ACTIVITY_DISCLAIMER}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function BrainExplorerSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[520px] rounded-xl lg:col-span-7" />
        <Skeleton className="h-[520px] rounded-card lg:col-span-5" />
      </div>
    </div>
  );
}
