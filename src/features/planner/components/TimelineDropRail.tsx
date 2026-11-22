"use client";

import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TimelineDropRailProps {
  /** Task title of the block being placed (for labels). */
  title: string;
  clocks: readonly string[];
  activeClock?: string | null;
  busy?: boolean;
  onPlace: (clock: string) => void;
  onCancel: () => void;
}

/**
 * Drop targets for the day's open timeline. Loaded with a dynamic import from
 * PlannerTodayPanel, so pointer-drag support is code-split out of the base
 * planner chunk. Every slot is also a real button: tap-to-place and the
 * keyboard path use exactly the same targets as dragging.
 */
export function TimelineDropRail({
  title,
  clocks,
  activeClock = null,
  busy = false,
  onPlace,
  onCancel,
}: TimelineDropRailProps) {
  return (
    <section
      aria-labelledby="planner-slots-heading"
      aria-describedby="planner-slots-help"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="space-y-2 rounded-card border border-cyan/35 bg-surface p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="planner-slots-heading" className="flex items-center gap-1.5 text-section font-medium text-foreground">
          <CalendarClock className="size-4 text-cyan" aria-hidden />
          Timeline slots
        </h2>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="h-9 rounded-control px-2 text-caption">
          Cancel placement
        </Button>
      </div>
      <p id="planner-slots-help" className="text-caption text-muted-foreground">
        Placing <span className="font-medium text-foreground">{title}</span>. Pick a start time, or press{" "}
        <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">Esc</kbd> to cancel.
        Overlaps, fixed commitments and wind-down are checked before saving.
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
        {clocks.map((clock) => (
          <button
            key={clock}
            type="button"
            data-slot-clock={clock}
            disabled={busy}
            aria-label={`Place ${title} at ${clock}`}
            onClick={() => onPlace(clock)}
            className={cn(
              "min-h-11 rounded-control border px-2 font-mono text-caption tabular-nums transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
              activeClock === clock
                ? "border-cyan bg-cyan/15 text-foreground"
                : "border-border bg-surface-2 text-muted-foreground hover:border-cyan/60 hover:text-foreground",
              busy && "opacity-60",
            )}
          >
            {clock}
          </button>
        ))}
      </div>
    </section>
  );
}
