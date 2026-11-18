"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { useSmoothScroll } from "./SmoothScroll";

const HEADLINE_LINES = [
  "Understand",
  "your brain.",
  "Understand yourself.",
] as const;

/**
 * Decorative observatory coordinate readout updating via DOM ref (no React re-renders).
 */
function ObservatoryReadout() {
  const readoutRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = readoutRef.current;
    if (!el || reducedMotion) return;

    let step = 0;
    const id = window.setInterval(() => {
      step = (step + 1) % 3600;
      const raMin = (50 + Math.floor(step / 60)) % 60;
      const raSec = step % 60;
      const az = (142.4 + Math.sin(step * 0.04) * 3.2).toFixed(1);
      el.textContent = `RA 19h ${String(raMin).padStart(2, "0")}m ${String(raSec).padStart(2, "0")}s · AZ ${az}°`;
    }, 500);

    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] tabular-nums sm:flex"
    >
      <span className="inline-block h-px w-6 bg-white/[0.16]" />
      <span ref={readoutRef}>RA 19h 50m 00s · AZ 142.4°</span>
    </div>
  );
}

/**
 * Section 1: 100svh observatory hero.
 * Pointer events pass through the wrapper to the underlying BrainHero canvas on desktop,
 * while interactive links and buttons capture pointer events normally.
 */
export interface HeroSectionProps {
  /** Paused while intro overlay hides the hero; starts at ~60% of the aperture reveal. */
  headlineActive?: boolean;
}

export function HeroSection({ headlineActive = true }: HeroSectionProps) {
  const { scrollTo } = useSmoothScroll();

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="pointer-events-none relative flex min-h-svh w-full flex-col justify-between px-5 pt-20 pb-8 sm:px-10 sm:pt-24 sm:pb-10 lg:px-16"
    >
      {/* Top edge micro-labels */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/[0.08] pb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
          NEUROSYNC / 01
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
          OBSERVATORY
        </span>
      </div>

      {/* Center / lower-left monumental headline + CTAs */}
      <div className="mx-auto my-auto flex w-full max-w-7xl flex-col gap-8 py-10 sm:gap-10">
        <div className="max-w-5xl">
          <h1
            id="hero-heading"
            className="font-heading text-[clamp(2.25rem,8.4vw,7.5rem)] leading-[0.94] font-medium tracking-[-0.04em] text-[#E6EAF5]"
          >
            {HEADLINE_LINES.map((line, index) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <span
                  className={
                    headlineActive
                      ? "nx-line-reveal block will-change-transform"
                      : "block translate-y-[110%] opacity-0 will-change-transform"
                  }
                  style={headlineActive ? { animationDelay: `${index * 80}ms` } : undefined}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-[#8A93AD] sm:text-base">
          An observatory for your inner universe. Explore an interactive particle atlas, log daily
          signals in seconds, and inspect honest local patterns.
        </p>

        <div className="pointer-events-auto flex flex-wrap items-center gap-6">
          <Link
            href="/overview"
            className="inline-flex h-11 items-center gap-2.5 rounded-[10px] border border-[#8B5CF6]/70 bg-[#7C3AED] px-5 text-sm font-medium text-white transition-colors hover:bg-[#8B5CF6]"
          >
            Enter the observatory
            <span aria-hidden="true">→</span>
          </Link>

          <a
            href="#descent"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("#descent");
            }}
            className="inline-flex h-11 items-center gap-2 px-1 text-sm text-[#8A93AD] underline-offset-4 transition-colors hover:text-[#E6EAF5] hover:underline"
          >
            How it works
            <span aria-hidden="true" className="font-mono text-xs text-[#22D3EE]">
              ↓
            </span>
          </a>
        </div>
      </div>

      {/* Bottom edge hairline + decorative telemetry */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-white/[0.08] pt-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
          LOCAL-FIRST · NO ACCOUNT
        </span>
        <ObservatoryReadout />
      </div>
    </section>
  );
}
