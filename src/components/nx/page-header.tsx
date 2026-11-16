"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const reduce = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="space-y-1">
        <h1 className="font-heading text-title font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-body text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </motion.div>
  );
}
