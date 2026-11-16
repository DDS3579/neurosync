"use client";

import { forwardRef, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/utils";
import { BrainPoster } from "./BrainPoster";

gsap.registerPlugin(ScrollTrigger);

interface BeatSpec {
  index: string;
  title: string;
  body: string;
  range: readonly [number, number];
}

const BEATS: readonly BeatSpec[] = [
  {
    index: "01",
    title: "Explore",
    body: "Wander through an interactive atlas of the brain.",
    range: [0.15, 0.35],
  },
  {
    index: "02",
    title: "Track",
    body: "Log sleep, focus, movement and mood in seconds.",
    range: [0.4, 0.6],
  },
  {
    index: "03",
    title: "Discover",
    body: "See patterns in your own data. Associations, never diagnoses.",
    range: [0.65, 0.85],
  },
] as const;

const RAIL_TICKS = [
  { label: "01", pos: 0.25, range: [0.15, 0.35] as const },
  { label: "02", pos: 0.5, range: [0.4, 0.6] as const },
  { label: "03", pos: 0.75, range: [0.65, 0.85] as const },
];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Returns 0..1 visibility and subtle vertical offset (px) for a beat window [start, end].
 */
function beatEnvelope(progress: number, start: number, end: number): { opacity: number; y: number } {
  const fade = 0.05;
  if (progress <= start || progress >= end) {
    return { opacity: 0, y: progress <= start ? 16 : -14 };
  }
  const enter = smoothstep(start, start + fade, progress);
  const exit = 1 - smoothstep(end - fade, end, progress);
  const opacity = Math.min(enter, exit);
  const y = progress < start + fade ? (1 - enter) * 16 : progress > end - fade ? -(1 - exit) * 14 : 0;
  return { opacity, y };
}

export interface DescentSectionProps {
  progress: number;
  isMobile: boolean;
  reducedMotion: boolean;
}

/**
 * Section 2: The Descent.
 * Pins via GSAP ScrollTrigger (~300vh desktop, 200vh mobile) and scrubs BrainHero 0 -> 1
 * across three narrated beats. Under prefers-reduced-motion, renders as a static vertical list
 * paired with a static brain poster and no pin.
 */
export const DescentSection = forwardRef<HTMLElement, DescentSectionProps>(
  function DescentSection({ progress, isMobile, reducedMotion }, forwardedRef) {
    const localSectionRef = useRef<HTMLElement | null>(null);
    const pinRef = useRef<HTMLDivElement>(null);

    const setSectionRef = (node: HTMLElement | null) => {
      localSectionRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    useEffect(() => {
      if (reducedMotion) return;
      const sectionEl = localSectionRef.current;
      const pinEl = pinRef.current;
      if (!sectionEl || !pinEl) return;

      const multiplier = isMobile ? 2 : 3;
      const st = ScrollTrigger.create({
        trigger: sectionEl,
        pin: pinEl,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * multiplier)}`,
        scrub: true,
        invalidateOnRefresh: true,
      });

      ScrollTrigger.refresh();

      return () => {
        st.kill();
      };
    }, [isMobile, reducedMotion]);

    if (reducedMotion) {
      return (
        <section
          id="descent"
          ref={setSectionRef}
          aria-labelledby="descent-heading"
          className="relative z-10 border-t border-white/[0.08] bg-[#060913] px-5 py-20 sm:px-10 sm:py-28 lg:px-16"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                <BrainPoster className="aspect-[4/3] w-full" />
              </div>
            </div>

            <div className="space-y-10 lg:col-span-7">
              <div className="space-y-2 border-b border-white/[0.08] pb-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
                  DESCENT / 02
                </p>
                <h2
                  id="descent-heading"
                  className="font-heading text-2xl font-medium tracking-[-0.02em] text-[#E6EAF5] sm:text-3xl"
                >
                  From cosmic scale to personal signal.
                </h2>
              </div>

              <ol className="space-y-8">
                {BEATS.map((beat) => (
                  <li
                    key={beat.index}
                    className="border-b border-white/[0.08] pb-6 last:border-b-0 last:pb-0"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
                      {beat.index}
                    </p>
                    <h3 className="mt-2 font-heading text-2xl font-medium tracking-[-0.03em] text-[#E6EAF5] sm:text-3xl">
                      {beat.title}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8A93AD] sm:text-base">
                      {beat.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        id="descent"
        ref={setSectionRef}
        aria-labelledby="descent-heading"
        className="pointer-events-none relative w-full"
      >
        <h2 id="descent-heading" className="sr-only">
          How NeuroSync works
        </h2>

        <div
          ref={pinRef}
          className="pointer-events-none relative flex h-svh w-full flex-col justify-between overflow-hidden px-5 pt-20 pb-10 sm:px-10 sm:pt-24 sm:pb-12 lg:px-16"
        >
          {/* Subtle readability scrim on mobile lower half & desktop left edge */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060913]/85 via-transparent to-transparent md:bg-gradient-to-r md:from-[#060913]/75 md:via-[#060913]/25 md:to-transparent"
          />

          {/* Top edge hairline indicator */}
          <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/[0.08] pb-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
              THE DESCENT / 02
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] tabular-nums">
              DEPTH {progress.toFixed(2)}
            </span>
          </div>

          {/* Narrated beats stage */}
          <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-end pb-8 md:items-center md:pb-0">
            <div className="relative h-44 w-full max-w-md sm:h-48">
              {BEATS.map((beat) => {
                const { opacity, y } = beatEnvelope(progress, beat.range[0], beat.range[1]);
                return (
                  <article
                    key={beat.index}
                    className="absolute inset-x-0 bottom-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
                    style={{
                      opacity,
                      transform: `translate3d(0, ${y.toFixed(1)}px, 0)`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
                        {beat.index}
                      </span>
                      <span aria-hidden="true" className="h-px w-8 bg-white/[0.16]" />
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
                        BEAT
                      </span>
                    </div>

                    <h3 className="mt-3 font-heading text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-medium tracking-[-0.03em] text-[#E6EAF5]">
                      {beat.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-[#E6EAF5]/80 sm:text-base">
                      {beat.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Bottom edge micro-label */}
          <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-t border-white/[0.08] pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
              NEBULA → CORTEX → LIMBIC
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
              SCROLL TO TRAVEL
            </span>
          </div>

          {/* Right-edge vertical progress rail with mono ticks */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 flex-col items-end gap-2 sm:right-8"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A93AD] tabular-nums">
              0.0
            </span>

            <div className="relative h-44 w-px bg-white/[0.12] sm:h-60">
              <div
                className="absolute inset-x-0 top-0 h-full origin-top bg-gradient-to-b from-[#22D3EE] to-[#8B5CF6]"
                style={{ transform: `scaleY(${clamp01(progress)})` }}
              />

              {RAIL_TICKS.map((tick) => {
                const active = progress >= tick.range[0] && progress <= tick.range[1];
                return (
                  <div
                    key={tick.label}
                    className="absolute right-0 flex -translate-y-1/2 items-center gap-1.5"
                    style={{ top: `${tick.pos * 100}%` }}
                  >
                    <span
                      className={cn(
                        "font-mono text-[10px] tracking-[0.18em] tabular-nums transition-colors duration-200",
                        active ? "text-[#22D3EE]" : "text-[#8A93AD]/60",
                      )}
                    >
                      {tick.label}
                    </span>
                    <span
                      className={cn(
                        "block h-px transition-all duration-200",
                        active ? "w-3 bg-[#22D3EE]" : "w-1.5 bg-white/[0.22]",
                      )}
                    />
                  </div>
                );
              })}
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#22D3EE] tabular-nums">
              {progress.toFixed(2)}
            </span>
          </div>
        </div>
      </section>
    );
  },
);
