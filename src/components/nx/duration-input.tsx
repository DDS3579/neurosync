"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DurationInputProps {
  valueMin: number;
  onChange: (minutes: number) => void;
  label: string;
  presets?: number[];
}

const DEFAULT_PRESETS = [10, 15, 25, 45, 60];

// TODO(stub): replaced by Opus output
export function DurationInput({
  valueMin,
  onChange,
  label,
  presets = DEFAULT_PRESETS,
}: DurationInputProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={5}
          inputMode="numeric"
          value={valueMin}
          aria-label={label}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) && next >= 0 ? Math.round(next) : 0);
          }}
          className="w-24 tabular-nums"
        />
        <span className="text-sm text-muted-foreground">min</span>
      </div>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={valueMin === preset ? "default" : "outline"}
              aria-pressed={valueMin === preset}
              onClick={() => onChange(preset)}
              className="tabular-nums"
            >
              {preset}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
