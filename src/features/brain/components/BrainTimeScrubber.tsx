"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BrainTimelineData } from "@/features/brain/brainActivity";
import { cn } from "@/lib/utils";

export interface BrainTimeScrubberProps {
  timeline: BrainTimelineData;
  windowDays: 7 | 30;
  onChangeWindowDays: (days: 7 | 30) => void;
  dayIndex: number;
  cumulative: boolean;
  onChangeCumulative: (cumulative: boolean) => void;
  onSelectDay: (index: number) => void;
  reducedMotion: boolean;
}

export function BrainTimeScrubber({
  timeline,
  windowDays,
  onChangeWindowDays,
  dayIndex,
  cumulative,
  onChangeCumulative,
  onSelectDay,
  reducedMotion,
}: BrainTimeScrubberProps) {
  const [playing, setPlaying] = useState(false);

  const maxIndex = Math.max(0, timeline.days.length - 1);
  const clampedIdx = Math.min(maxIndex, Math.max(0, dayIndex));
  const activeDay = timeline.days[clampedIdx];
  const snapshot = activeDay
    ? cumulative
      ? activeDay.cumulative
      : activeDay.dayOnly
    : null;

  const isPlaying = playing && !reducedMotion && maxIndex > 0;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      if (clampedIdx >= maxIndex) {
        setPlaying(false);
        return;
      }
      onSelectDay(clampedIdx + 1);
    }, 700);
    return () => window.clearInterval(id);
  }, [isPlaying, clampedIdx, maxIndex, onSelectDay]);

  const handleTogglePlay = () => {
    if (reducedMotion || maxIndex === 0) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (clampedIdx >= maxIndex) {
      onSelectDay(0);
    }
    setPlaying(true);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Previous day"
            disabled={clampedIdx <= 0}
            onClick={() => {
              setPlaying(false);
              onSelectDay(Math.max(0, clampedIdx - 1));
            }}
            className="size-7 rounded-chip p-0"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={isPlaying ? "default" : "outline"}
            disabled={reducedMotion || maxIndex === 0}
            aria-label={
              reducedMotion
                ? "Playback disabled while reduced motion is enabled"
                : isPlaying
                  ? "Pause day playback"
                  : "Play through days"
            }
            title={
              reducedMotion
                ? "Reduced motion enabled — use step buttons"
                : isPlaying
                  ? "Pause"
                  : "Play timeline"
            }
            onClick={handleTogglePlay}
            className={cn(
              "h-7 gap-1 rounded-chip px-2 text-caption",
              isPlaying && "bg-cyan text-[#060913] hover:bg-cyan/90",
            )}
          >
            {isPlaying ? (
              <Pause className="size-3" aria-hidden />
            ) : (
              <Play className="size-3" aria-hidden />
            )}
            <span className="sr-only sm:not-sr-only">
              {isPlaying ? "Pause" : "Play"}
            </span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Next day"
            disabled={clampedIdx >= maxIndex}
            onClick={() => {
              setPlaying(false);
              onSelectDay(Math.min(maxIndex, clampedIdx + 1));
            }}
            className="size-7 rounded-chip p-0"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>

          <span className="ml-1 font-mono text-caption text-foreground tabular-nums">
            {activeDay ? activeDay.shortLabel : "—"}
          </span>
          {snapshot ? (
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              · {snapshot.totalMinutes}m
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleGroup
            type="single"
            value={cumulative ? "cumulative" : "day"}
            onValueChange={(v) => {
              if (!v) return;
              onChangeCumulative(v === "cumulative");
            }}
            variant="outline"
            size="sm"
            aria-label="Timeline accumulation mode"
          >
            <ToggleGroupItem value="day" className="h-7 px-2 text-[11px]">
              That day
            </ToggleGroupItem>
            <ToggleGroupItem value="cumulative" className="h-7 px-2 text-[11px]">
              Cumulative
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={String(windowDays)}
            onValueChange={(v) => {
              if (v === "7" || v === "30") {
                setPlaying(false);
                onChangeWindowDays(v === "30" ? 30 : 7);
              }
            }}
            variant="outline"
            size="sm"
            aria-label="Timeline window length"
          >
            <ToggleGroupItem value="7" className="h-7 px-2 font-mono text-[11px]">
              7d
            </ToggleGroupItem>
            <ToggleGroupItem value="30" className="h-7 px-2 font-mono text-[11px]">
              30d
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="space-y-1">
        <Slider
          aria-label="Timeline day"
          min={0}
          max={maxIndex}
          step={1}
          value={[clampedIdx]}
          onValueChange={(vals) => {
            const next = vals[0];
            if (typeof next !== "number") return;
            setPlaying(false);
            onSelectDay(next);
          }}
        />

        {windowDays === 7 ? (
          <div className="grid grid-cols-7 gap-0.5 pt-0.5">
            {timeline.days.map((d, idx) => {
              const selected = idx === clampedIdx;
              const hasLogs = d.dayOnly.totalMinutes > 0;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    onSelectDay(idx);
                  }}
                  aria-label={`Select ${d.shortLabel} (${d.dayOnly.totalMinutes} minutes logged)`}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-col items-center rounded py-0.5 font-mono text-[10px] transition-colors",
                    selected
                      ? "bg-cyan/15 text-cyan"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mb-0.5 size-1 rounded-full",
                      hasLogs ? "bg-cyan" : "bg-white/15",
                    )}
                  />
                  <span>{d.shortLabel.split(" ")[1] ?? d.shortLabel}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>{timeline.days[0]?.shortLabel}</span>
            <span>{timeline.days[Math.floor(maxIndex / 2)]?.shortLabel}</span>
            <span>{timeline.days[maxIndex]?.shortLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
