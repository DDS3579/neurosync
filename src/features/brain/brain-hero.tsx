"use client";

import { cn } from "@/lib/utils";

export interface BrainHeroProps {
  progress?: number; // 0..1 scroll
  interactive?: boolean;
  className?: string;
}

// TODO(stub): replaced by Opus output
export function BrainHero({ progress = 0, interactive = false, className }: BrainHeroProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-surface p-8",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet/60 to-transparent"
        style={{ transform: `translateY(${(1 - clamped) * 48}px)`, opacity: 0.4 + clamped * 0.6 }}
      />

      <div className="relative max-w-xl space-y-3">
        <p className="font-mono text-xs tracking-wide text-cyan uppercase">Local-first brain atlas</p>
        <p className="font-heading text-2xl font-semibold tracking-tight">
          Explore regions and the activities they are often discussed with.
        </p>
        <p className="text-sm text-muted-foreground">
          Educational associations only. Nothing here measures your brain activity, size, or health.
        </p>
        {interactive ? (
          <p className="text-xs text-muted-foreground">
            Interactive mode placeholder: the 3D atlas is not wired up yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
