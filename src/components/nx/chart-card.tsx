"use client";

import type { ReactNode } from "react";
import { ChartColumn } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Card } from "@/components/ui/card";

export interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}

export function ChartCard({
  title,
  description,
  children,
  footer,
  empty = false,
  emptyMessage = "No data logged for this period yet.",
}: ChartCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <Card className="flex h-full flex-col gap-0 rounded-card border border-border bg-surface py-0 ring-0 shadow-none transition-colors duration-[180ms] ease-out hover:border-border-strong">
        <div className="border-b border-border px-4 py-3">
          <p className="text-section font-medium text-foreground">{title}</p>
          {description ? (
            <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="flex-1 px-4 py-4">
          {empty ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <ChartColumn className="size-5 text-muted-foreground" aria-hidden />
              <p className="max-w-xs text-caption text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>

        {footer ? (
          <div className="border-t border-border px-4 py-3 text-caption text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}
