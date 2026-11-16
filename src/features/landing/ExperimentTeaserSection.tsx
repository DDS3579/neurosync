"use client";

import { useRef } from "react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { useInViewOnce } from "./useInViewOnce";

const BASELINE_BARS = [2.8, 3.3, 2.7, 3.2, 3.0, 3.5, 3.2] as const; // avg 3.1
const INTERVENTION_BARS = [3.4, 3.8, 3.6, 4.1, 3.9, 4.0, 3.8] as const; // avg 3.8

function BarWeek({
  label,
  values,
  entered,
  reducedMotion,
  accent,
  delayOffset,
}: {
  label: string;
  values: readonly number[];
  entered: boolean;
  reducedMotion: boolean;
  accent: "muted" | "cyan";
  delayOffset: number;
}) {
  return (
    <div className="rounded-[12px] border border-white/[0.08] bg-[#060913]/75 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6EAF5]">
          {label}
        </span>
        <span className="font-mono text-[11px] text-[#8A93AD] tabular-nums">
          7 nights
        </span>
      </div>

      <div
        className="mt-5 flex h-32 items-end gap-2 border-b border-white/[0.12] pb-2"
        role="img"
        aria-label={`${label} daily concentration ratings: ${values.join(", ")}`}
      >
        {values.map((val, idx) => {
          const pct = (val / 5) * 100;
          return (
            <div key={idx} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] text-[#8A93AD] tabular-nums">
                {val.toFixed(1)}
              </span>
              <div className="flex h-20 w-full items-end">
                <div
                  className={
                    accent === "cyan"
                      ? "w-full rounded-t-[3px] bg-[#22D3EE]"
                      : "w-full rounded-t-[3px] bg-[#8A93AD]/55"
                  }
                  style={{
                    height: `${pct}%`,
                    transformOrigin: "bottom",
                    transform: `scaleY(${entered ? 1 : 0})`,
                    transition: reducedMotion
                      ? "none"
                      : `transform 520ms cubic-bezier(0.16, 1, 0.3, 1) ${delayOffset + idx * 55}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-7 text-center font-mono text-[10px] text-[#8A93AD]">
        {values.map((_, idx) => (
          <span key={idx}>D{idx + 1}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Section 5: Experiment Lab teaser with baseline vs intervention weekly comparison.
 */
export function ExperimentTeaserSection() {
  const reducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const entered = useInViewOnce(cardRef, { threshold: 0.25, disabled: reducedMotion });

  return (
    <section
      id="experiments"
      aria-labelledby="experiments-heading"
      className="relative z-10 border-t border-white/[0.08] bg-[#060913] px-5 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl space-y-12">
        <div className="max-w-3xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
            METHOD / 04 · EXPERIMENT LAB
          </p>
          <h2
            id="experiments-heading"
            className="font-heading text-[clamp(1.85rem,4.5vw,3.5rem)] leading-[1.04] font-medium tracking-[-0.03em] text-[#E6EAF5]"
          >
            Test one small change at a time.
          </h2>
        </div>

        <article
          ref={cardRef}
          className="rounded-[14px] border border-white/[0.08] bg-[#0C1222] p-6 sm:p-8 lg:p-10"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
                N-OF-1 SELF-EXPERIMENT · EXAMPLE
              </span>
              <h3 className="font-heading text-xl font-medium tracking-[-0.02em] text-[#E6EAF5] sm:text-2xl">
                Does a steadier bedtime change how focused I feel?
              </h3>
              <p className="max-w-2xl text-sm leading-relaxed text-[#8A93AD]">
                Hypothesis: Keeping bedtime within a 30-minute window for 7 nights will coincide
                with steadier morning concentration.
              </p>
            </div>

            <span className="rounded-full border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#22D3EE]">
              14-day window
            </span>
          </div>

          {/* Two bar groups */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <BarWeek
              label="Baseline week"
              values={BASELINE_BARS}
              entered={entered}
              reducedMotion={reducedMotion}
              accent="muted"
              delayOffset={0}
            />
            <BarWeek
              label="Intervention week"
              values={INTERVENTION_BARS}
              entered={entered}
              reducedMotion={reducedMotion}
              accent="cyan"
              delayOffset={180}
            />
          </div>

          <div className="mt-8 flex flex-col justify-between gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center">
            <p className="font-mono text-xs tracking-[0.04em] text-[#E6EAF5] tabular-nums sm:text-sm">
              Average concentration: <span className="text-[#8A93AD]">3.1</span> →{" "}
              <span className="text-[#22D3EE]">3.8</span> (self-rated)
            </p>
            <p className="font-mono text-[11px] tracking-[0.04em] text-[#8A93AD]">
              This comparison doesn&apos;t prove cause and effect.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
