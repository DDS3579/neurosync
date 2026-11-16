import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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

const accentClass = {
  violet: "text-violet",
  cyan: "text-cyan",
  neutral: "text-foreground",
} as const;

const deltaIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

// TODO(stub): replaced by Opus output
export function StatCard({
  label,
  value,
  unit,
  delta,
  hint,
  icon,
  accent = "neutral",
}: StatCardProps) {
  const DeltaIcon = delta ? deltaIcon[delta.direction] : null;

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>

        <p className={cn("font-heading text-2xl font-semibold tabular-nums", accentClass[accent])}>
          {value}
          {unit ? (
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          ) : null}
        </p>

        {delta && DeltaIcon ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <DeltaIcon className="size-3.5" aria-hidden />
            <span className="tabular-nums">
              {delta.value > 0 ? "+" : ""}
              {delta.value}
              {delta.label ? ` ${delta.label}` : ""}
            </span>
          </p>
        ) : null}

        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
