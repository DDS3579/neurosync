"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface/60 px-6 py-10 text-center"
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-[12px] border border-border bg-surface-2 text-cyan [&_svg]:size-5">
          {icon}
        </span>
      ) : null}

      <p className="text-section font-medium text-foreground">{title}</p>
      <p className="max-w-md text-body text-muted-foreground">{description}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </motion.div>
  );
}
