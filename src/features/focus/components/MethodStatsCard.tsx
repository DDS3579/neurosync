"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { summarizeMethodStats } from "@/features/focus/focusAnalytics";
import type { FocusSession } from "@/types/domain";

export interface MethodStatsCardProps {
  sessions: FocusSession[];
}

export function MethodStatsCard({ sessions }: MethodStatsCardProps) {
  const stats = useMemo(() => summarizeMethodStats(sessions), [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-control border border-border bg-surface p-4 text-caption text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden />
        <p>
          <strong className="font-medium text-foreground">Self-reported, small sample.</strong>{" "}
          Averages reflect your own logged focus and difficulty ratings across whatever topics and
          days you happened to use each method — never a ranking of which method is &ldquo;best&rdquo;.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.method}
            className="flex flex-col justify-between gap-4 rounded-card border border-border bg-surface p-5 shadow-none"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-section font-medium text-foreground">{stat.label}</h2>
                <Badge
                  variant="outline"
                  className="rounded-chip border-border bg-surface-2 font-mono text-[11px] text-muted-foreground tabular-nums"
                >
                  n = {stat.sessionCount}
                </Badge>
              </div>

              <dl className="grid grid-cols-3 gap-2 rounded-control border border-border bg-surface-2/70 p-3">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Total</dt>
                  <dd className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">
                    {stat.totalMinutes}m
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Avg focus</dt>
                  <dd className="mt-0.5 font-mono text-body font-medium text-cyan tabular-nums">
                    {stat.avgFocus !== null ? `${stat.avgFocus}/5` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Avg diff</dt>
                  <dd className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">
                    {stat.avgDifficulty !== null ? `${stat.avgDifficulty}/5` : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <Link
              href={stat.libraryHref}
              className="inline-flex items-center gap-1 text-caption font-medium text-cyan underline-offset-4 hover:underline"
            >
              {stat.libraryTitle}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
