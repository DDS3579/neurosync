"use client";

import { useCallback, useEffect, useReducer } from "react";

import type { BrainReadinessProgress } from "@/features/brain/BrainHero";
import { detectWebGL, usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import {
  createIntroState,
  readSessionIntroSeen,
  transitionIntro,
  writeSessionIntroSeen,
  type IntroEvent,
  type IntroMachineState,
} from "./introMachine";

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function introReducer(state: IntroMachineState, event: IntroEvent): IntroMachineState {
  return transitionIntro(state, event);
}

export interface UseBrainReadinessResult {
  state: IntroMachineState;
  handleBrainProgress: (info: BrainReadinessProgress) => void;
  handleBrainReady: () => void;
  skipIntro: () => void;
}

/**
 * Coordinates real BrainHero loading stages, document.fonts.ready, WebGL support,
 * session repeat-visit state, and all First Light timing transitions.
 */
export function useBrainReadiness(): UseBrainReadinessResult {
  const reducedMotion = usePrefersReducedMotion();

  const [state, dispatch] = useReducer(
    introReducer,
    reducedMotion,
    (rm) =>
      createIntroState({
        mountedAtMs: nowMs(),
        seenInSession: false,
        reducedMotion: rm,
        webglSupported: true,
        fontsReady: false,
      }),
  );

  // Sync repeat-visit session state post-hydration so SSR HTML matches first client render cleanly.
  useEffect(() => {
    if (readSessionIntroSeen()) {
      dispatch({ type: "SET_SESSION_SEEN", seen: true, nowMs: nowMs() });
    }
  }, []);

  // Sync reduced motion changes after hydration.
  useEffect(() => {
    dispatch({ type: "REDUCED_MOTION_CHANGE", reducedMotion });
  }, [reducedMotion]);

  // Check WebGL capability and wait on document.fonts.ready.
  useEffect(() => {
    let cancelled = false;
    if (!detectWebGL()) {
      dispatch({ type: "WEBGL_UNSUPPORTED", nowMs: nowMs() });
      return;
    }

    const fontSet = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fontSet?.ready) {
      dispatch({ type: "FONTS_READY", nowMs: nowMs() });
    } else {
      void fontSet.ready.then(() => {
        if (!cancelled) {
          dispatch({ type: "FONTS_READY", nowMs: nowMs() });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist session flag as soon as the state machine completes or skips.
  useEffect(() => {
    if (state.shouldPersistSeen) {
      writeSessionIntroSeen();
    }
  }, [state.shouldPersistSeen]);

  // Coarse 50ms clock tick to drive threshold transitions (400ms, 1200ms, 2500ms, 540ms/900ms, 12000ms)
  // independently of BrainHero events cleanly.
  useEffect(() => {
    if (!state.overlayMounted && state.headlineReleased) return;
    const id = window.setInterval(() => {
      dispatch({ type: "TICK", nowMs: nowMs() });
    }, 50);
    return () => window.clearInterval(id);
  }, [state.overlayMounted, state.headlineReleased]);

  const handleBrainProgress = useCallback((info: BrainReadinessProgress) => {
    dispatch({
      type: "PROGRESS",
      stage: info.stage,
      value: info.value,
      pointsPlaced: info.pointsPlaced,
      pointsTotal: info.pointsTotal,
      nowMs: nowMs(),
    });
  }, []);

  const handleBrainReady = useCallback(() => {
    dispatch({ type: "BRAIN_READY", nowMs: nowMs() });
  }, []);

  const skipIntro = useCallback(() => {
    dispatch({ type: "SKIP", nowMs: nowMs() });
  }, []);

  return {
    state,
    handleBrainProgress,
    handleBrainReady,
    skipIntro,
  };
}
