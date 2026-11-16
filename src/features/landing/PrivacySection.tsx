"use client";

import { useRef } from "react";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { useInViewOnce } from "./useInViewOnce";

/**
 * Section 6: Local-first privacy architecture diagram and explicit storage honesty.
 */
export function PrivacySection() {
  const reducedMotion = usePrefersReducedMotion();
  const diagramRef = useRef<HTMLDivElement>(null);
  const entered = useInViewOnce(diagramRef, { threshold: 0.3, disabled: reducedMotion });

  return (
    <section
      id="privacy"
      aria-labelledby="privacy-heading"
      className="relative z-10 border-t border-white/[0.08] bg-[#060913] px-5 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-12 lg:items-center">
        <div className="space-y-6 lg:col-span-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
            ARCHITECTURE / 05 · PRIVACY
          </p>
          <h2
            id="privacy-heading"
            className="font-heading text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] font-medium tracking-[-0.03em] text-[#E6EAF5]"
          >
            Your data lives in your browser.
          </h2>

          <ul className="flex flex-wrap gap-2" aria-label="Privacy guarantees">
            {["NO ACCOUNTS", "NO ANALYTICS", "NO AI API"].map((tag) => (
              <li
                key={tag}
                className="rounded-md border border-white/[0.1] bg-[#0C1222] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6EAF5]"
              >
                {tag}
              </li>
            ))}
          </ul>

          <p className="max-w-md text-sm leading-relaxed text-[#8A93AD]">
            Export a JSON backup anytime. Data isn&apos;t encrypted on your device.
          </p>
        </div>

        {/* SVG architecture diagram */}
        <div
          ref={diagramRef}
          className="rounded-[14px] border border-white/[0.08] bg-[#0C1222] p-5 sm:p-8 lg:col-span-7"
        >
          <svg
            viewBox="0 0 560 250"
            className="h-auto w-full"
            role="img"
            aria-label="Diagram showing Your data in IndexedDB on your device with blocked outbound arrows to external cloud servers and analytics"
          >
            {/* Device outline */}
            <rect
              x="18"
              y="32"
              width="228"
              height="186"
              rx="14"
              fill="#060913"
              stroke="rgba(34,211,238,0.45)"
              strokeWidth="1.5"
            />
            <rect
              x="30"
              y="46"
              width="204"
              height="140"
              rx="8"
              fill="rgba(17,26,48,0.55)"
              stroke="rgba(255,255,255,0.08)"
            />
            <circle cx="132" cy="202" r="4" fill="rgba(255,255,255,0.22)" />

            <text
              x="132"
              y="102"
              textAnchor="middle"
              fill="#22D3EE"
              fontSize="11"
              fontFamily="monospace"
              letterSpacing="2"
            >
              LOCAL DEVICE
            </text>
            <text
              x="132"
              y="128"
              textAnchor="middle"
              fill="#E6EAF5"
              fontSize="15"
              fontWeight="500"
              fontFamily="sans-serif"
            >
              Your data (IndexedDB)
            </text>

            {/* Arrow 1 -> Cloud */}
            <path
              d="M 248 92 L 386 72"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <polygon points="384,67 394,71 386,77" fill="rgba(255,255,255,0.28)" />

            {/* Arrow 2 -> Analytics */}
            <path
              d="M 248 158 L 386 178"
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <polygon points="386,173 394,179 384,183" fill="rgba(255,255,255,0.28)" />

            {/* Cloud node */}
            <g transform="translate(402, 32)">
              <rect
                x="0"
                y="0"
                width="136"
                height="74"
                rx="10"
                fill="#060913"
                stroke="rgba(255,255,255,0.1)"
              />
              {/* Cloud icon */}
              <path
                d="M 54 40 H 82 C 86 40 89 37 89 33 C 89 29.5 86.5 26.8 83 26.2 C 81.8 21 77.2 17.5 71.8 17.5 C 66.2 17.5 61.5 21.4 60.5 26.8 C 56.5 27.2 53.5 30.3 53.5 34.2 C 53.5 37.4 55.2 40 54 40 Z"
                fill="none"
                stroke="#8A93AD"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <text
                x="68"
                y="59"
                textAnchor="middle"
                fill="#8A93AD"
                fontSize="10"
                fontFamily="monospace"
                letterSpacing="1.6"
              >
                CLOUD SYNC
              </text>
              {/* Animated slash across cloud */}
              <line
                x1="16"
                y1="62"
                x2="120"
                y2="12"
                stroke="#F87171"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={entered ? 0 : 1}
                style={{
                  transition: reducedMotion ? "none" : "stroke-dashoffset 550ms ease-out 150ms",
                }}
              />
            </g>

            {/* Analytics node */}
            <g transform="translate(402, 144)">
              <rect
                x="0"
                y="0"
                width="136"
                height="74"
                rx="10"
                fill="#060913"
                stroke="rgba(255,255,255,0.1)"
              />
              {/* Analytics bars icon */}
              <path
                d="M 55 40 V 30 M 64 40 V 22 M 73 40 V 27 M 82 40 V 18"
                fill="none"
                stroke="#8A93AD"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <text
                x="68"
                y="59"
                textAnchor="middle"
                fill="#8A93AD"
                fontSize="10"
                fontFamily="monospace"
                letterSpacing="1.6"
              >
                ANALYTICS
              </text>
              {/* Animated slash across analytics */}
              <line
                x1="16"
                y1="62"
                x2="120"
                y2="12"
                stroke="#F87171"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={entered ? 0 : 1}
                style={{
                  transition: reducedMotion ? "none" : "stroke-dashoffset 550ms ease-out 320ms",
                }}
              />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
