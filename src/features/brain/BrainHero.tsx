"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

import { cn } from "@/lib/utils";
import { BrainFallback } from "./BrainFallback";
import {
  useBrainQuality,
  useBrainStage,
  useHighContrast,
  usePrefersReducedMotion,
  useTextSize,
  type BrainQuality,
} from "./useBrainQuality";

export type BrainReadinessStage = "chunk" | "geometry" | "shaders" | "firstFrame";

export interface BrainReadinessProgress {
  stage: BrainReadinessStage;
  /** Progress within the current stage (0..1). */
  value: number;
  pointsPlaced?: number;
  pointsTotal?: number;
}

export interface BrainHeroProps {
  progress?: number; // 0..1 scroll
  interactive?: boolean;
  className?: string;
  onProgress?: (info: BrainReadinessProgress) => void;
  onReady?: () => void;
}

interface HeroCanvasComponentProps {
  progress: number;
  interactive: boolean;
  quality: BrainQuality;
  reducedMotion: boolean;
  highContrast: boolean;
  active: boolean;
  onContextLost: () => void;
  onProgress?: (info: BrainReadinessProgress) => void;
  onReady?: () => void;
}

export function BrainHero({
  progress = 0,
  interactive = false,
  className,
  onProgress,
  onReady,
}: BrainHeroProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const qualityState = useBrainQuality("auto");
  const reducedMotion = usePrefersReducedMotion();
  const highContrast = useHighContrast();
  const textSize = useTextSize();
  const { ref, webgl, active, lost, markLost, retry } = useBrainStage<HTMLDivElement>();

  const [CanvasComp, setCanvasComp] =
    useState<ComponentType<HeroCanvasComponentProps> | null>(null);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onProgressRef.current = onProgress;
    onReadyRef.current = onReady;
  }, [onProgress, onReady]);

  useEffect(() => {
    if (webgl !== true || lost || CanvasComp) return;
    let cancelled = false;
    onProgressRef.current?.({ stage: "chunk", value: 0.25 });

    void import("./BrainScene").then((m) => {
      if (cancelled) return;
      onProgressRef.current?.({ stage: "chunk", value: 1 });
      setCanvasComp(() => m.BrainHeroCanvas);
    });

    return () => {
      cancelled = true;
    };
  }, [webgl, lost, CanvasComp]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Interactive 3D particle brain preview"
      data-high-contrast={highContrast ? "true" : "false"}
      data-text-size={textSize}
      className={cn(
        "relative h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-[#060913] sm:h-[520px]",
        className,
      )}
    >
      {webgl === false || lost ? (
        <BrainFallback lost={lost} onRetry={retry} />
      ) : webgl === true && CanvasComp ? (
        <CanvasComp
          progress={clamped}
          interactive={interactive}
          quality={qualityState}
          reducedMotion={reducedMotion}
          highContrast={highContrast}
          active={active}
          onContextLost={markLost}
          onProgress={(info) => onProgressRef.current?.(info)}
          onReady={() => onReadyRef.current?.()}
        />
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );
}
