"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { IntroMachineState } from "./introMachine";
import { INTRO_TIMING, getExitDurationMs } from "./introMachine";
import { LoaderParticleEngine, computeSilhouetteLayout } from "./loaderParticles";
import {
  IGNITION_ORDER,
  INTRO_DISCLAIMER,
  REGION_CAPTIONS,
} from "./silhouetteData";
import "./intro.css";

export interface IntroLoaderProps {
  state: IntroMachineState;
  onSkip: () => void;
}

const REDUCED_MOTION_SUMMARY =
  "Cortex, cerebellum, hippocampus, and amygdala — planning, spatial attention, language, vision, movement, and memory associations.";

const COARSE_ANNOUNCEMENTS: Record<IntroMachineState["stage"], string> = {
  chunk: "Loading the observatory",
  geometry: "Placing particles",
  shaders: "Compiling shaders",
  firstFrame: "First light",
};

export function IntroLoader({ state, onSkip }: IntroLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LoaderParticleEngine | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [shortLandscape, setShortLandscape] = useState(false);

  const isMinimal = state.variant === "minimal";
  const showFullStage = !isMinimal;
  const showCanvas =
    showFullStage &&
    (state.phase === "loading" || state.phase === "ready" || state.phase === "exiting" || state.phase === "skipped");

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setHydrated(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Track short-landscape layout threshold cleanly on resize.
  useEffect(() => {
    const updateHeight = () => {
      setShortLandscape(window.innerHeight < 480);
    };
    updateHeight();
    window.addEventListener("resize", updateHeight, { passive: true });
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Instantiate and clean up 2D particle engine when canvas stage mounts.
  useEffect(() => {
    if (!showFullStage || !state.overlayMounted) return;
    const canvas = canvasRef.current;
    const container = overlayRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth || 1280;
    const h = rect.height || window.innerHeight || 720;
    const engine = new LoaderParticleEngine(canvas, w, h, state.reducedMotion);
    engineRef.current = engine;
    engine.start();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const cr = entries[0]?.contentRect;
        if (cr && cr.width > 0 && cr.height > 0) {
          engine.resize(cr.width, cr.height);
        }
      });
      ro.observe(container);
    }

    const onOrientation = () => {
      const r = container.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        engine.resize(r.width, r.height);
      }
    };
    window.addEventListener("orientationchange", onOrientation, { passive: true });

    return () => {
      window.removeEventListener("orientationchange", onOrientation);
      ro?.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [showFullStage, state.overlayMounted, state.reducedMotion]);

  // Sync reactive state transitions into particle engine.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.updateState({
      phase: state.phase,
      ignitedCount: state.ignitedCount,
      reducedMotion: state.reducedMotion,
      sweepProgress: state.phase === "exiting" ? 0.15 : 0,
      liftoffProgress: 0,
    });
  }, [state.phase, state.ignitedCount, state.reducedMotion]);

  // Smooth 60fps exit timeline for First Light sweep + star liftoff + radial aperture opening.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (state.phase === "skipped") {
      overlay.style.maskImage = "";
      overlay.style.webkitMaskImage = "";
      return;
    }

    if (state.phase !== "exiting" || state.reducedMotion || isMinimal) {
      if (state.phase !== "exiting") {
        overlay.style.maskImage = "";
        overlay.style.webkitMaskImage = "";
      }
      return;
    }

    const start = state.exitingStartedAtMs ?? performance.now();
    const total = getExitDurationMs({
      reducedMotion: state.reducedMotion,
      variant: isMinimal ? "minimal" : "full",
    });
    let rafId = 0;

    const tick = () => {
      const elapsed = Math.max(0, performance.now() - start);
      const t = Math.min(1, elapsed / total);

      // Sweep light gently across silhouette in the first ~600ms (t: 0..0.48)
      const rawSweep = Math.min(1, t / 0.48);
      const sweep = rawSweep * rawSweep * (3 - 2 * rawSweep);
      // Particles lift outward starting softly around 320ms (t: 0.26..1)
      const rawLift = t > 0.26 ? Math.min(1, (t - 0.26) / 0.74) : 0;
      const liftoff = rawLift * rawLift * (3 - 2 * rawLift);

      engineRef.current?.updateState({
        phase: "exiting",
        ignitedCount: IGNITION_ORDER.length,
        reducedMotion: false,
        sweepProgress: sweep,
        liftoffProgress: liftoff,
      });

      // Feathered radial aperture opens smoothly from center of silhouette across t: 0.28..1
      if (t > 0.28) {
        const ap = Math.min(1, (t - 0.28) / 0.72);
        const eased =
          ap < 0.5 ? 4 * ap * ap * ap : 1 - Math.pow(-2 * ap + 2, 3) / 2;
        const radiusPct = eased * 140;
        const rect = overlay.getBoundingClientRect();
        const layout = computeSilhouetteLayout(
          rect.width || window.innerWidth,
          rect.height || window.innerHeight,
        );
        const mask = `radial-gradient(circle at ${layout.cx.toFixed(0)}px ${layout.cy.toFixed(
          0,
        )}px, transparent ${radiusPct.toFixed(1)}%, rgba(0,0,0,0.88) ${(radiusPct + 14).toFixed(
          1,
        )}%, #000 ${(radiusPct + 28).toFixed(1)}%)`;
        overlay.style.maskImage = mask;
        overlay.style.webkitMaskImage = mask;
      }

      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [state.phase, state.exitingStartedAtMs, state.reducedMotion, isMinimal]);

  // Keyboard shortcut (Esc / Enter) triggers Skip cleanly once available.
  useEffect(() => {
    if (!state.overlayMounted || !state.canSkip) return;
    if (state.phase === "exiting" || state.phase === "done" || state.phase === "skipped") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.overlayMounted, state.canSkip, state.phase, onSkip]);

  // Prevent wheel/touch scrolling of the underlying page while the full overlay locks the viewport.
  useEffect(() => {
    const locked =
      showFullStage &&
      state.overlayMounted &&
      (state.phase === "idle" || state.phase === "loading" || state.phase === "ready");
    if (!locked) return;

    const blockScroll = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    window.addEventListener("wheel", blockScroll, { passive: false, capture: true });
    window.addEventListener("touchmove", blockScroll, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", blockScroll, { capture: true });
      window.removeEventListener("touchmove", blockScroll, { capture: true });
    };
  }, [showFullStage, state.overlayMounted, state.phase]);

  // Compute coarse screen-reader announcement (stage changes + Ready only).
  const announcement = useMemo(() => {
    if (state.phase === "exiting" || state.phase === "done" || state.phase === "skipped") {
      return "Ready";
    }
    return COARSE_ANNOUNCEMENTS[state.stage];
  }, [state.phase, state.stage]);

  if (!state.overlayMounted) {
    return null;
  }

  const activeCaption =
    state.activeRegionIndex !== null
      ? REGION_CAPTIONS[IGNITION_ORDER[state.activeRegionIndex]]
      : null;

  const isSkippingFade = state.phase === "skipped";
  const isReducedOrMinimalExit =
    state.phase === "exiting" && (state.reducedMotion || isMinimal);

  const counterText =
    state.pointsPlaced !== null && state.pointsTotal !== null && state.pointsTotal > 0
      ? `${state.pointsPlaced.toLocaleString("en-US")} / ${state.pointsTotal.toLocaleString("en-US")} points placed`
      : null;

  return (
    <>
      <noscript>
        <style>{".nx-intro-overlay{display:none!important}"}</style>
      </noscript>

      <div
        ref={overlayRef}
        role="status"
        aria-label="NeuroSync First Light loading screen"
        data-phase={state.phase}
        data-variant={state.variant}
        className={`nx-intro-overlay flex flex-col justify-between transition-opacity ${
          isMinimal ? "nx-intro-overlay--minimal" : ""
        } ${
          isSkippingFade
            ? "pointer-events-none opacity-0 duration-250"
            : isReducedOrMinimalExit
              ? "pointer-events-none opacity-0 duration-200"
              : "opacity-100 duration-200"
        }`}
        style={{
          transitionDuration: isSkippingFade
            ? `${INTRO_TIMING.skipFadeMs}ms`
            : isReducedOrMinimalExit
              ? `${INTRO_TIMING.exitReducedMs}ms`
              : undefined,
        }}
      >
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>

        {/* Minimal repeat-visit hairline bar at viewport top */}
        <div
          aria-hidden="true"
          className={`nx-intro-minimal-bar fixed inset-x-0 top-0 z-10 h-[2px] overflow-hidden bg-white/[0.06] ${
            isMinimal ? "block" : "hidden"
          }`}
        >
          <div
            className="h-full origin-left bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] transition-transform duration-150 ease-out"
            style={{ transform: `scaleX(${Math.max(0.08, state.progress)})` }}
          />
        </div>

        {/* Full First Light experience */}
        <div className="nx-intro-full-stage relative flex h-full w-full flex-col">
          {/* Interactive 2D silhouette particle canvas fading in after hydration */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 h-full w-full transition-opacity duration-500 ${
              hydrated && showCanvas ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Top bar: mono micro-label & delayed Skip button */}
          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-none items-center justify-between pt-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#CBD5E1]">
              NEUROSYNC / 01
            </span>

            {state.canSkip && state.phase !== "exiting" && state.phase !== "skipped" ? (
              <button
                type="button"
                onClick={onSkip}
                className="rounded-md border border-white/[0.18] bg-[#0C1222]/85 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[#E6EAF5] transition-colors hover:border-[#22D3EE]/70 hover:text-[#22D3EE]"
              >
                Skip
              </button>
            ) : null}
          </div>

          {/* Center SSR instant first-paint heartbeat pulse dot (fades cleanly once 2D canvas settles) */}
          <div
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 flex items-center justify-center transition-opacity duration-300 ${
              hydrated && showCanvas && state.phase !== "idle" ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="nx-intro-core-dot" />
          </div>

          {/* Caption + hairline progress + disclaimer: bottom centered on tall/normal screens, right beside silhouette on short landscape */}
          <div
            className={`relative z-10 mx-auto flex w-full max-w-7xl flex-1 ${
              shortLandscape ? "items-center justify-end" : "items-end justify-center pb-2"
            }`}
          >
            <div
              className={`flex flex-col gap-3 ${
                shortLandscape
                  ? "w-[46%] items-start pr-2 text-left"
                  : "w-full items-center text-center"
              }`}
            >
              {/* Educational region caption (one line, hedged framing) */}
              <div className="min-h-[2.75rem] max-w-xl">
                {state.phase === "loading" || state.phase === "ready" || state.phase === "exiting" ? (
                  state.reducedMotion ? (
                    <p className="text-xs leading-relaxed text-[#E6EAF5] sm:text-sm">
                      {REDUCED_MOTION_SUMMARY}
                    </p>
                  ) : activeCaption ? (
                    <p
                      key={state.activeRegionIndex}
                      className="nx-intro-caption-enter text-xs leading-relaxed text-[#E6EAF5] sm:text-sm"
                    >
                      {activeCaption}
                    </p>
                  ) : null
                ) : null}
              </div>

              {/* Thin hairline progress + mono stage label + real placement counter */}
              <div
                className={`flex w-full max-w-md flex-col gap-1.5 ${
                  shortLandscape ? "items-start" : "items-center"
                }`}
              >
                <div className="h-px w-full overflow-hidden bg-white/[0.14]">
                  <div
                    className="h-full origin-left bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] transition-transform duration-300 ease-out"
                    style={{ transform: `scaleX(${Math.max(0.03, state.progress)})` }}
                  />
                </div>

                <div className="flex w-full items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#CBD5E1] tabular-nums">
                  <span>{state.stageLabel}</span>
                  {counterText ? <span className="text-[#22D3EE]">{counterText}</span> : null}
                </div>
              </div>

              <p className="nx-intro-disclaimer text-[11px] tracking-[0.02em] text-[#94A3B8]">
                {INTRO_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
