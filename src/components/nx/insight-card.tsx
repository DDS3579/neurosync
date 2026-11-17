"use client";

import { useState } from "react";
import { ChevronDown, Clock, EyeOff, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { RegionBadge } from "@/components/nx/region-badge";
import { Card } from "@/components/ui/card";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { cn } from "@/lib/utils";
import type { DataConfidenceLevel, Insight } from "@/types/domain";

const CONFIDENCE_LABEL: Record<DataConfidenceLevel, string> = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  enough: "Enough data",
};

const CONFIDENCE_STYLE: Record<DataConfidenceLevel, string> = {
  low: "border-border bg-surface-2 text-muted-foreground",
  moderate: "border-cyan/30 bg-cyan/10 text-cyan",
  enough: "border-violet/35 bg-violet/10 text-foreground",
};

export interface InsightCardProps {
  insight: Insight;
  onDismiss?: (insight: Insight) => void;
  onSnooze?: (insight: Insight) => void;
}

export function InsightCard({ insight, onDismiss, onSnooze }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const reduce = usePrefersReducedMotion();
  const panelId = `insight-education-${insight.id}`;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <Card className="flex h-full flex-col gap-0 rounded-card border border-border bg-surface py-0 ring-0 shadow-none transition-colors duration-[180ms] ease-out hover:border-border-strong">
        <div className="flex flex-col gap-2 px-4 pt-4">
          <h3 className="text-section font-medium text-foreground">{insight.title}</h3>
          <p className="text-body text-muted-foreground">{insight.body}</p>

          {insight.confidence ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span
                className={cn(
                  "rounded-chip border px-2 py-0.5 font-mono text-[11px] font-medium",
                  CONFIDENCE_STYLE[insight.confidence.level],
                )}
              >
                {CONFIDENCE_LABEL[insight.confidence.level]}
              </span>
              <span className="text-caption text-muted-foreground">
                {insight.confidence.summary}
              </span>
            </div>
          ) : null}

          {insight.evidence.length > 0 ? (
            <ul className="flex flex-wrap gap-2 pt-1">
              {insight.evidence.map((item) => (
                <li
                  key={item}
                  className="rounded-chip border border-border bg-surface-2 px-2.5 py-1 font-mono text-caption tabular-nums text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {insight.regions && insight.regions.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {insight.regions.map((region) => (
                <RegionBadge key={region} region={region} />
              ))}
            </div>
          ) : null}
        </div>

        {insight.education ? (
          <div className="px-4 pt-3">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((open) => !open)}
              className="inline-flex items-center gap-1 text-caption font-medium text-cyan transition-colors duration-[180ms] ease-out hover:text-cyan/80"
            >
              Why this matters
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-[180ms] ease-out",
                  expanded && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  id={panelId}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="pt-2 text-body text-muted-foreground">{insight.education}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        <div className="mt-auto space-y-2.5 border-t border-border px-4 py-3">
          <div className="flex gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-caption text-muted-foreground">{insight.caveat}</p>
          </div>

          {onDismiss || onSnooze ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/60 pt-2">
              {onSnooze ? (
                <button
                  type="button"
                  onClick={() => onSnooze(insight)}
                  aria-label={`Snooze "${insight.title}" for 14 days`}
                  className="inline-flex items-center gap-1 rounded-chip border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <Clock className="size-3" aria-hidden />
                  Snooze 14d
                </button>
              ) : null}
              {onDismiss ? (
                <button
                  type="button"
                  onClick={() => onDismiss(insight)}
                  aria-label={`Dismiss "${insight.title}" as not useful`}
                  className="inline-flex items-center gap-1 rounded-chip border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <EyeOff className="size-3" aria-hidden />
                  Not useful
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}
