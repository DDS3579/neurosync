"use client";

import { useMemo, useState } from "react";

import {
  CONSTELLATION_CATEGORY_LABELS,
  CONSTELLATION_VIEWBOX,
  formatSameDayCount,
  getCoOccurrencesForNode,
  type ConstellationData,
  type ConstellationNode,
} from "@/features/constellation/constellation";
import { cn } from "@/lib/utils";

export interface ConstellationCanvasProps {
  data: ConstellationData;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  reducedMotion: boolean;
}

interface DustStar {
  id: number;
  x: number;
  y: number;
  r: number;
  opacity: number;
  tone: "cyan" | "violet" | "muted";
  delayMs: number;
}

const BACKGROUND_DUST: readonly DustStar[] = Array.from({ length: 34 }, (_, i) => {
  const x = ((i * 197 + 43) % (CONSTELLATION_VIEWBOX.width - 24)) + 12;
  const y = ((i * 131 + 29) % (CONSTELLATION_VIEWBOX.height - 24)) + 12;
  const r = i % 5 === 0 ? 1.5 : 1;
  const opacity = 0.14 + ((i * 7) % 5) * 0.05;
  const tone = i % 7 === 0 ? "violet" : i % 3 === 0 ? "cyan" : "muted";
  return {
    id: i,
    x,
    y,
    r,
    opacity,
    tone,
    delayMs: (i % 6) * 600,
  };
});

export function ConstellationCanvas({
  data,
  selectedNodeId,
  onSelectNode,
  reducedMotion,
}: ConstellationCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeId = hoveredId ?? selectedNodeId;

  const nodeById = useMemo(
    () => new Map(data.nodes.map((node) => [node.id, node])),
    [data.nodes],
  );

  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!activeId) return ids;
    ids.add(activeId);
    for (const edge of data.edges) {
      if (edge.source === activeId) ids.add(edge.target);
      else if (edge.target === activeId) ids.add(edge.source);
    }
    return ids;
  }, [activeId, data.edges]);

  const activeNode: ConstellationNode | null = activeId
    ? (nodeById.get(activeId) ?? null)
    : null;

  const activeTopNeighbors = useMemo(
    () =>
      activeNode
        ? getCoOccurrencesForNode(activeNode.id, data.nodes, data.edges, 3)
        : [],
    [activeNode, data.nodes, data.edges],
  );

  const tooltipAlignRight = activeNode
    ? activeNode.x < CONSTELLATION_VIEWBOX.width * 0.5
    : true;

  return (
    <div
      data-constellation-canvas="true"
      className="relative overflow-hidden rounded-card border border-border bg-[#060913] shadow-lg"
    >
      <svg
        viewBox={`0 0 ${CONSTELLATION_VIEWBOX.width} ${CONSTELLATION_VIEWBOX.height}`}
        role="group"
        aria-label={data.summaryText}
        className="block h-auto w-full select-none"
      >
        <defs>
          <radialGradient id="constellation-glow-cyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="constellation-glow-violet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background tap-to-clear hit area */}
        <rect
          x={0}
          y={0}
          width={CONSTELLATION_VIEWBOX.width}
          height={CONSTELLATION_VIEWBOX.height}
          fill="#060913"
          onClick={() => onSelectNode(null)}
        />

        {/* Quiet ambient starfield dust */}
        <g aria-hidden="true">
          {BACKGROUND_DUST.map((dot) => {
            const fill =
              dot.tone === "cyan"
                ? "#22D3EE"
                : dot.tone === "violet"
                  ? "#8B5CF6"
                  : "#E6EAF5";
            return (
              <circle
                key={dot.id}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={fill}
                opacity={dot.opacity}
                className={reducedMotion ? undefined : "motion-safe:animate-pulse"}
                style={
                  reducedMotion
                    ? undefined
                    : { animationDuration: "5.2s", animationDelay: `${dot.delayMs}ms` }
                }
              />
            );
          })}
        </g>

        {/* Same-day co-occurrence edges (only >= 3 shared days) */}
        <g aria-hidden="true">
          {data.edges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;

            const isConnected =
              activeId !== null &&
              (edge.source === activeId || edge.target === activeId);
            const dimmed = activeId !== null && !isConnected;
            const selectedEdge =
              selectedNodeId !== null &&
              (edge.source === selectedNodeId || edge.target === selectedNodeId);

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={selectedEdge ? "#8B5CF6" : isConnected ? "#22D3EE" : "#4E5B7D"}
                strokeWidth={edge.thickness}
                strokeLinecap="round"
                strokeOpacity={dimmed ? 0.14 : isConnected ? 0.85 : 0.42}
                className={reducedMotion ? undefined : "transition-opacity duration-200"}
              />
            );
          })}
        </g>

        {/* Star nodes */}
        <g>
          {data.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredId === node.id;
            const isNeighbor = activeId !== null && connectedIds.has(node.id);
            const dimmed = activeId !== null && !isNeighbor;

            const emphasis =
              isSelected || node.category === "method" || node.category === "activity";
            const coreFill = isSelected
              ? "#C4B5FD"
              : emphasis
                ? "#A78BFA"
                : "#67E8F9";
            const haloUrl = emphasis
              ? "url(#constellation-glow-violet)"
              : "url(#constellation-glow-cyan)";
            const neighbors = getCoOccurrencesForNode(node.id, data.nodes, data.edges, 1);
            const topHint = neighbors[0]
              ? `; top link ${neighbors[0].label}, ${formatSameDayCount(neighbors[0].sharedDays)}`
              : "";

            return (
              <g
                key={node.id}
                data-star-id={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${node.label} (${CONSTELLATION_CATEGORY_LABELS[node.category]}), ${node.daysPresent} days${topHint}`}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() =>
                  setHoveredId((prev) => (prev === node.id ? null : prev))
                }
                onFocus={() => setHoveredId(node.id)}
                onBlur={() =>
                  setHoveredId((prev) => (prev === node.id ? null : prev))
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(isSelected ? null : node.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectNode(isSelected ? null : node.id);
                  } else if (e.key === "Escape") {
                    setHoveredId(null);
                    onSelectNode(null);
                  }
                }}
                className="cursor-pointer focus:outline-none"
                style={{ opacity: dimmed ? 0.3 : 1 }}
              >
                {/* Generous invisible hit circle for touch/mouse precision */}
                <circle r={Math.max(20, node.radius + 9)} fill="transparent" />

                {/* Subtle glow halo */}
                <circle
                  r={node.radius * (isSelected || isHovered ? 2.5 : 1.9)}
                  fill={haloUrl}
                  opacity={node.brightness * (isSelected ? 0.95 : 0.72)}
                  className={
                    reducedMotion || (!isSelected && !isHovered)
                      ? undefined
                      : "motion-safe:animate-pulse"
                  }
                />

                {/* Active/focus ring */}
                {(isSelected || isHovered) && (
                  <circle
                    r={node.radius + 4}
                    fill="none"
                    stroke={isSelected ? "#8B5CF6" : "#22D3EE"}
                    strokeWidth={1.5}
                  />
                )}

                {/* Star core */}
                <circle
                  r={node.radius}
                  fill={coreFill}
                  fillOpacity={node.brightness}
                  stroke="#060913"
                  strokeWidth={1.5}
                />

                {/* Inner pinpoint */}
                <circle
                  r={Math.max(2, node.radius * 0.34)}
                  fill="#F8FAFC"
                  opacity={0.85}
                />

                {/* Concise star label */}
                <text
                  y={node.radius + 14}
                  textAnchor="middle"
                  fill={isSelected || isHovered ? "#E6EAF5" : "#AEB7CF"}
                  fontSize={11}
                  fontWeight={isSelected ? 600 : 500}
                  style={{ paintOrder: "stroke", stroke: "#060913", strokeWidth: 3 }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Accessible hover/focus tooltip overlay (kept within canvas corners) */}
      {activeNode ? (
        <div
          role="status"
          aria-live="polite"
          data-constellation-tooltip="true"
          className={cn(
            "pointer-events-none absolute top-3 z-10 w-64 max-w-[calc(100%-1.5rem)] rounded-[12px] border border-border-strong bg-surface/90 p-3 text-caption text-foreground shadow-lg backdrop-blur-md",
            tooltipAlignRight ? "right-3" : "left-3",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{activeNode.label}</p>
              <p className="font-mono text-[11px] text-cyan">
                {CONSTELLATION_CATEGORY_LABELS[activeNode.category]} · {activeNode.daysPresent}{" "}
                {activeNode.daysPresent === 1 ? "day" : "days"}
              </p>
            </div>
          </div>

          {activeTopNeighbors.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
              {activeTopNeighbors.map((item) => (
                <li key={item.nodeId} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground/90">{item.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-cyan tabular-nums">
                    {formatSameDayCount(item.sharedDays)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
              No pair with 3+ shared days in this window.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
