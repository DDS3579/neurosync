"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import { BrainFallback } from "./BrainFallback";
import { useBrainQuality, useBrainStage, usePrefersReducedMotion } from "./useBrainQuality";

export interface BrainHeroProps {
  progress?: number; // 0..1 scroll
  interactive?: boolean;
  className?: string;
}

const BrainHeroCanvas = dynamic(
  () => import("./BrainScene").then((m) => m.BrainHeroCanvas),
  { ssr: false },
);

export function BrainHero({ progress = 0, interactive = false, className }: BrainHeroProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const qualityState = useBrainQuality("auto");
  const reducedMotion = usePrefersReducedMotion();
  const { ref, webgl, active, lost, markLost, retry } = useBrainStage<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060913] sm:h-[520px]",
        className,
      )}
    >
      {webgl === false || lost ? (
        <BrainFallback lost={lost} onRetry={retry} />
      ) : webgl === true ? (
        <BrainHeroCanvas
          progress={clamped}
          interactive={interactive}
          quality={qualityState}
          reducedMotion={reducedMotion}
          active={active}
          onContextLost={markLost}
        />
      ) : (
        <div className="h-full w-full bg-[#060913]" />
      )}
    </div>
  );
}
