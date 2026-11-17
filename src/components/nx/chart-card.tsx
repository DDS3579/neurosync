"use client";

import { useState, type ReactNode } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { motion } from "motion/react";

import { Card } from "@/components/ui/card";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";

export interface ChartTableData {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number>>;
}

export interface ChartCardProps {
  title: string;
  description?: string;
  summary?: string;
  tableData?: ChartTableData;
  children: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}

export function ChartCard({
  title,
  description,
  summary,
  tableData,
  children,
  footer,
  empty = false,
  emptyMessage = "No data logged for this period yet.",
}: ChartCardProps) {
  const reduce = usePrefersReducedMotion();
  const [viewAsTable, setViewAsTable] = useState(false);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <Card className="flex h-full flex-col gap-0 rounded-card border border-border bg-surface py-0 ring-0 shadow-none transition-colors duration-[180ms] ease-out hover:border-border-strong">
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-section font-medium text-foreground">{title}</p>
            {description ? (
              <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
            ) : null}
          </div>

          {!empty && tableData ? (
            <button
              type="button"
              aria-pressed={viewAsTable}
              aria-label={`View ${title} as ${viewAsTable ? "chart" : "table"}`}
              onClick={() => setViewAsTable((prev) => !prev)}
              className="nx-print-hide inline-flex shrink-0 items-center gap-1 rounded-chip border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              {viewAsTable ? (
                <>
                  <ChartColumn className="size-3" aria-hidden />
                  Chart
                </>
              ) : (
                <>
                  <Table2 className="size-3" aria-hidden />
                  View as table
                </>
              )}
            </button>
          ) : null}
        </div>

        <div className="flex-1 px-4 py-4">
          {empty ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <ChartColumn className="size-5 text-muted-foreground" aria-hidden />
              <p className="max-w-xs text-caption text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <>
              {summary ? (
                <p className="mb-3 text-caption text-muted-foreground">{summary}</p>
              ) : null}

              {viewAsTable && tableData ? (
                <div className="max-h-[210px] overflow-auto rounded-control border border-border bg-surface-2/60">
                  <table className="w-full border-collapse text-left text-caption">
                    <caption className="sr-only">{tableData.caption}</caption>
                    <thead>
                      <tr className="border-b border-border bg-surface-2">
                        {tableData.columns.map((col) => (
                          <th
                            key={col}
                            scope="col"
                            className="px-3 py-2 font-mono text-[11px] font-medium text-foreground"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {tableData.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={
                                cIdx === 0
                                  ? "px-3 py-1.5 font-medium text-foreground"
                                  : "px-3 py-1.5 font-mono text-muted-foreground tabular-nums"
                              }
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                children
              )}
            </>
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
