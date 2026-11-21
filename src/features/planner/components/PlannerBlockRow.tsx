"use client";

import { memo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CircleDashed,
  GripVertical,
  Play,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMinutes } from "@/features/planner/dayContext";
import { cn } from "@/lib/utils";
import type { Block, Task, TaskKind, UserSettings } from "@/types/domain";

export const KIND_STYLE: Record<TaskKind, { label: string; glyph: string; badge: string; rail: string }> = {
  deep: { label: "Deep", glyph: "◆", badge: "border-violet/50 bg-violet/20 text-violet-text", rail: "bg-violet/70" },
  shallow: { label: "Shallow", glyph: "▤", badge: "border-cyan/45 bg-cyan/15 text-cyan", rail: "bg-cyan/70" },
  recovery: { label: "Recovery", glyph: "○", badge: "border-success/45 bg-success/15 text-success", rail: "bg-success/70" },
};

export interface PlannerBlockRowProps {
  block: Block;
  task?: Task;
  projectColor?: string;
  settings: UserSettings;
  context: "timeline" | "list" | "tray";
  busy: boolean;
  onStart: (block: Block, task: Task) => void;
  onComplete: (block: Block, title: string) => void;
  onSkip: (block: Block, title: string) => void;
  onTray: (block: Block, title: string) => void;
  onAddToDay: (block: Block, title: string) => void;
  onPlace: (block: Block, title: string, clock: string) => void;
  onArmPlace: (block: Block, title: string) => void;
  onNudge: (block: Block, title: string, deltaMin: number) => void;
  onBeginDrag: (event: React.PointerEvent<HTMLElement>, block: Block, title: string) => void;
}

/**
 * One block row. Memoised because a heavy day (200 blocks) re-renders the board
 * on every live-query tick; only rows whose props actually changed re-render.
 *
 * Every action exists as a button: drag is an optional pointer enhancement, and
 * Alt+ArrowUp / Alt+ArrowDown nudge a placed block on the snap grid.
 */
export const PlannerBlockRow = memo(function PlannerBlockRow({
  block,
  task,
  projectColor,
  settings,
  context,
  busy,
  onStart,
  onComplete,
  onSkip,
  onTray,
  onAddToDay,
  onPlace,
  onArmPlace,
  onNudge,
  onBeginDrag,
}: PlannerBlockRowProps) {
  const [clock, setClock] = useState<string>(block.plannedStart ?? "");
  const style = KIND_STYLE[task?.kind ?? "shallow"];
  const blockTitle = task?.title ?? "Untitled task";
  const finished = block.status === "done" || block.status === "skipped";
  const timeId = `block-clock-${block.id}`;
  const snap = Math.max(5, Math.round(settings.snapMin ?? 15));
  const pendingClock = clock || block.plannedStart || "";

  return (
    <li
      id={`block-row-${block.id}`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.altKey && event.key === "ArrowUp") {
          event.preventDefault();
          onNudge(block, blockTitle, -snap);
        } else if (event.altKey && event.key === "ArrowDown") {
          event.preventDefault();
          onNudge(block, blockTitle, snap);
        }
      }}
      className="relative overflow-hidden rounded-card border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", style.rail)} />
      <div className="flex flex-wrap items-center gap-2 pl-1.5">
        {!finished ? (
          <input
            type="checkbox"
            checked={false}
            aria-label={`Mark ${blockTitle} done`}
            onChange={() => onComplete(block, blockTitle)}
            className="size-4 shrink-0 accent-cyan"
          />
        ) : null}
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full border border-white/25"
          style={{ backgroundColor: projectColor ?? "rgba(255,255,255,0.2)" }}
        />
        <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{blockTitle}</span>
        <span className={cn("shrink-0 rounded-chip border px-1.5 py-0.5 font-mono text-[10px]", style.badge)}>
          <span aria-hidden className="mr-0.5">{style.glyph}</span>
          {style.label}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {block.plannedStart ? `${block.plannedStart} · ` : ""}
          {formatMinutes(block.plannedMin)}
        </span>
        {!finished ? (
          <span
            aria-hidden
            onPointerDown={(event) => onBeginDrag(event, block, blockTitle)}
            className="flex min-h-9 min-w-9 cursor-grab touch-none items-center justify-center rounded-control text-muted-foreground hover:text-foreground"
            title="Drag to a timeline slot"
          >
            <GripVertical className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-1.5">
        {finished ? (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {block.status === "done"
              ? `Done · ${formatMinutes(block.actualMin ?? block.plannedMin)}`
              : "Skipped for this day"}
          </span>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              disabled={busy || !task}
              onClick={() => task && onStart(block, task)}
              aria-label={`Start ${blockTitle} in the Focus Lab`}
              className="min-h-9 gap-1 rounded-control bg-violet px-2 text-caption text-white hover:bg-violet/90"
            >
              <Play className="size-3" aria-hidden />
              Start
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Skip ${blockTitle}`}
              onClick={() => onSkip(block, blockTitle)}
              className="min-h-9 gap-1 rounded-control px-2 text-caption text-muted-foreground"
            >
              <CircleDashed className="size-3" aria-hidden />
              Skip
            </Button>
            {context === "timeline" && block.plannedStart ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={`Move ${blockTitle} earlier by ${snap} minutes`}
                  onClick={() => onNudge(block, blockTitle, -snap)}
                  className="min-h-9 min-w-9 rounded-control"
                >
                  <ArrowUp className="size-3" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={`Move ${blockTitle} later by ${snap} minutes`}
                  onClick={() => onNudge(block, blockTitle, snap)}
                  className="min-h-9 min-w-9 rounded-control"
                >
                  <ArrowDown className="size-3" aria-hidden />
                </Button>
              </div>
            ) : null}
            {context !== "timeline" ? (
              <div className="flex items-end gap-1">
                <Label htmlFor={timeId} className="sr-only">
                  Start time for {blockTitle}
                </Label>
                <Input
                  id={timeId}
                  type="time"
                  step={snap * 60}
                  value={clock}
                  onChange={(event) => setClock(event.target.value)}
                  className="h-8 w-24 rounded-control border-border bg-surface-2 font-mono text-[11px] tabular-nums"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !pendingClock}
                  onClick={() => onPlace(block, blockTitle, pendingClock)}
                  className="min-h-9 rounded-control px-2 text-caption"
                >
                  Place
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onArmPlace(block, blockTitle)}
                  aria-label={`Pick a timeline slot for ${blockTitle}`}
                  className="min-h-9 gap-1 rounded-control px-2 text-caption"
                >
                  <Target className="size-3" aria-hidden />
                  Slots
                </Button>
              </div>
            ) : null}
            {context === "tray" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAddToDay(block, blockTitle)}
                className="min-h-9 rounded-control px-2 text-caption"
              >
                Add to day
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onTray(block, blockTitle)}
                className="min-h-9 gap-1 rounded-control px-2 text-caption text-muted-foreground"
              >
                <Archive className="size-3" aria-hidden />
                Tray
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
});
