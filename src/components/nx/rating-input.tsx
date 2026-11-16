"use client";

import { Button } from "@/components/ui/button";
import type { Rating } from "@/types/domain";

export interface RatingInputProps {
  value?: Rating;
  onChange: (value: Rating) => void;
  label: string;
  lowLabel?: string;
  highLabel?: string;
}

const RATING_VALUES: Rating[] = [1, 2, 3, 4, 5];

// TODO(stub): replaced by Opus output
export function RatingInput({ value, onChange, label, lowLabel, highLabel }: RatingInputProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      <div className="flex items-center gap-1.5" role="group" aria-label={label}>
        {RATING_VALUES.map((rating) => (
          <Button
            key={rating}
            type="button"
            size="sm"
            variant={value === rating ? "default" : "outline"}
            aria-pressed={value === rating}
            onClick={() => onChange(rating)}
            className="w-9 tabular-nums"
          >
            {rating}
          </Button>
        ))}
      </div>

      {lowLabel || highLabel ? (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
