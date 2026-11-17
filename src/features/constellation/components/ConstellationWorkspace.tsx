"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Orbit, Sparkles, Table as TableIcon } from "lucide-react";

import { usePanelLayout } from "@/components/floating";
import { PageHeader } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CONSTELLATION_CAVEAT,
  CONSTELLATION_WINDOW_OPTIONS,
  formatSameDayCount,
  getCoOccurrencesForNode,
  type ConstellationData,
  type ConstellationWindowDays,
} from "@/features/constellation/constellation";
import { ConstellationCanvas } from "./ConstellationCanvas";
import { ConstellationDetailPanel } from "./ConstellationDetailPanel";
import { ConstellationTableView } from "./ConstellationTableView";

export interface ConstellationWorkspaceProps {
  data: ConstellationData;
  windowDays: ConstellationWindowDays;
  onChangeWindowDays: (days: ConstellationWindowDays) => void;
  reducedMotion: boolean;
  onLoadDemo?: () => Promise<void>;
}

export function ConstellationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[460px] w-full rounded-card" />
    </div>
  );
}

export function ConstellationWorkspace({
  data,
  windowDays,
  onChangeWindowDays,
  reducedMotion,
  onLoadDemo,
}: ConstellationWorkspaceProps) {
  const [viewMode, setViewMode] = useState<"map" | "table">("map");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const selectedNode = useMemo(
    () => (selectedNodeId ? (data.nodes.find((n) => n.id === selectedNodeId) ?? null) : null),
    [data.nodes, selectedNodeId],
  );

  const handleSelectNode = useCallback((nextId: string | null) => {
    setSelectedNodeId(nextId);
    if (nextId) {
      usePanelLayout.getState().setMobileActivePanel("constellation-detail");
    } else {
      usePanelLayout.getState().setMobileActivePanel(null);
    }
  }, []);

  const handleLoadDemo = async () => {
    if (!onLoadDemo || loadingDemo) return;
    setLoadingDemo(true);
    try {
      await onLoadDemo();
    } finally {
      setLoadingDemo(false);
    }
  };

  const selectedAnnouncement = useMemo(() => {
    if (!selectedNode) return data.summaryText;
    const links = getCoOccurrencesForNode(selectedNode.id, data.nodes, data.edges, 3);
    const linkSummary =
      links.length > 0
        ? links.map((l) => `${l.label} (${formatSameDayCount(l.sharedDays)})`).join("; ")
        : "no connections with 3 or more shared days";
    return `Selected ${selectedNode.label}: present on ${selectedNode.daysPresent} days; ${linkSummary}.`;
  }, [data.edges, data.nodes, data.summaryText, selectedNode]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Constellation"
        description="Your habits and logged activities arranged by how often they happened on the same day."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={String(windowDays)}
              onValueChange={(v) => {
                const parsed = Number(v);
                if (parsed === 14 || parsed === 30 || parsed === 90) {
                  onChangeWindowDays(parsed);
                }
              }}
              variant="outline"
              size="sm"
              aria-label="Constellation time window"
            >
              {CONSTELLATION_WINDOW_OPTIONS.map((days) => (
                <ToggleGroupItem
                  key={days}
                  value={String(days)}
                  className="font-mono text-caption"
                >
                  {days}d
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {data.meetsMinDays ? (
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => {
                  if (v === "map" || v === "table") setViewMode(v);
                }}
                variant="outline"
                size="sm"
                aria-label="Constellation view mode"
              >
                <ToggleGroupItem value="map" aria-label="Starfield map view" className="gap-1.5 text-caption">
                  <Orbit className="size-3.5" aria-hidden />
                  <span>Map</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" className="gap-1.5 text-caption">
                  <TableIcon className="size-3.5" aria-hidden />
                  <span>Table</span>
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
          </div>
        }
      />

      <p className="sr-only" aria-live="polite">
        {selectedAnnouncement}
      </p>

      {!data.meetsMinDays ? (
        <section
          aria-label="Constellation minimum days requirement"
          className="rounded-card border border-border bg-surface p-6 sm:p-8"
        >
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-chip border border-cyan/30 bg-cyan/10 px-2.5 py-1 font-mono text-[11px] text-cyan tabular-nums">
              <Orbit className="size-3.5" aria-hidden />
              {data.activeDaysCount} of {data.minDaysRequired} logged days in {windowDays}d
            </div>

            <h2 className="text-section font-semibold text-foreground">
              The constellation opens once you have {data.minDaysRequired} days with logs
            </h2>
            <p className="text-body leading-relaxed text-muted-foreground">
              Same-day links are only meaningful with a few days of history behind them, so
              this map waits until at least {data.minDaysRequired} distinct days appear in the
              selected {windowDays}-day window (with at least 3 shared days before drawing a
              line between two items).
            </p>
            <p className="text-caption leading-relaxed text-muted-foreground">
              Log your daily habits, focus methods, movement, mindfulness sessions, or personal
              activities at your own pace.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button asChild size="sm" variant="outline" className="rounded-control">
                <Link href="/habits">Go to Daily Habits</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-control">
                <Link href="/focus">Open Focus Lab</Link>
              </Button>
              {!data.hasAnyData && onLoadDemo ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={loadingDemo}
                  onClick={handleLoadDemo}
                  className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  {loadingDemo ? "Loading demo data…" : "Load demo data"}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {/* Quiet informational status strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
            <p className="tabular-nums">
              Showing <span className="font-mono text-foreground">{data.nodes.length}</span>{" "}
              {data.nodes.length === 1 ? "entry" : "entries"} and{" "}
              <span className="font-mono text-foreground">{data.edges.length}</span> same-day{" "}
              {data.edges.length === 1 ? "connection" : "connections"} across{" "}
              <span className="font-mono text-cyan">{data.activeDaysCount}</span> logged days (
              {data.windowStart} → {data.windowEnd}).
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              Size & brightness = days present · Lines = 3+ same-day matches
            </p>
          </div>

          {viewMode === "map" ? (
            <ConstellationCanvas
              data={data}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectNode}
              reducedMotion={reducedMotion}
            />
          ) : (
            <ConstellationTableView
              data={data}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectNode}
            />
          )}
        </div>
      )}

      <p
        role="note"
        className="rounded-control border border-border bg-surface/60 px-3.5 py-2.5 text-caption text-muted-foreground"
      >
        {CONSTELLATION_CAVEAT}
      </p>

      {selectedNode ? (
        <ConstellationDetailPanel
          data={data}
          node={selectedNode}
          onSelectNode={handleSelectNode}
          onClose={() => handleSelectNode(null)}
        />
      ) : null}
    </div>
  );
}
