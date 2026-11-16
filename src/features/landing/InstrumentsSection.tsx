"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BRAIN_REGIONS } from "@/data/brainRegions";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { cn } from "@/lib/utils";
import type { RegionId } from "@/types/domain";
import { useInViewOnce } from "./useInViewOnce";
import { useScrollProgress } from "./useScrollProgress";

/* ------------------------------------------------------------------ */
/* Mini-Demo A: Brain Explorer (SVG dotted silhouette + 7 region chips) */
/* ------------------------------------------------------------------ */
interface BrainDot {
  cx: number;
  cy: number;
  r: number;
  region: RegionId;
}

function classifyRegion(x: number, y: number, isCerebellum: boolean): RegionId {
  if (isCerebellum) return "cerebellum";
  // Deep internal limbic markers (anterior/medial temporal core)
  if (x >= 178 && x <= 202 && y >= 122 && y <= 144) return "amygdala";
  if (x >= 140 && x <= 180 && y >= 114 && y <= 142) return "hippocampus";
  if (x >= 194) return "prefrontal";
  if (x >= 114 && y < 96) return "parietal";
  if (x >= 114) return "temporal";
  return "occipital";
}

function buildRegionSilhouetteDots(): BrainDot[] {
  const dots: BrainDot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  const cortexTotal = 180;
  for (let i = 0; i < cortexTotal; i++) {
    const t = (i + 0.5) / cortexTotal;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    const x = 160 + Math.cos(angle) * rad * 98;
    const y = 104 + Math.sin(angle) * rad * 66 - Math.cos(angle) * 6;
    dots.push({
      cx: Number(x.toFixed(1)),
      cy: Number(y.toFixed(1)),
      r: Number((1.3 + (1 - rad) * 1.1).toFixed(2)),
      region: classifyRegion(x, y, false),
    });
  }

  const cerebellumTotal = 36;
  for (let i = 0; i < cerebellumTotal; i++) {
    const t = (i + 0.5) / cerebellumTotal;
    const rad = Math.sqrt(t);
    const angle = i * golden;
    const x = 100 + Math.cos(angle) * rad * 32;
    const y = 170 + Math.sin(angle) * rad * 20;
    dots.push({
      cx: Number(x.toFixed(1)),
      cy: Number(y.toFixed(1)),
      r: Number((1.2 + (1 - rad) * 0.9).toFixed(2)),
      region: classifyRegion(x, y, true),
    });
  }

  return dots;
}

const REGION_DOTS = buildRegionSilhouetteDots();

const SHORT_REGION_LABELS: Record<RegionId, string> = {
  prefrontal: "Prefrontal",
  parietal: "Parietal",
  temporal: "Temporal",
  occipital: "Occipital",
  cerebellum: "Cerebellum",
  hippocampus: "Hippocampus",
  amygdala: "Amygdala",
};

function BrainExplorerDemo() {
  const [activeId, setActiveId] = useState<RegionId>("prefrontal");

  const activeRegion = useMemo(
    () => BRAIN_REGIONS.find((r) => r.id === activeId) ?? BRAIN_REGIONS[0],
    [activeId],
  );

  const oneLineAssociation = useMemo(() => {
    const first = activeRegion.associatedWith[0]?.toLowerCase() ?? "";
    const second = activeRegion.associatedWith[1]?.toLowerCase() ?? "";
    return second
      ? `Commonly associated with ${first} and ${second}.`
      : `Commonly associated with ${first}.`;
  }, [activeRegion]);

  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#0C1222] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
          ATLAS PREVIEW
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
          {activeRegion.name}
        </span>
      </div>

      {/* 7 region chips */}
      <div
        role="group"
        aria-label="Brain regions"
        className="mt-4 flex flex-wrap gap-1.5"
      >
        {BRAIN_REGIONS.map((region) => {
          const selected = region.id === activeId;
          return (
            <button
              key={region.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveId(region.id)}
              onMouseEnter={() => setActiveId(region.id)}
              onFocus={() => setActiveId(region.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] transition-colors",
                selected
                  ? "border-[#22D3EE]/70 bg-[#22D3EE]/15 text-[#E6EAF5]"
                  : "border-white/[0.08] bg-[#111A30]/70 text-[#8A93AD] hover:border-white/20 hover:text-[#E6EAF5]",
              )}
            >
              {SHORT_REGION_LABELS[region.id]}
            </button>
          );
        })}
      </div>

      {/* Dotted brain silhouette */}
      <div className="mt-4 flex items-center justify-center rounded-[10px] border border-white/[0.06] bg-[#060913]/80 py-3">
        <svg
          viewBox="0 0 320 212"
          className="h-40 w-64 sm:h-48 sm:w-76"
          role="img"
          aria-label={`Dotted lateral brain silhouette highlighting ${activeRegion.name}`}
        >
          {REGION_DOTS.map((dot, idx) => {
            const highlighted = dot.region === activeId;
            return (
              <circle
                key={idx}
                cx={dot.cx}
                cy={dot.cy}
                r={highlighted ? dot.r + 0.9 : dot.r}
                fill={highlighted ? "#22D3EE" : "#8A93AD"}
                fillOpacity={highlighted ? 0.95 : 0.22}
                className="transition-all duration-300 motion-reduce:transition-none"
              />
            );
          })}
        </svg>
      </div>

      {/* 1-line educational association */}
      <p
        aria-live="polite"
        className="mt-4 min-h-[2.75rem] text-sm leading-relaxed text-[#E6EAF5]/90"
      >
        {oneLineAssociation}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini-Demo B: Daily Tracker (SVG sleep vs focus bar chart + tooltip) */
/* ------------------------------------------------------------------ */
const TRACKER_DAYS = [
  { day: "Mon", sleepH: 6.4, focus: 3.0 },
  { day: "Tue", sleepH: 7.2, focus: 3.6 },
  { day: "Wed", sleepH: 7.9, focus: 4.2 },
  { day: "Thu", sleepH: 6.1, focus: 2.8 },
  { day: "Fri", sleepH: 7.6, focus: 4.0 },
  { day: "Sat", sleepH: 8.3, focus: 4.5 },
  { day: "Sun", sleepH: 7.8, focus: 4.1 },
] as const;

function DailyTrackerDemo({ reducedMotion }: { reducedMotion: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const entered = useInViewOnce(containerRef, { threshold: 0.3, disabled: reducedMotion });
  const [activeIdx, setActiveIdx] = useState<number>(2);

  const activeDay = TRACKER_DAYS[activeIdx] ?? TRACKER_DAYS[2];
  const chartHeight = 112;
  const chartBottom = 132;
  const groupWidth = 48;
  const startX = 28;

  const focusPoints = TRACKER_DAYS.map((d, idx) => {
    const x = startX + idx * groupWidth + 24;
    const y = chartBottom - (d.focus / 5) * chartHeight;
    return `${x},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div
      ref={containerRef}
      className="rounded-[14px] border border-white/[0.08] bg-[#0C1222] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
          SLEEP VS FOCUS · 7D
        </span>
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-[#8A93AD]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-2 rounded-xs bg-[#22D3EE]" />
            Sleep
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-2 rounded-xs bg-[#8B5CF6]" />
            Focus
          </span>
        </div>
      </div>

      {/* Tooltip / live readout (keyboard + hover accessible) */}
      <div
        aria-live="polite"
        className="mt-3 flex items-center justify-between rounded-[10px] border border-white/[0.08] bg-[#111A30]/75 px-3 py-2 font-mono text-xs tabular-nums"
      >
        <span className="text-[#E6EAF5]">{activeDay.day}</span>
        <span className="text-[#22D3EE]">Sleep {activeDay.sleepH.toFixed(1)}h</span>
        <span className="text-[#C4B5FD]">Focus {activeDay.focus.toFixed(1)}/5</span>
      </div>

      {/* SVG bar chart */}
      <div className="mt-3">
        <svg
          viewBox="0 0 380 156"
          className="h-44 w-full"
          role="img"
          aria-label="7-day bar chart comparing sleep hours and self-rated focus"
        >
          {/* Baseline + mid guides */}
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const y = chartBottom - frac * chartHeight;
            return (
              <line
                key={frac}
                x1={16}
                x2={364}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="2 4"
              />
            );
          })}
          <line x1={16} x2={364} y1={chartBottom} y2={chartBottom} stroke="rgba(255,255,255,0.14)" />

          {TRACKER_DAYS.map((d, idx) => {
            const x = startX + idx * groupWidth;
            const sleepH = (d.sleepH / 9.5) * chartHeight;
            const focusH = (d.focus / 5) * chartHeight;
            const selected = idx === activeIdx;

            return (
              <g key={d.day}>
                {selected ? (
                  <rect
                    x={x - 3}
                    y={14}
                    width={36}
                    height={chartBottom - 14}
                    rx={4}
                    fill="rgba(255,255,255,0.04)"
                  />
                ) : null}

                {/* Sleep bar */}
                <rect
                  x={x + 2}
                  y={chartBottom - sleepH}
                  width={11}
                  height={sleepH}
                  rx={2}
                  fill="#22D3EE"
                  fillOpacity={selected ? 0.95 : 0.65}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "bottom",
                    transform: `scaleY(${entered ? 1 : 0})`,
                    transition: reducedMotion
                      ? "none"
                      : `transform 520ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 65}ms`,
                  }}
                />

                {/* Focus bar */}
                <rect
                  x={x + 17}
                  y={chartBottom - focusH}
                  width={11}
                  height={focusH}
                  rx={2}
                  fill="#8B5CF6"
                  fillOpacity={selected ? 0.95 : 0.65}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "bottom",
                    transform: `scaleY(${entered ? 1 : 0})`,
                    transition: reducedMotion
                      ? "none"
                      : `transform 520ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 65 + 45}ms`,
                  }}
                />
              </g>
            );
          })}

          {/* Subtle focus trend polyline */}
          <polyline
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="1.5"
            strokeOpacity="0.65"
            points={focusPoints}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={entered ? 0 : 1}
            style={{
              transition: reducedMotion ? "none" : "stroke-dashoffset 800ms ease-out 250ms",
            }}
          />
        </svg>

        {/* Keyboard-accessible day selector row */}
        <div
          role="group"
          aria-label="Inspect day metrics"
          className="mt-1 grid grid-cols-7 gap-1"
        >
          {TRACKER_DAYS.map((d, idx) => {
            const selected = idx === activeIdx;
            return (
              <button
                key={d.day}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveIdx(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
                onFocus={() => setActiveIdx(idx)}
                className={cn(
                  "rounded-md py-1 font-mono text-[11px] transition-colors",
                  selected
                    ? "bg-white/[0.08] text-[#22D3EE]"
                    : "text-[#8A93AD] hover:text-[#E6EAF5]",
                )}
              >
                {d.day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini-Demo C: Insight Engine (typewriter observation + evidence)    */
/* ------------------------------------------------------------------ */
const INSIGHT_TEXT =
  "On mornings after 7.5+ hours of sleep, your self-rated focus averaged 4.1 compared to 2.9 on shorter nights.";

function InsightEngineDemo({ reducedMotion }: { reducedMotion: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const started = useInViewOnce(cardRef, { threshold: 0.35, disabled: reducedMotion });
  const [charCount, setCharCount] = useState(0);

  const effectiveCount = reducedMotion ? INSIGHT_TEXT.length : charCount;

  useEffect(() => {
    if (!started || reducedMotion) return;
    if (charCount >= INSIGHT_TEXT.length) return;

    const timer = window.setInterval(() => {
      setCharCount((prev) => {
        if (prev >= INSIGHT_TEXT.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 25);

    return () => window.clearInterval(timer);
  }, [started, reducedMotion, charCount]);

  const displayed = INSIGHT_TEXT.slice(0, effectiveCount);
  const finished = effectiveCount >= INSIGHT_TEXT.length;

  return (
    <div
      ref={cardRef}
      className="rounded-[14px] border border-white/[0.08] bg-[#0C1222] p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
          OBSERVATION · SLEEP & FOCUS
        </span>
        {!reducedMotion ? (
          <button
            type="button"
            onClick={() => {
              if (finished) {
                setCharCount(0);
              } else {
                setCharCount(INSIGHT_TEXT.length);
              }
            }}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            {finished ? "Replay" : "Complete"}
          </button>
        ) : null}
      </div>

      {/* Reserve full text height visually while typing to avoid layout shift */}
      <div className="relative mt-4 min-h-[5.5rem]">
        <p aria-hidden="true" className="invisible text-base leading-relaxed sm:text-lg">
          {INSIGHT_TEXT}
        </p>
        <p className="absolute inset-0 text-base leading-relaxed text-[#E6EAF5] sm:text-lg">
          {displayed}
          {!finished && !reducedMotion ? (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-[#22D3EE]"
            />
          ) : null}
        </p>
      </div>

      {/* Evidence chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        {["14 days logged", "8 nights ≥ 7.5h", "Avg Δ +1.2 focus"].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-white/[0.08] bg-[#111A30] px-2.5 py-1 font-mono text-[11px] text-[#E6EAF5]/85 tabular-nums"
          >
            {chip}
          </span>
        ))}
      </div>

      <p className="mt-4 border-t border-white/[0.08] pt-3 font-mono text-[11px] tracking-[0.04em] text-[#8A93AD]">
        Self-reported, small sample, not a diagnosis.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section 3 wrapper with sticky cover-over panels                     */
/* ------------------------------------------------------------------ */
export function InstrumentsSection() {
  const reducedMotion = usePrefersReducedMotion();
  const panel2Ref = useRef<HTMLDivElement>(null);
  const panel3Ref = useRef<HTMLDivElement>(null);

  const cover1 = useScrollProgress(panel2Ref, {
    start: "top bottom",
    end: "top top",
    disabled: reducedMotion,
    refreshKey: `inst-1-${reducedMotion}`,
  });

  const cover2 = useScrollProgress(panel3Ref, {
    start: "top bottom",
    end: "top top",
    disabled: reducedMotion,
    refreshKey: `inst-2-${reducedMotion}`,
  });

  const panel1Scale = reducedMotion ? 1 : 1 - cover1 * 0.04;
  const panel1Opacity = reducedMotion ? 1 : 1 - cover1 * 0.55;
  const panel2Scale = reducedMotion ? 1 : 1 - cover2 * 0.04;
  const panel2Opacity = reducedMotion ? 1 : 1 - cover2 * 0.55;

  return (
    <section
      id="instruments"
      aria-labelledby="instruments-heading"
      className="relative z-10 bg-[#060913]"
    >
      <h2 id="instruments-heading" className="sr-only">
        Three instruments
      </h2>

      {/* Panel 1: Brain Explorer */}
      <div
        className={cn(
          "w-full border-t border-white/[0.08] bg-[#060913]",
          reducedMotion ? "relative" : "sticky top-0 z-[1] min-h-svh",
        )}
      >
        <div
          className="mx-auto flex min-h-svh w-full max-w-7xl items-center px-5 py-20 transition-[opacity] duration-75 sm:px-10 lg:px-16"
          style={{
            transform: `scale(${panel1Scale.toFixed(4)})`,
            opacity: panel1Opacity,
            transformOrigin: "center top",
          }}
        >
          <div className="grid w-full gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="space-y-4 lg:col-span-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
                INSTRUMENT 01 · BRAIN EXPLORER
              </p>
              <h3 className="font-heading text-[clamp(1.85rem,4vw,3.25rem)] leading-[1.04] font-medium tracking-[-0.03em] text-[#E6EAF5]">
                Explore an interactive neural atlas.
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-[#8A93AD] sm:text-base">
                Select any region to see which networks and everyday activities commonly involve it,
                without claiming measurements.
              </p>
            </div>
            <div className="lg:col-span-7">
              <BrainExplorerDemo />
            </div>
          </div>
        </div>
      </div>

      {/* Panel 2: Daily Tracker */}
      <div
        ref={panel2Ref}
        className={cn(
          "w-full border-t border-white/[0.08] bg-[#060913]",
          reducedMotion ? "relative" : "sticky top-0 z-[2] min-h-svh",
        )}
      >
        <div
          className="mx-auto flex min-h-svh w-full max-w-7xl items-center px-5 py-20 transition-[opacity] duration-75 sm:px-10 lg:px-16"
          style={{
            transform: `scale(${panel2Scale.toFixed(4)})`,
            opacity: panel2Opacity,
            transformOrigin: "center top",
          }}
        >
          <div className="grid w-full gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="space-y-4 lg:col-span-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
                INSTRUMENT 02 · DAILY TRACKER
              </p>
              <h3 className="font-heading text-[clamp(1.85rem,4vw,3.25rem)] leading-[1.04] font-medium tracking-[-0.03em] text-[#E6EAF5]">
                Log daily signals in seconds.
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-[#8A93AD] sm:text-base">
                Capture sleep, focus sessions, movement, and mood with calm check-ins and zero
                streak pressure.
              </p>
            </div>
            <div className="lg:col-span-7">
              <DailyTrackerDemo reducedMotion={reducedMotion} />
            </div>
          </div>
        </div>
      </div>

      {/* Panel 3: Insight Engine */}
      <div
        ref={panel3Ref}
        className={cn(
          "w-full border-t border-white/[0.08] bg-[#060913]",
          reducedMotion ? "relative" : "sticky top-0 z-[3] min-h-svh",
        )}
      >
        <div className="mx-auto flex min-h-svh w-full max-w-7xl items-center px-5 py-20 sm:px-10 lg:px-16">
          <div className="grid w-full gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="space-y-4 lg:col-span-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
                INSTRUMENT 03 · INSIGHT ENGINE
              </p>
              <h3 className="font-heading text-[clamp(1.85rem,4vw,3.25rem)] leading-[1.04] font-medium tracking-[-0.03em] text-[#E6EAF5]">
                Notice patterns without hype.
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-[#8A93AD] sm:text-base">
                Deterministic local rules surface plain-language associations grounded directly in
                your own logs.
              </p>
            </div>
            <div className="lg:col-span-7">
              <InsightEngineDemo reducedMotion={reducedMotion} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
