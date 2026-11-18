"use client";

import { useMemo, useState } from "react";
import { Info, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  INPUT_TYPE_LABELS,
  MICROTASKS_LABELS,
  PRACTICE_EFFECT_CAVEAT,
  TIME_OF_DAY_LABELS,
  buildMicrotaskTrend,
} from "@/features/focus/microtasks";
import type { MicrotaskKind, MicrotaskResult } from "@/types/domain";

export interface MicrotaskTrendsCardProps {
  results: readonly MicrotaskResult[];
  onDeleteResult?: (id: string) => Promise<void>;
}

const TASK_ORDER: readonly MicrotaskKind[] = [
  "reaction_time",
  "memory_span",
  "go_no_go",
];

const CHART_W = 640;
const CHART_H = 176;
const PAD_X = 36;
const PAD_Y = 20;

export function MicrotaskTrendsCard({
  results,
  onDeleteResult,
}: MicrotaskTrendsCardProps) {
  const [selectedTask, setSelectedTask] = useState<MicrotaskKind>("reaction_time");

  const trend = useMemo(
    () => buildMicrotaskTrend(results, selectedTask),
    [results, selectedTask],
  );

  const chartGeometry = useMemo(() => {
    const pts = trend.points;
    if (pts.length === 0) return null;
    const values = pts.map((p) => p.value);
    const minVal = Math.min(...values, trend.medianValue ?? values[0]!);
    const maxVal = Math.max(...values, trend.medianValue ?? values[0]!);
    const span = Math.max(1, maxVal - minVal);
    const yMin = Math.max(0, minVal - span * 0.18);
    const yMax = maxVal + span * 0.18;
    const ySpan = Math.max(1, yMax - yMin);

    const plotW = CHART_W - PAD_X * 2;
    const plotH = CHART_H - PAD_Y * 2;

    const coords = pts.map((pt, idx) => {
      const x =
        pts.length === 1
          ? CHART_W / 2
          : PAD_X + (idx / (pts.length - 1)) * plotW;
      const y = CHART_H - PAD_Y - ((pt.value - yMin) / ySpan) * plotH;
      return { ...pt, x, y };
    });

    const medianY =
      trend.medianValue !== null
        ? CHART_H - PAD_Y - ((trend.medianValue - yMin) / ySpan) * plotH
        : null;

    const pathD = coords
      .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");

    return { coords, medianY, pathD };
  }, [trend]);

  return (
    <Card className="space-y-4 border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-section font-semibold text-foreground">
            Personal trends
          </h3>
          <p className="text-caption text-muted-foreground">
            {trend.metricLabel} over time — compared only with your own history.
          </p>
        </div>

        <ToggleGroup
          type="single"
          value={selectedTask}
          onValueChange={(v) => {
            if (v === "reaction_time" || v === "memory_span" || v === "go_no_go") {
              setSelectedTask(v);
            }
          }}
          variant="outline"
          size="sm"
          aria-label="Trend task filter"
        >
          {TASK_ORDER.map((task) => (
            <ToggleGroupItem key={task} value={task} className="text-caption">
              {MICROTASKS_LABELS[task]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-control border border-border bg-surface-2/60 px-3.5 py-2.5 text-caption">
        <span className="font-mono text-muted-foreground tabular-nums">
          Sample size: <strong className="text-foreground">{trend.sampleSize}</strong>{" "}
          {trend.sampleSize === 1 ? "run" : "runs"}
        </span>
        <span className="font-mono text-cyan tabular-nums">
          Median:{" "}
          {trend.medianValue !== null
            ? `${trend.medianValue} ${trend.unit}`
            : "—"}
        </span>
      </div>

      {trend.points.length === 0 ? (
        <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-caption text-muted-foreground">
          No completed {MICROTASKS_LABELS[selectedTask].toLowerCase()} runs saved yet.
        </p>
      ) : (
        <div className="space-y-4">
          {chartGeometry ? (
            <div className="overflow-hidden rounded-control border border-border bg-[#060913] p-2">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                role="img"
                aria-label={`${MICROTASKS_LABELS[selectedTask]} trend across ${trend.sampleSize} runs, median ${trend.medianValue ?? "unavailable"} ${trend.unit}`}
                className="block h-auto w-full"
              >
                {chartGeometry.medianY !== null ? (
                  <>
                    <line
                      x1={PAD_X}
                      y1={chartGeometry.medianY}
                      x2={CHART_W - PAD_X}
                      y2={chartGeometry.medianY}
                      stroke="#8B5CF6"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      opacity={0.85}
                    />
                    <text
                      x={CHART_W - PAD_X}
                      y={Math.max(12, chartGeometry.medianY - 6)}
                      textAnchor="end"
                      fill="#C4B5FD"
                      fontSize={10}
                    >
                      Median {trend.medianValue} {trend.unit}
                    </text>
                  </>
                ) : null}

                {chartGeometry.coords.length > 1 ? (
                  <path
                    d={chartGeometry.pathD}
                    fill="none"
                    stroke="#22D3EE"
                    strokeWidth={2}
                    strokeOpacity={0.7}
                  />
                ) : null}

                {chartGeometry.coords.map((pt) => (
                  <g key={pt.id}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={4.5}
                      fill="#22D3EE"
                      stroke="#060913"
                      strokeWidth={1.5}
                    />
                    <title>
                      {pt.date}: {pt.value} {trend.unit} ({pt.secondaryLabel})
                    </title>
                  </g>
                ))}
              </svg>
            </div>
          ) : null}

          <div className="space-y-1.5">
            {[...trend.points].reverse().map((pt) => (
              <div
                key={pt.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-surface-2/50 px-3 py-2 text-caption"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium text-cyan tabular-nums">
                      {pt.value > 0 || selectedTask !== "go_no_go"
                        ? `${pt.value} ${trend.unit}`
                        : "—"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {pt.date}
                    </span>
                    <span className="rounded-chip border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {TIME_OF_DAY_LABELS[pt.timeOfDay]}
                    </span>
                    <span className="rounded-chip border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {INPUT_TYPE_LABELS[pt.inputType]}
                    </span>
                    {pt.restedRating ? (
                      <span className="rounded-chip border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        Rested {pt.restedRating}/5
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{pt.secondaryLabel}</p>
                </div>

                {onDeleteResult ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${MICROTASKS_LABELS[selectedTask]} run from ${pt.date}`}
                    onClick={() => onDeleteResult(pt.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        role="note"
        className="flex items-start gap-2 rounded-control border border-border bg-background/60 p-3 text-caption text-muted-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden />
        <p>{PRACTICE_EFFECT_CAVEAT}</p>
      </div>
    </Card>
  );
}
