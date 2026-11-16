"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardDelta {
  value: number;
  direction: "up" | "down" | "flat";
  label?: string;
}

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: StatCardDelta;
  hint?: string;
  icon?: ReactNode;
  accent?: "violet" | "cyan" | "neutral";
}

const deltaIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

/* Accent is a 2px top border only — never a large fill. */
const accentBorder = {
  violet: "border-t-violet",
  cyan: "border-t-cyan",
  neutral: "border-t-border",
} as const;

export function StatCard({
  label,
  value,
  unit,
  delta,
  hint,
  icon,
  accent = "neutral",
}: StatCardProps) {
  const reduce = useReducedMotion();
  const DeltaIcon = delta ? deltaIcon[delta.direction] : null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <Card
        className={cn(
          "h-full gap-0 rounded-card border border-border border-t-2 bg-surface py-0 ring-0 shadow-none transition-colors duration-[180ms] ease-out hover:border-border-strong",
          accentBorder[accent],
        )}
      >
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-muted-foreground">{label}</p>
            {icon ? (
              <span className="text-muted-foreground [&_svg]:size-4" aria-hidden>
                {icon}
              </span>
            ) : null}
          </div>

          <p className="flex items-baseline gap-1">
            <span className="font-mono text-title font-medium tabular-nums text-foreground">
              {value}
            </span>
            {unit ? <span className="text-body text-muted-foreground">{unit}</span> : null}
          </p>

          {delta && DeltaIcon ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-chip border border-border bg-surface-2 px-2 py-0.5 text-caption text-muted-foreground">
              <DeltaIcon className="size-3" aria-hidden />
              <span className="font-mono tabular-nums">
                {delta.value > 0 ? "+" : ""}
                {delta.value}
              </span>
              {delta.label ? <span>{delta.label}</span> : null}
            </span>
          ) : null}

          {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
        </div>
      </Card>
    </motion.div>
  );
}
