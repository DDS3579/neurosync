"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CONSTELLATION_CATEGORY_LABELS,
  formatSameDayCount,
  getCoOccurrencesForNode,
  type ConstellationData,
} from "@/features/constellation/constellation";
import { cn } from "@/lib/utils";

export interface ConstellationTableViewProps {
  data: ConstellationData;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function ConstellationTableView({
  data,
  selectedNodeId,
  onSelectNode,
}: ConstellationTableViewProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-caption">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                Entry
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Type
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Days present
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Same-day co-occurrences
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.nodes.map((node) => {
              const topLinks = getCoOccurrencesForNode(node.id, data.nodes, data.edges, 3);
              const selected = selectedNodeId === node.id;

              return (
                <tr
                  key={node.id}
                  className={cn(
                    "transition-colors hover:bg-white/[0.03]",
                    selected && "bg-violet/10",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      className="text-left underline-offset-4 hover:text-cyan hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {node.label}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CONSTELLATION_CATEGORY_LABELS[node.category]}
                  </td>
                  <td className="px-4 py-3 font-mono text-cyan tabular-nums">
                    {node.daysPresent} / {data.windowDays}d
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {topLinks.length > 0 ? (
                      <ul className="space-y-0.5">
                        {topLinks.map((link) => (
                          <li key={link.nodeId}>
                            <span className="text-foreground">{link.label}</span>{" "}
                            <span className="font-mono text-[11px] text-cyan">
                              ({formatSameDayCount(link.sharedDays)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span>No pair with 3+ shared days</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectNode(node.id)}
                        className="h-7 rounded-control px-2.5 text-[11px]"
                      >
                        Details
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 rounded-control px-2 text-[11px] text-cyan hover:text-cyan"
                      >
                        <Link href={node.logHref}>
                          <Plus className="size-3" aria-hidden />
                          Log now
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
