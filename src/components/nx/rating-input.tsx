"use client";

import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import type { Rating } from "@/types/domain";

export interface RatingInputProps {
  value?: Rating;
  onChange: (value: Rating) => void;
  label: string;
  lowLabel?: string;
  highLabel?: string;
}

const RATINGS: Rating[] = [1, 2, 3, 4, 5];
const MIN_RATING = 1;
const MAX_RATING = 5;

export function RatingInput({ value, onChange, label, lowLabel, highLabel }: RatingInputProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: number, moveFocus: boolean) => {
    const clamped = Math.min(MAX_RATING, Math.max(MIN_RATING, next)) as Rating;
    onChange(clamped);
    if (moveFocus) buttons.current[clamped - 1]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = value ?? MIN_RATING;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        select(current + 1, true);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        select(current - 1, true);
        break;
      case "Home":
        event.preventDefault();
        select(MIN_RATING, true);
        break;
      case "End":
        event.preventDefault();
        select(MAX_RATING, true);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-section font-medium text-foreground">{label}</p>

      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex items-center gap-2"
      >
        {RATINGS.map((rating) => {
          const checked = value === rating;
          const filled = value !== undefined && rating <= value;

          return (
            <button
              key={rating}
              ref={(node) => {
                buttons.current[rating - 1] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${rating} of ${MAX_RATING}`}
              tabIndex={checked || (value === undefined && rating === MIN_RATING) ? 0 : -1}
              onClick={() => onChange(rating)}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border font-mono text-body tabular-nums transition-colors duration-[180ms] ease-out",
                filled
                  ? "border-violet bg-violet text-white"
                  : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {rating}
            </button>
          );
        })}
      </div>

      {lowLabel || highLabel ? (
        <div className="flex justify-between text-caption text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
