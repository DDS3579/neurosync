"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { useScrollProgress } from "./useScrollProgress";

interface DustParticle {
  angle: number;
  radius: number; // normalized 0.18..0.52 of min dimension
  size: number;
  alpha: number;
  cyan: boolean;
}

function createDustParticles(): DustParticle[] {
  const out: DustParticle[] = [];
  const total = 84;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const t = (i + 0.5) / total;
    out.push({
      angle: i * golden,
      radius: 0.18 + Math.sqrt(t) * 0.36,
      size: 0.9 + (i % 3) * 0.45,
      alpha: 0.22 + (1 - t) * 0.5,
      cyan: i % 3 !== 0,
    });
  }
  return out;
}

const DUST = createDustParticles();

/**
 * Section 7: Final CTA with scroll-converging dust canvas + minimal footer.
 */
export function FinalCtaFooter() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const progress = useScrollProgress(sectionRef, {
    start: "top bottom",
    end: "center center",
    disabled: reducedMotion,
    refreshKey: `final-cta-${reducedMotion}`,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.54;
      const spread = Math.min(w, h);
      const converge = reducedMotion ? 0.35 : progress;

      for (let i = 0; i < DUST.length; i++) {
        const p = DUST[i];
        const r = p.radius * spread * (1 - converge * 0.62);
        const theta = p.angle + converge * 0.45;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r * 0.72;

        ctx.fillStyle = p.cyan
          ? `rgba(34, 211, 238, ${p.alpha})`
          : `rgba(139, 92, 246, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    window.addEventListener("resize", draw, { passive: true });
    return () => window.removeEventListener("resize", draw);
  }, [progress, reducedMotion]);

  return (
    <section
      id="ready"
      ref={sectionRef}
      aria-labelledby="final-cta-heading"
      className="relative z-10 border-t border-white/[0.08] bg-[#060913]"
    >
      {/* Converging dust CTA stage */}
      <div className="relative flex min-h-[70svh] w-full flex-col items-center justify-center overflow-hidden px-5 py-24 text-center sm:px-10">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#22D3EE]">
            OBSERVATORY / 06
          </p>
          <h2
            id="final-cta-heading"
            className="font-heading text-[clamp(2.25rem,6vw,5rem)] leading-[0.98] font-medium tracking-[-0.04em] text-[#E6EAF5]"
          >
            Ready to look inward?
          </h2>
          <Link
            href="/overview"
            className="inline-flex h-12 items-center gap-2.5 rounded-[10px] border border-[#8B5CF6]/70 bg-[#7C3AED] px-6 text-sm font-medium text-white transition-colors hover:bg-[#8B5CF6]"
          >
            Enter the observatory
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.08] bg-[#060913] px-5 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6EAF5]">
            <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-[#22D3EE]" />
            NEUROSYNC
          </span>
          <p className="text-xs text-[#8A93AD]">
            NeuroSync is an educational and self-reflection tool, not a medical device.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6">
          <Link
            href="/overview"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            Overview
          </Link>
          <Link
            href="/library"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            Library
          </Link>
          <Link
            href="/settings"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A93AD] transition-colors hover:text-[#E6EAF5]"
          >
            Settings
          </Link>
        </nav>
      </div>
    </footer>
  );
}
