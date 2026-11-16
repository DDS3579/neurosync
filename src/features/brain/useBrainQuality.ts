"use client";

/**
 * Quality + robustness hooks for the brain canvas. Deliberately free of three/R3F
 * imports so the (SSR-rendered) shells can use useBrainStage without pulling WebGL code.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type QualityPref = "auto" | "low" | "high";
export type QualityTier = "low" | "high";

/* TUNABLES */
export const QUALITY_PRESETS = {
  high: { points: 60000, dprCap: 1.5, postprocessing: true },
  low: { points: 20000, dprCap: 1, postprocessing: false },
} as const;
/** Step down from high to low when the average FPS stays below minFps for windowSec. */
export const FPS_GOVERNOR = { minFps: 45, windowSec: 2, warmupSec: 1.5 } as const;

export interface BrainQuality {
  tier: QualityTier;
  dpr: number;
  pointCount: number;
  postprocessing: boolean;
  /** Called by the FPS governor (only effective for quality="auto"). */
  downgrade: () => void;
}

function detectTier(): QualityTier {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "high";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const dpr = window.devicePixelRatio || 1;
  if (mobile || cores <= 4 || memory <= 4) return "low";
  if (dpr > 2.5 && cores < 8) return "low";
  return "high";
}

export function useBrainQuality(pref: QualityPref): BrainQuality {
  const [autoTier, setAutoTier] = useState<QualityTier>(detectTier);
  const tier: QualityTier = pref === "auto" ? autoTier : pref;
  const preset = QUALITY_PRESETS[tier];
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const downgrade = useCallback(() => setAutoTier("low"), []);
  return {
    tier,
    dpr: Math.min(deviceDpr, preset.dprCap),
    pointCount: preset.points,
    postprocessing: preset.postprocessing,
    downgrade,
  };
}

/* ---- prefers-reduced-motion -------------------------------------------- */
const RM_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(RM_QUERY).matches, () => false);
}

/* ---- WebGL support ----------------------------------------------------- */
let webglSupport: boolean | undefined;
function detectWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglSupport = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

/* ---- tab visibility ---------------------------------------------------- */
function subscribeVisibility(cb: () => void): () => void {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

/**
 * Stage state shared by BrainExplorer and BrainHero:
 * - webgl: null while unknown (SSR), then true/false
 * - active: false when the tab is hidden or the stage is off-screen (render loop pauses)
 * - lost/markLost/retry: WebGL context-loss handling
 */
export function useBrainStage<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const webgl = useSyncExternalStore<boolean | null>(noopSubscribe, detectWebGL, () => null);
  const tabVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => true);
  const [onScreen, setOnScreen] = useState(true);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry ? entry.isIntersecting : true), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const markLost = useCallback(() => setLost(true), []);
  const retry = useCallback(() => setLost(false), []);
  return { ref, webgl, active: tabVisible && onScreen, lost, markLost, retry };
}
