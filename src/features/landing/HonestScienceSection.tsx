"use client";

import { useRef } from "react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { cn } from "@/lib/utils";
import { useInViewOnce } from "./useInViewOnce";

const CONTRAST_PAIRS = [
  {
    id: "claim-1",
    avoid: "Your prefrontal cortex grew 3% today.",
    neurosync: "This activity commonly involves prefrontal and parietal regions.",
  },
  {
    id: "claim-2",
    avoid: "Your brain score dropped to 64 after a late night.",
    neurosync: "On shorter nights, your self-rated focus averaged 1.1 points lower.",
  },
  {
    id: "claim-3",
    avoid: "NeuroSync detected an attention deficit in your logs.",
    neurosync: "Association observed across 12 check-ins — never a clinical diagnosis.",
  },
] as const;

/**
 * Section 4: Honest Science manifesto and two-column contrast pairs revealed on scroll.
 */
export function HonestScienceSection() {
  const reducedMotion = usePrefersReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const revealed = useInViewOnce(listRef, { threshold: 0.2, disabled: reducedMotion });

  return (
    <section
      id="honest-science"
      aria-labelledby="honest-science-heading"
      className="relative z-10 border-t border-white/[0.08] bg-[#060913] px-5 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl space-y-16">
        <div className="max-w-4xl space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
            PRINCIPLE / 03 · SCIENTIFIC HONESTY
          </p>
          <h2
            id="honest-science-heading"
            className="font-heading text-[clamp(2rem,5.2vw,4.25rem)] leading-[1.02] font-medium tracking-[-0.04em] text-[#E6EAF5]"
          >
            We don&apos;t measure your brain. We help you understand it.
          </h2>
        </div>

        <div ref={listRef} className="border-t border-white/[0.08]">
          {/* Column headers */}
          <div className="hidden grid-cols-12 gap-6 border-b border-white/[0.08] py-4 md:grid">
            <span className="col-span-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD]">
              CLAIMS WE REFUSE
            </span>
            <span className="col-span-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
              NEUROSYNC LANGUAGE
            </span>
          </div>

          <ul className="divide-y divide-white/[0.08]">
            {CONTRAST_PAIRS.map((pair, idx) => (
              <li
                key={pair.id}
                className={cn(
                  "grid gap-5 py-8 transition-all duration-700 ease-out motion-reduce:transition-none md:grid-cols-12 md:gap-8 md:py-10",
                  revealed
                    ? "translate-y-0 opacity-100"
                    : "translate-y-5 opacity-0",
                )}
                style={{
                  transitionDelay: reducedMotion ? "0ms" : `${idx * 120}ms`,
                }}
              >
                <div className="md:col-span-6">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A93AD] md:hidden">
                    Claims we refuse
                  </span>
                  <p className="text-base leading-relaxed text-[#8A93AD] line-through decoration-white/25 sm:text-lg">
                    &ldquo;{pair.avoid}&rdquo;
                  </p>
                </div>

                <div className="flex items-start gap-3 md:col-span-6">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 hidden size-1.5 shrink-0 rounded-full bg-[#22D3EE] md:inline-block"
                  />
                  <div>
                    <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-[#22D3EE] md:hidden">
                      NeuroSync language
                    </span>
                    <p className="text-base leading-relaxed font-medium text-[#E6EAF5] sm:text-lg">
                      &ldquo;{pair.neurosync}&rdquo;
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
