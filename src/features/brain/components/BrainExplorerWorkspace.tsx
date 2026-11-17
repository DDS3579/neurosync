"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeftRight,
  Compass,
  Eye,
  Layers,
  LocateFixed,
  Maximize2,
  RotateCcw,
  Scan,
} from "lucide-react";

import { useImmersiveBrain } from "@/components/app-shell/immersive-brain-context";
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
import type { BrainCameraAction } from "@/features/brain/BrainScene";
import {
  ACTIVITY_COMPARE_OPTIONS,
  compareActivities,
  pickDefaultComparePartner,
} from "@/features/brain/brainCompare";
import {
  BRAIN_SIZE_MAX,
  BRAIN_SIZE_MIN,
  BRAIN_SIZE_STEP,
  classifyWheelIntent,
  computeWheelSizeDelta,
  isTargetInsideBrainPanel,
  shouldHandleBrainShortcut,
} from "@/features/brain/brainControls";
import {
  CUT_AXIS_DEFAULTS,
  type BrainMode,
  type CrossSectionConfig,
  type CutPlaneAxis,
} from "@/features/brain/regionZones";
import {
  BRAIN_UI_PREFS_EVENT,
  DEFAULT_BRAIN_SIZE,
  UI_BRAIN_SIZE_KEY,
  readBrainSizePref,
  writeBrainSizePref,
} from "@/lib/ui/brainUiPrefs";
import { cn } from "@/lib/utils";
import type { ActivityKind, RegionId } from "@/types/domain";
import { BrainImmersivePanels } from "./BrainImmersivePanels";

const ACTIVITY_DISCLAIMER =
  "Educational association, not a measurement of your brain activity.";

const DynamicBrainExplorer = dynamic(
  () => import("@/features/brain/BrainExplorer").then((m) => m.BrainExplorer),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-full min-h-[460px] w-full rounded-xl border border-white/[0.08]" />
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

function subscribeBrainSizePref(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === UI_BRAIN_SIZE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BRAIN_UI_PREFS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BRAIN_UI_PREFS_EVENT, callback);
  };
}

function isAnyDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [data-slot="select-content"], [data-slot="sheet-content"], [data-slot="dialog-content"]',
    ),
  );
}

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
  const { isImmersive, enterImmersive, exitImmersive, openCommandPalette } =
    useImmersiveBrain();
  const stageContainerRef = useRef<HTMLDivElement>(null);

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

  const brainSize = useSyncExternalStore(
    subscribeBrainSizePref,
    readBrainSizePref,
    () => DEFAULT_BRAIN_SIZE,
  );
  const brainSizeRef = useRef(brainSize);
  useEffect(() => {
    brainSizeRef.current = brainSize;
  }, [brainSize]);

  const [cameraAction, setCameraAction] = useState<BrainCameraAction | null>(null);
  const actionNonceRef = useRef(0);

  const dispatchCameraAction = useCallback(
    (type: BrainCameraAction["type"], extra?: { dx?: number; dy?: number }) => {
      actionNonceRef.current += 1;
      setCameraAction({
        type,
        nonce: actionNonceRef.current,
        ...extra,
      });
    },
    [],
  );

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

  const openCompareWithActivity = useCallback((act: ActivityKind) => {
    setCompareA(act);
    setCompareB((prev) => pickDefaultComparePartner(act, prev));
    setIsolated(false);
    setSelectedRegion(null);
    setMode("compare");
  }, []);

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

  // Non-passive wheel listener: Ctrl+wheel / trackpad pinch changes brain scale (0.5x..2.0x)
  // without triggering browser page zoom, while floating panels scroll normally.
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      const intent = classifyWheelIntent({
        ctrlKey: event.ctrlKey,
        isOverPanel: isTargetInsideBrainPanel(event.target),
      });

      if (intent === "resize") {
        event.preventDefault();
        event.stopPropagation();
        const nextSize = computeWheelSizeDelta(event.deltaY, brainSizeRef.current);
        writeBrainSizePref(nextSize);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [isImmersive]);

  // Keyboard shortcuts: Esc exits immersive when canvas is focused and nothing is selected/open;
  // + / - zoom, 0 resets view, F fits to screen, arrow keys rotate.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isImmersive) return;
        const activeInPanel =
          typeof document !== "undefined" &&
          document.activeElement instanceof Element &&
          Boolean(document.activeElement.closest('[data-brain-panel="true"]'));
        if (activeInPanel || selectedRegion !== null || isolated || isAnyDialogOpen()) return;
        exitImmersive();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        !shouldHandleBrainShortcut({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          targetTagName: target?.tagName,
          targetRole: target?.getAttribute("role"),
          isContentEditable: target?.isContentEditable,
          isDialogOpen: isAnyDialogOpen(),
        })
      ) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        dispatchCameraAction("zoomIn");
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        dispatchCameraAction("zoomOut");
      } else if (event.key === "0") {
        event.preventDefault();
        dispatchCameraAction("reset");
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        dispatchCameraAction("fit");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        dispatchCameraAction("rotate", { dx: -0.22, dy: 0 });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        dispatchCameraAction("rotate", { dx: 0.22, dy: 0 });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        dispatchCameraAction("rotate", { dx: 0, dy: -0.18 });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        dispatchCameraAction("rotate", { dx: 0, dy: 0.18 });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatchCameraAction, exitImmersive, isImmersive, isolated, selectedRegion]);

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

  const modeToggle = (
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
  );

  const stageToolbar = (
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
  );

  const crossSectionControls = crossSection.enabled ? (
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
  ) : null;

  const regionChips = (
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
            className="shrink-0 rounded-chip"
          >
            {region.name}
          </Button>
        );
      })}
    </div>
  );

  const cameraControls = (
    <div
      aria-label="Camera and size controls"
      className={cn(
        "flex flex-wrap items-center gap-2",
        !isImmersive &&
          "rounded-control border border-border-strong bg-surface/90 px-3 py-2 shadow-lg backdrop-blur-md",
      )}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => dispatchCameraAction("fit")}
        title="Fit to screen (F)"
        aria-label="Fit to screen"
        className="h-7 gap-1 rounded-chip px-2 text-caption"
      >
        <Scan className="size-3.5 text-cyan" aria-hidden />
        <span>Fit</span>
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => dispatchCameraAction("reset")}
        title="Reset view (0)"
        aria-label="Reset view"
        className="h-7 gap-1 rounded-chip px-2 text-caption"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        <span>Reset</span>
      </Button>

      <div className="flex flex-1 items-center gap-2 pl-1">
        <label
          htmlFor="brain-size-slider"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          Size
        </label>
        <Slider
          id="brain-size-slider"
          aria-label="Brain size"
          min={BRAIN_SIZE_MIN}
          max={BRAIN_SIZE_MAX}
          step={BRAIN_SIZE_STEP}
          value={[brainSize]}
          onValueChange={(vals) => {
            const nextVal = vals[0];
            if (typeof nextVal !== "number") return;
            writeBrainSizePref(nextVal);
          }}
          className="min-w-20 flex-1 sm:w-24 sm:flex-none"
        />
        <span className="w-11 text-right font-mono text-caption text-cyan tabular-nums">
          {brainSize.toFixed(2)}x
        </span>
      </div>
    </div>
  );

  const modePanelContent = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          View mode
        </span>
        {modeToggle}
      </div>

      {showDisclaimer ? (
        <p
          role="note"
          className="rounded-control border border-cyan/30 bg-cyan/10 px-3 py-2 text-caption text-foreground"
        >
          {ACTIVITY_DISCLAIMER}
        </p>
      ) : null}

      <div className="border-t border-border pt-3">
        {stageToolbar}
        {crossSectionControls}
      </div>

      <div className="border-t border-border pt-3">
        {cameraControls}
      </div>
    </div>
  );

  const compareBlock =
    mode === "compare" ? (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-section font-medium text-foreground">Compare activities</h2>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="compare-activity-a"
              className="flex items-center gap-1.5 text-caption text-foreground"
            >
              <span aria-hidden className="inline-block size-2 rounded-full bg-violet" />
              Activity A (Violet)
            </Label>
            <Select value={compareA} onValueChange={(v) => setCompareA(v as ActivityKind)}>
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
              <span aria-hidden className="inline-block size-2 rounded-full bg-cyan" />
              Activity B (Cyan)
            </Label>
            <Select value={compareB} onValueChange={(v) => setCompareB(v as ActivityKind)}>
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
            <span aria-hidden className="size-2 rounded-full bg-[#E2E8FF]" />
            Shared overlap ({comparison.sharedRegions.length})
          </span>
        </div>

        <p className="text-body text-foreground/90">{comparison.summary}</p>

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
    ) : null;

  const regionBlock = regionInfo ? (
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
        <h2 className="text-section font-medium text-foreground">{regionInfo.name}</h2>
        <p className="text-body text-muted-foreground">{regionInfo.shortDescription}</p>
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
          Networks
        </h3>
        <ul className="flex flex-wrap gap-1.5">
          {regionInfo.networks.map((net) => (
            <li
              key={net}
              className="rounded-chip border border-border bg-surface-2 px-2.5 py-1 text-caption text-foreground/90"
            >
              {net}
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
    <div className="space-y-3">
      <div className="space-y-1.5">
        <h2 className="text-section font-medium text-foreground">Select a region</h2>
        <p className="text-body text-muted-foreground">
          Click any region on the 3D atlas or pick one below to inspect its networks,
          connected regions, and related everyday activities.
        </p>
      </div>
      {regionChips}
    </div>
  );

  const loggedActivitiesBlock = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="text-section font-medium text-foreground">Your logged activities</h2>
        <span className="font-mono text-caption text-muted-foreground tabular-nums">
          {windowStart} → {windowEnd}
        </span>
      </div>

      {loggedItems.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No focus, movement, sleep, or habit entries in the last 7 days yet. Log activities to
          light up Activity mode with educational associations.
        </p>
      ) : (
        <ul className="space-y-2">
          {loggedItems.map((item) => (
            <li key={item.kind} className="flex items-center justify-between gap-2 text-body">
              <span className="text-foreground">{item.label}</span>
              <span className="font-mono text-caption text-muted-foreground tabular-nums">
                {item.count} {item.count === 1 ? "entry" : "entries"} · {item.minutes}m
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border pt-3 text-caption text-muted-foreground">
        {ACTIVITY_DISCLAIMER}
      </p>
    </div>
  );

  const immersiveRegionContent = (
    <div className="space-y-5">
      {compareBlock ? (
        <div className="border-b border-border pb-5">{compareBlock}</div>
      ) : null}

      {regionInfo ? (
        <div className="space-y-2">
          <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Regions
          </span>
          {regionChips}
        </div>
      ) : null}

      {regionBlock}

      <div className="border-t border-border pt-5">{loggedActivitiesBlock}</div>
    </div>
  );

  return (
    <div
      className={
        isImmersive
          ? "fixed inset-0 z-30 h-dvh w-screen overflow-hidden bg-[#060913] transition-opacity duration-200 motion-reduce:transition-none"
          : "space-y-6 transition-opacity duration-200 motion-reduce:transition-none"
      }
    >
      {isImmersive ? (
        <h1 className="sr-only">Brain Explorer</h1>
      ) : (
        <PageHeader
          title="Brain Explorer"
          description="Seven regions with educational notes on networks and everyday activities. Nothing here measures your brain."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {modeToggle}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={enterImmersive}
                aria-label="Enter full-screen immersive mode"
                className="gap-1.5 rounded-control"
              >
                <Maximize2 className="size-3.5 text-cyan" aria-hidden />
                <span>Full-screen</span>
              </Button>
            </div>
          }
        />
      )}

      {!isImmersive && showDisclaimer ? (
        <p
          role="note"
          className="rounded-control border border-cyan/30 bg-cyan/10 px-4 py-2.5 text-caption text-foreground"
        >
          {ACTIVITY_DISCLAIMER}
        </p>
      ) : null}

      <div className={isImmersive ? "relative h-full w-full" : "grid gap-6 lg:grid-cols-12"}>
        <div className={isImmersive ? "h-full w-full" : "space-y-3 lg:col-span-7"}>
          <div
            ref={stageContainerRef}
            className={isImmersive ? "relative h-full w-full" : "relative"}
          >
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
              brainSize={brainSize}
              cameraAction={cameraAction}
              className={isImmersive ? "h-full w-full rounded-none border-0 sm:h-full" : undefined}
            />

            {!isImmersive ? (
              <div className="absolute right-3 bottom-3 z-10">{cameraControls}</div>
            ) : null}
          </div>

          {!isImmersive ? (
            <>
              <Card className="rounded-control border border-border bg-surface p-3.5 shadow-none">
                {stageToolbar}
                {crossSectionControls}
              </Card>
              {regionChips}
            </>
          ) : null}
        </div>

        {!isImmersive ? (
          <aside aria-label="Selected region details" className="space-y-4 lg:col-span-5">
            {compareBlock ? (
              <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
                {compareBlock}
              </Card>
            ) : null}
            <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
              {regionBlock}
            </Card>
            <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
              {loggedActivitiesBlock}
            </Card>
          </aside>
        ) : null}
      </div>

      {isImmersive ? (
        <BrainImmersivePanels
          onExitImmersive={exitImmersive}
          onOpenCommandPalette={openCommandPalette}
          modeContent={modePanelContent}
          regionContent={immersiveRegionContent}
        />
      ) : null}
    </div>
  );
}

export function BrainExplorerSkeleton() {
  const { isImmersive } = useImmersiveBrain();

  if (isImmersive) {
    return (
      <div
        aria-hidden
        className="fixed inset-0 z-30 flex h-dvh w-screen items-center justify-center bg-[#060913]"
      >
        <Skeleton className="h-40 w-40 rounded-full opacity-35" />
      </div>
    );
  }

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
