"use client";

/**
 * Quality + robustness hooks for the brain canvas. Deliberately free of three/R3F
 * imports so the (SSR-rendered) shells can use useBrainStage without pulling WebGL code.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TextSizePref } from "@/types/domain";

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
export const REDUCED_MOTION_ATTR = "data-reduced-motion";
export const REDUCED_MOTION_EVENT = "nx:reduced-motion-change";

/** True when either the OS media query or UserSettings.reducedMotion is enabled. */
export function resolveReducedMotion(osReduced: boolean, settingReduced?: boolean): boolean {
  return Boolean(osReduced || settingReduced);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const osMatches = window.matchMedia(RM_QUERY).matches;
  const attrTrue =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute(REDUCED_MOTION_ATTR) === "true";
  return resolveReducedMotion(osMatches, attrTrue);
}

function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  window.addEventListener(REDUCED_MOTION_EVENT, cb);

  let observer: MutationObserver | null = null;
  if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(cb);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [REDUCED_MOTION_ATTR],
    });
  }

  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener(REDUCED_MOTION_EVENT, cb);
    observer?.disconnect();
  };
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

/* ---- high-contrast + text size ----------------------------------------- */
const HC_QUERY = "(prefers-contrast: more)";
const FC_QUERY = "(forced-colors: active)";
export const HIGH_CONTRAST_ATTR = "data-high-contrast";
export const TEXT_SIZE_ATTR = "data-text-size";
export const A11Y_PREFS_EVENT = "nx:a11y-prefs-change";

export function resolveHighContrast(
  osMoreContrast: boolean,
  osForcedColors: boolean,
  settingHighContrast?: boolean,
): boolean {
  return Boolean(osMoreContrast || osForcedColors || settingHighContrast);
}

export function normalizeTextSize(value?: string | null): TextSizePref {
  if (value === "sm" || value === "md" || value === "lg") return value;
  return "md";
}

function getHighContrastSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const hc = typeof window.matchMedia === "function" ? window.matchMedia(HC_QUERY).matches : false;
  const fc = typeof window.matchMedia === "function" ? window.matchMedia(FC_QUERY).matches : false;
  const attrTrue =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute(HIGH_CONTRAST_ATTR) === "true";
  return resolveHighContrast(hc, fc, attrTrue);
}

function subscribeHighContrast(cb: () => void): () => void {
  const hcMq = typeof window.matchMedia === "function" ? window.matchMedia(HC_QUERY) : null;
  const fcMq = typeof window.matchMedia === "function" ? window.matchMedia(FC_QUERY) : null;
  hcMq?.addEventListener("change", cb);
  fcMq?.addEventListener("change", cb);
  window.addEventListener(A11Y_PREFS_EVENT, cb);

  let observer: MutationObserver | null = null;
  if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(cb);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [HIGH_CONTRAST_ATTR],
    });
  }

  return () => {
    hcMq?.removeEventListener("change", cb);
    fcMq?.removeEventListener("change", cb);
    window.removeEventListener(A11Y_PREFS_EVENT, cb);
    observer?.disconnect();
  };
}

export function useHighContrast(): boolean {
  return useSyncExternalStore(subscribeHighContrast, getHighContrastSnapshot, () => false);
}

function getTextSizeSnapshot(): TextSizePref {
  if (typeof document === "undefined") return "md";
  return normalizeTextSize(document.documentElement.getAttribute(TEXT_SIZE_ATTR));
}

function subscribeTextSize(cb: () => void): () => void {
  window.addEventListener(A11Y_PREFS_EVENT, cb);
  let observer: MutationObserver | null = null;
  if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(cb);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [TEXT_SIZE_ATTR],
    });
  }
  return () => {
    window.removeEventListener(A11Y_PREFS_EVENT, cb);
    observer?.disconnect();
  };
}

export function useTextSize(): TextSizePref {
  return useSyncExternalStore(subscribeTextSize, getTextSizeSnapshot, () => "md");
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
  const [hasSize, setHasSize] = useState(true);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => setOnScreen(entry ? entry.isIntersecting : true),
        { rootMargin: "120px" },
      );
      io.observe(el);
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) {
          setHasSize(rect.width > 0 && rect.height > 0);
        }
      });
      ro.observe(el);
    }

    return () => {
      io?.disconnect();
      ro?.disconnect();
    };
  }, []);

  const markLost = useCallback(() => setLost(true), []);
  const retry = useCallback(() => setLost(false), []);
  return { ref, webgl, active: tabVisible && onScreen && hasSize, lost, markLost, retry };
}
