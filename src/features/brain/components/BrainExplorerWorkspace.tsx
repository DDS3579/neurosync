"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeftRight,
  Compass,
  Eye,
  Layers,
  LocateFixed,
  RotateCcw,
} from "lucide-react";

import { PageHeader, RegionBadge } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACTIVITY_META, BRAIN_REGIONS } from "@/data/brainRegions";
import type { LoggedActivitySummary } from "@/features/brain/brainActivity";
import {
  ACTIVITY_COMPARE_OPTIONS,
  compareActivities,
  pickDefaultComparePartner,
} from "@/features/brain/brainCompare";
import {
  CUT_AXIS_DEFAULTS,
  type BrainMode,
  type CrossSectionConfig,
  type CutPlaneAxis,
} from "@/features/brain/regionZones";
import { cn } from "@/lib/utils";
import type { ActivityKind, RegionId } from "@/types/domain";

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
  { value: "compare", label: "Compare" },
];

const CUT_AXES: readonly CutPlaneAxis[] = ["y", "x", "z"];

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
  const [isolated, setIsolated] = useState(false);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [compareA, setCompareA] = useState<ActivityKind>("deep_focus");
  const [compareB, setCompareB] = useState<ActivityKind>("mindfulness");
  const [hasGlb, setHasGlb] = useState(false);
  const [crossSection, setCrossSection] = useState<CrossSectionConfig>({
    enabled: false,
    axis: "y",
    position: CUT_AXIS_DEFAULTS.y.defaultPos,
  });

  const handleSelectRegion = useCallback((next: RegionId | null) => {
    setSelectedRegion(next);
    if (!next) setIsolated(false);
  }, []);

  const selectAndFlyToRegion = useCallback((region: RegionId) => {
    setSelectedRegion(region);
    setFocusRequestKey((k) => k + 1);
  }, []);

  const handleExitIsolation = useCallback(() => {
    setIsolated(false);
  }, []);

  const openCompareWithActivity = useCallback(
    (act: ActivityKind) => {
      setCompareA(act);
      setCompareB((prev) => pickDefaultComparePartner(act, prev));
      setIsolated(false);
      setSelectedRegion(null);
      setMode("compare");
    },
    [],
  );

  const handleModeChange = useCallback((next: string) => {
    if (!next) return;
    const nextMode = next as BrainMode;
    setMode(nextMode);
    if (nextMode === "compare") {
      setIsolated(false);
    }
  }, []);

  const handleToggleCrossSection = useCallback(() => {
    setCrossSection((prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  }, []);

  const handleChangeCutAxis = useCallback((axis: string) => {
    if (!axis) return;
    const typed = axis as CutPlaneAxis;
    setCrossSection((prev) => ({
      ...prev,
      axis: typed,
      position: CUT_AXIS_DEFAULTS[typed].defaultPos,
    }));
  }, []);

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

  const comparison = useMemo(
    () => compareActivities(compareA, compareB),
    [compareA, compareB],
  );

  const showDisclaimer = mode === "activity" || mode === "compare";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brain Explorer"
        description="Seven regions with educational notes on networks and everyday activities. Nothing here measures your brain."
        actions={
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={handleModeChange}
            variant="outline"
            size="sm"
            aria-label="Brain explorer mode"
            className="flex-wrap"
          >
            {MODES.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      {showDisclaimer ? (
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
            onSelectRegion={handleSelectRegion}
            quality="auto"
            isolated={isolated}
            onExitIsolation={handleExitIsolation}
            compare={mode === "compare" ? { activityA: compareA, activityB: compareB } : null}
            crossSection={crossSection}
            focusRequestKey={focusRequestKey}
            onGlbStatusChange={setHasGlb}
          />

          {/* Stage toolbar: isolation + cross-section controls */}
          <Card className="rounded-control border border-border bg-surface p-3.5 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isolated ? "default" : "outline"}
                  aria-pressed={isolated}
                  disabled={!selectedRegion}
                  onClick={() => setIsolated((prev) => !prev)}
                  className={cn(
                    "gap-1.5 rounded-chip",
                    isolated && "bg-violet text-white hover:bg-violet/90",
                  )}
                >
                  <Eye className="size-3.5" aria-hidden />
                  {isolated ? "Exit isolation" : "Isolate region"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={crossSection.enabled ? "default" : "outline"}
                  aria-pressed={crossSection.enabled}
                  onClick={handleToggleCrossSection}
                  className={cn(
                    "gap-1.5 rounded-chip",
                    crossSection.enabled && "bg-cyan text-[#060913] hover:bg-cyan/90",
                  )}
                >
                  <Layers className="size-3.5" aria-hidden />
                  Cross-section
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                {isolated && regionInfo ? (
                  <span>
                    Showing only <span className="text-foreground">{regionInfo.name}</span> · Esc to exit
                  </span>
                ) : selectedRegion ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => selectAndFlyToRegion(selectedRegion)}
                    className="h-7 gap-1 px-2 text-caption text-muted-foreground hover:text-foreground"
                  >
                    <LocateFixed className="size-3.5" aria-hidden />
                    Refocus
                  </Button>
                ) : (
                  <span>Select a region to isolate or inspect</span>
                )}
              </div>
            </div>

            {crossSection.enabled ? (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ToggleGroup
                    type="single"
                    value={crossSection.axis}
                    onValueChange={handleChangeCutAxis}
                    variant="outline"
                    size="sm"
                    aria-label="Cross-section plane axis"
                  >
                    {CUT_AXES.map((axis) => (
                      <ToggleGroupItem key={axis} value={axis}>
                        {CUT_AXIS_DEFAULTS[axis].shortLabel}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => selectAndFlyToRegion("hippocampus")}
                      className="h-7 px-2 text-caption text-cyan hover:text-cyan"
                    >
                      Locate hippocampus
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => selectAndFlyToRegion("amygdala")}
                      className="h-7 px-2 text-caption text-cyan hover:text-cyan"
                    >
                      Locate amygdala
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Reset cross-section slider"
                      onClick={() =>
                        setCrossSection((prev) => ({
                          ...prev,
                          position: CUT_AXIS_DEFAULTS[prev.axis].defaultPos,
                        }))
                      }
                      className="h-7 px-2 text-caption text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-caption">
                    <label htmlFor="cross-section-slider" className="text-muted-foreground">
                      {hasGlb ? "Clipping plane depth" : "Particle cut plane"} ·{" "}
                      {CUT_AXIS_DEFAULTS[crossSection.axis].label}
                    </label>
                    <span className="font-mono text-cyan tabular-nums">
                      {crossSection.position.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    id="cross-section-slider"
                    aria-label="Cross-section cut position"
                    min={-0.9}
                    max={0.9}
                    step={0.02}
                    value={[crossSection.position]}
                    onValueChange={(vals) => {
                      const nextVal = vals[0];
                      if (typeof nextVal !== "number") return;
                      setCrossSection((prev) => ({ ...prev, position: nextVal }));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {hasGlb
                      ? "Segmented mesh clipping reveals internal clusters."
                      : "Fades outer cortex particles beyond the plane."}{" "}
                    Hippocampus and amygdala remain visible inside the cut.
                  </p>
                </div>
              </div>
            ) : null}
          </Card>

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
                  onClick={() => handleSelectRegion(selected ? null : region.id)}
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
          {mode === "compare" ? (
            <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h2 className="text-section font-medium text-foreground">
                      Compare activities
                    </h2>
                    <p className="text-caption text-muted-foreground">
                      Side-by-side educational region associations
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Swap compared activities"
                    onClick={() => {
                      setCompareA(compareB);
                      setCompareB(compareA);
                    }}
                    className="gap-1 rounded-chip text-caption"
                  >
                    <ArrowLeftRight className="size-3.5" aria-hidden />
                    Swap
                  </Button>
                </div>

                {/* Two activity pickers */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="compare-activity-a"
                      className="flex items-center gap-1.5 text-caption text-foreground"
                    >
                      <span
                        aria-hidden
                        className="inline-block size-2 rounded-full bg-violet"
                      />
                      Activity A (Violet)
                    </Label>
                    <Select
                      value={compareA}
                      onValueChange={(v) => setCompareA(v as ActivityKind)}
                    >
                      <SelectTrigger
                        id="compare-activity-a"
                        aria-label="First activity to compare"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_COMPARE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.kind} value={opt.kind}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="compare-activity-b"
                      className="flex items-center gap-1.5 text-caption text-foreground"
                    >
                      <span
                        aria-hidden
                        className="inline-block size-2 rounded-full bg-cyan"
                      />
                      Activity B (Cyan)
                    </Label>
                    <Select
                      value={compareB}
                      onValueChange={(v) => setCompareB(v as ActivityKind)}
                    >
                      <SelectTrigger
                        id="compare-activity-b"
                        aria-label="Second activity to compare"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_COMPARE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.kind} value={opt.kind}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Color legend */}
                <div className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface-2 px-3 py-2 text-caption text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-full bg-violet" />
                    {ACTIVITY_META[compareA].label}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-full bg-cyan" />
                    {ACTIVITY_META[compareB].label}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-[#E2E8FF]"
                    />
                    Shared overlap ({comparison.sharedRegions.length})
                  </span>
                </div>

                {/* Plain-language summary */}
                <p className="text-body text-foreground/90">{comparison.summary}</p>

                {/* Overlap strip */}
                {comparison.sharedRegions.length > 0 ? (
                  <div className="space-y-1.5">
                    <h3 className="font-mono text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Shared overlap
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {comparison.sharedRegions.map((item) => (
                        <Button
                          key={item.regionId}
                          type="button"
                          size="sm"
                          variant={selectedRegion === item.regionId ? "default" : "outline"}
                          onClick={() => selectAndFlyToRegion(item.regionId)}
                          className="rounded-chip border-[#E2E8FF]/30 text-caption"
                        >
                          {item.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Side-by-side column breakdown */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-control border border-violet/30 bg-surface-2/70 p-3">
                    <div className="flex items-center gap-1.5 text-caption font-medium text-foreground">
                      <span aria-hidden className="size-2 rounded-full bg-violet" />
                      {ACTIVITY_META[compareA].label}
                    </div>
                    <ul className="space-y-1.5">
                      {comparison.items
                        .filter((item) => item.weightA > 0)
                        .sort((a, b) => b.weightA - a.weightA)
                        .map((item) => (
                          <li key={item.regionId}>
                            <button
                              type="button"
                              onClick={() => selectAndFlyToRegion(item.regionId)}
                              className="w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-white/[0.04]"
                            >
                              <div className="flex items-center justify-between gap-2 text-caption">
                                <span className="truncate text-foreground">{item.name}</span>
                                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                  {item.status === "both" ? "Shared" : "Only A"}
                                </span>
                              </div>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    item.status === "both" ? "bg-[#E2E8FF]" : "bg-violet",
                                  )}
                                  style={{ width: `${Math.round(item.weightA * 100)}%` }}
                                />
                              </div>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>

                  <div className="space-y-2 rounded-control border border-cyan/30 bg-surface-2/70 p-3">
                    <div className="flex items-center gap-1.5 text-caption font-medium text-foreground">
                      <span aria-hidden className="size-2 rounded-full bg-cyan" />
                      {ACTIVITY_META[compareB].label}
                    </div>
                    <ul className="space-y-1.5">
                      {comparison.items
                        .filter((item) => item.weightB > 0)
                        .sort((a, b) => b.weightB - a.weightB)
                        .map((item) => (
                          <li key={item.regionId}>
                            <button
                              type="button"
                              onClick={() => selectAndFlyToRegion(item.regionId)}
                              className="w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-white/[0.04]"
                            >
                              <div className="flex items-center justify-between gap-2 text-caption">
                                <span className="truncate text-foreground">{item.name}</span>
                                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                  {item.status === "both" ? "Shared" : "Only B"}
                                </span>
                              </div>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    item.status === "both" ? "bg-[#E2E8FF]" : "bg-cyan",
                                  )}
                                  style={{ width: `${Math.round(item.weightB * 100)}%` }}
                                />
                              </div>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                <p className="border-t border-border pt-3 text-caption text-muted-foreground">
                  {ACTIVITY_DISCLAIMER}
                </p>
              </div>
            </Card>
          ) : null}

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
                    {regionInfo.connectedTo.map((connId) => {
                      const connName = regionNameById.get(connId) ?? connId;
                      return (
                        <Button
                          key={connId}
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Inspect and fly camera to ${connName}`}
                          onClick={() => selectAndFlyToRegion(connId)}
                          className="gap-1.5 rounded-chip text-caption"
                        >
                          <Compass className="size-3 text-cyan" aria-hidden />
                          {connName}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-mono text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Related activities
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {regionInfo.relatedActivities.map((act) => (
                      <Button
                        key={act}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Compare ${ACTIVITY_META[act].label} with another activity`}
                        onClick={() => openCompareWithActivity(act)}
                        className="gap-1.5 rounded-chip border-border bg-surface-2 text-caption text-foreground hover:border-violet/50 hover:text-foreground"
                      >
                        <ArrowLeftRight className="size-3 text-violet-text" aria-hidden />
                        {ACTIVITY_META[act].label}
                      </Button>
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
