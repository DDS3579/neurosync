"use client";

import Link from "next/link";
import { Calendar, Orbit, Plus } from "lucide-react";

import { FloatingPanel, FloatingPanelLayer } from "@/components/floating";
import { Button } from "@/components/ui/button";
import {
  CONSTELLATION_CATEGORY_LABELS,
  CONSTELLATION_CAVEAT,
  formatSameDayCount,
  getCoOccurrencesForNode,
  type ConstellationData,
  type ConstellationNode,
} from "@/features/constellation/constellation";
import { cn } from "@/lib/utils";

export interface ConstellationDetailPanelProps {
  data: ConstellationData;
  node: ConstellationNode;
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
}

export function ConstellationDetailPanel({
  data,
  node,
  onSelectNode,
  onClose,
}: ConstellationDetailPanelProps) {
  const occurredDates = new Set(node.dates);
  const coOccurrences = getCoOccurrencesForNode(node.id, data.nodes, data.edges);
  const pctOfWindow = Math.round((node.daysPresent / data.windowDays) * 100);

  return (
    <FloatingPanelLayer
      className="z-40"
      mobileContainerClassName="bottom-20"
      onReturnFocusToCanvas={() => {
        const star = document.querySelector<HTMLElement>(
          `[data-star-id="${CSS.escape(node.id)}"]`,
        );
        star?.focus();
      }}
    >
      <FloatingPanel
        id="constellation-detail"
        title={node.label}
        chipLabel={node.label}
        icon={<Orbit className="size-3.5" aria-hidden />}
        defaultPosition={{ x: 980, y: 120 }}
        resolveDefaultPosition={(vp, size) => ({
          x: Math.max(16, vp.width - size.width - 24),
          y: Math.max(76, Math.round((vp.height - Math.max(size.height, 440)) / 2)),
        })}
        defaultSize={{ width: 356, height: 480 }}
        collapsible
        resizable
        onClose={onClose}
      >
        <div className="space-y-4">
          {/* Category + frequency summary */}
          <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
            <div>
              <span className="inline-flex rounded-chip border border-cyan/35 bg-cyan/10 px-2 py-0.5 font-mono text-[11px] text-cyan">
                {CONSTELLATION_CATEGORY_LABELS[node.category]}
              </span>
              <p className="mt-1.5 text-caption font-medium text-foreground tabular-nums">
                Present on {node.daysPresent} of {data.windowDays} days ({pctOfWindow}%)
              </p>
            </div>
            <Button
              asChild
              size="sm"
              className="h-8 shrink-0 gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
            >
              <Link href={node.logHref}>
                <Plus className="size-3.5" aria-hidden />
                Log now
              </Link>
            </Button>
          </div>

          {/* Mini calendar of occurred days in window */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-foreground">
                <Calendar className="size-3.5 text-cyan" aria-hidden />
                Days present ({data.windowDays}d)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {data.windowStart} → {data.windowEnd}
              </span>
            </div>

            <div
              role="grid"
              aria-label={`Days ${node.label} was logged in this ${data.windowDays}-day window`}
              style={{
                gridTemplateColumns:
                  data.windowDays === 90
                    ? "repeat(15, minmax(0, 1fr))"
                    : "repeat(7, minmax(0, 1fr))",
              }}
              className="grid gap-1 rounded-control border border-border bg-surface-2/60 p-2.5"
            >
              {data.datesInWindow.map((date) => {
                const active = occurredDates.has(date);
                const dayNum = date.slice(-2);
                return (
                  <div
                    key={date}
                    role="gridcell"
                    aria-label={`${date}: ${active ? "logged" : "not logged"}`}
                    title={`${date}: ${active ? "logged" : "not logged"}`}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-[4px] font-mono text-[10px] tabular-nums transition-colors",
                      active
                        ? "border border-cyan/50 bg-cyan/25 text-foreground"
                        : "border border-white/[0.06] bg-white/[0.02] text-muted-foreground/60",
                    )}
                  >
                    {data.windowDays <= 30 ? dayNum : ""}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Same-day co-occurring nodes */}
          <div className="space-y-2">
            <p className="text-caption font-medium text-foreground">
              Same-day links (3+ shared days)
            </p>
            {coOccurrences.length === 0 ? (
              <p className="rounded-control border border-border bg-surface-2/40 p-2.5 text-caption text-muted-foreground">
                No other entry shared at least 3 days with {node.label} in this window.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {coOccurrences.map((entry) => (
                  <li key={entry.nodeId}>
                    <button
                      type="button"
                      onClick={() => onSelectNode(entry.nodeId)}
                      className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface-2/60 px-2.5 py-2 text-left transition-colors hover:border-cyan/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="truncate text-caption font-medium text-foreground">
                        {entry.label}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-cyan tabular-nums">
                        {formatSameDayCount(entry.sharedDays)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p
            role="note"
            className="border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted-foreground"
          >
            {CONSTELLATION_CAVEAT}
          </p>
        </div>
      </FloatingPanel>
    </FloatingPanelLayer>
  );
}
