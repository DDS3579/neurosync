"use client";

import { CalendarClock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMinutes } from "@/features/planner/dayContext";
import type { NextBlockInfo } from "@/features/planner/nextBlock";
import { cn } from "@/lib/utils";
import type { TaskKind } from "@/types/domain";

const KIND_BADGE: Record<TaskKind, string> = {
  deep: "border-violet/50 bg-violet/20 text-violet-text",
  shallow: "border-cyan/45 bg-cyan/15 text-cyan",
  recovery: "border-success/45 bg-success/15 text-success",
};

const KIND_LABEL: Record<TaskKind, string> = { deep: "Deep", shallow: "Shallow", recovery: "Recovery" };

export interface NextBlockCardProps {
  info: NextBlockInfo;
  onStart?: (blockId: string) => void;
}

export function NextBlockCard({ info, onStart }: NextBlockCardProps) {
  return (
    <Card className="gap-0 rounded-card border border-border bg-surface py-0 ring-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
            <CalendarClock className="size-3.5" aria-hidden />
            {info.state === "in_progress" ? "In progress now" : "Next block"}
          </p>
          <p className="truncate text-section font-medium text-foreground">{info.title}</p>
          <p className="flex flex-wrap items-center gap-2 font-mono text-caption text-muted-foreground tabular-nums">
            <span className="text-cyan">
              {info.plannedStart}–{info.endsAt}
            </span>
            <span>{formatMinutes(info.plannedMin)}</span>
            <span className={cn("rounded-chip border px-1.5 py-0.5 text-[10px]", KIND_BADGE[info.kind])}>
              {KIND_LABEL[info.kind]}
            </span>
            {info.projectName ? <span className="truncate">{info.projectName}</span> : null}
          </p>
        </div>
        {onStart ? (
          <Button
            type="button"
            onClick={() => onStart(info.blockId)}
            aria-label={`Start ${info.title} in the Focus Lab`}
            className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
          >
            <Play className="size-4" aria-hidden />
            Start
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
