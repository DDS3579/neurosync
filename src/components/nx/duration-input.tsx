"use client";

import { Minus, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DurationInputProps {
  valueMin: number;
  onChange: (minutes: number) => void;
  label: string;
  presets?: number[];
}

const DEFAULT_PRESETS = [10, 15, 25, 45, 60];
const STEP_MIN = 5;

function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function DurationInput({
  valueMin,
  onChange,
  label,
  presets = DEFAULT_PRESETS,
}: DurationInputProps) {
  const stepBy = (delta: number) => onChange(Math.max(0, valueMin + delta));

  return (
    <div className="space-y-3">
      <p className="text-section font-medium text-foreground">{label}</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Remove ${STEP_MIN} minutes`}
          onClick={() => stepBy(-STEP_MIN)}
          className="flex size-10 items-center justify-center rounded-control border border-border bg-surface-2 text-muted-foreground transition-colors duration-[180ms] ease-out hover:border-border-strong hover:text-foreground"
        >
          <Minus className="size-4" aria-hidden />
        </button>

        <Input
          type="number"
          min={0}
          step={STEP_MIN}
          inputMode="numeric"
          value={valueMin}
          aria-label={`${label} in minutes`}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) && next >= 0 ? Math.round(next) : 0);
          }}
          className="h-10 w-20 rounded-control border-border bg-surface-2 text-center font-mono text-body tabular-nums"
        />

        <button
          type="button"
          aria-label={`Add ${STEP_MIN} minutes`}
          onClick={() => stepBy(STEP_MIN)}
          className="flex size-10 items-center justify-center rounded-control border border-border bg-surface-2 text-muted-foreground transition-colors duration-[180ms] ease-out hover:border-border-strong hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden />
        </button>

        <span className="font-mono text-body text-muted-foreground tabular-nums">
          {formatDuration(valueMin)}
        </span>
      </div>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const selected = valueMin === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(preset)}
                className={cn(
                  "rounded-chip border px-3 py-1 font-mono text-caption tabular-nums transition-colors duration-[180ms] ease-out",
                  selected
                    ? "border-violet bg-violet/15 text-violet-text"
                    : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {preset}m
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
