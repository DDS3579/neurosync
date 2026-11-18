/**
 * Pure deterministic state machine and timing rules for the "First Light" landing intro loader.
 * No DOM or React dependencies so every transition and timing edge case is unit-testable.
 */
import { IGNITION_ORDER } from "./silhouetteData";

export type IntroPhase = "idle" | "loading" | "ready" | "exiting" | "done" | "skipped";
export type IntroStage = "chunk" | "geometry" | "shaders" | "firstFrame";

export const INTRO_SESSION_KEY = "ns:intro:v1";

export const INTRO_TIMING = {
  fastSkipMs: 400,
  minVisibleMs: 1200,
  skipButtonDelayMs: 2500,
  hardTimeoutMs: 12000,
  skipFadeMs: 250,
  exitDurationMs: 900,
  exitReducedMs: 200,
  headlineRevealRatio: 0.6,
} as const;

export const STAGE_WEIGHTS: Record<IntroStage, { base: number; weight: number; label: string }> = {
  chunk: { base: 0, weight: 0.25, label: "LOADING THE OBSERVATORY" },
  geometry: { base: 0.25, weight: 0.35, label: "PLACING PARTICLES" },
  shaders: { base: 0.6, weight: 0.25, label: "COMPILING SHADERS" },
  firstFrame: { base: 0.85, weight: 0.15, label: "FIRST LIGHT" },
};

export interface IntroMachineState {
  phase: IntroPhase;
  variant: "full" | "minimal";
  mountedAtMs: number;
  loadingShownAtMs: number | null;
  exitingStartedAtMs: number | null;
  progress: number;
  stage: IntroStage;
  stageLabel: string;
  pointsPlaced: number | null;
  pointsTotal: number | null;
  ignitedCount: number;
  activeRegionIndex: number | null;
  brainReady: boolean;
  fontsReady: boolean;
  webglSupported: boolean;
  reducedMotion: boolean;
  canSkip: boolean;
  timedOut: boolean;
  shouldPersistSeen: boolean;
  headlineReleased: boolean;
  overlayMounted: boolean;
}

export type IntroEvent =
  | {
      type: "PROGRESS";
      stage: IntroStage;
      value: number;
      pointsPlaced?: number;
      pointsTotal?: number;
      nowMs?: number;
    }
  | { type: "BRAIN_READY"; nowMs: number }
  | { type: "FONTS_READY"; nowMs: number }
  | { type: "WEBGL_UNSUPPORTED"; nowMs: number }
  | { type: "TICK"; nowMs: number }
  | { type: "SKIP"; nowMs: number }
  | { type: "SET_SESSION_SEEN"; seen: boolean; nowMs: number }
  | { type: "REDUCED_MOTION_CHANGE"; reducedMotion: boolean };

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function getExitDurationMs(state: Pick<IntroMachineState, "reducedMotion" | "variant">): number {
  return state.reducedMotion || state.variant === "minimal"
    ? INTRO_TIMING.exitReducedMs
    : INTRO_TIMING.exitDurationMs;
}

export function computeMonotonicStageProgress(
  prevProgress: number,
  prevStage: IntroStage,
  stage: IntroStage,
  value: number,
): { progress: number; stage: IntroStage; stageLabel: string } {
  const spec = STAGE_WEIGHTS[stage];
  const candidate = clamp01(spec.base + spec.weight * clamp01(value));
  const progress = Math.max(prevProgress, candidate);
  const nextStage = STAGE_WEIGHTS[stage].base >= STAGE_WEIGHTS[prevStage].base ? stage : prevStage;
  const stageLabel =
    progress >= 0.999 ? STAGE_WEIGHTS.firstFrame.label : STAGE_WEIGHTS[nextStage].label;
  return { progress, stage: nextStage, stageLabel };
}

function computeIgnitionForProgress(
  phase: IntroPhase,
  progress: number,
  loadingElapsedMs: number,
  reducedMotion: boolean,
): { ignitedCount: number; activeRegionIndex: number | null } {
  const totalRegions = IGNITION_ORDER.length;
  if (phase === "ready" || phase === "exiting" || phase === "done") {
    return { ignitedCount: totalRegions, activeRegionIndex: totalRegions - 1 };
  }
  if (phase !== "loading") {
    return { ignitedCount: 0, activeRegionIndex: null };
  }
  if (reducedMotion) {
    return { ignitedCount: totalRegions, activeRegionIndex: totalRegions - 1 };
  }

  // Spread ignition progressively by both real progress and gentle paced floor inside the 1.2s hold.
  const progressRegions = Math.floor(clamp01(progress / 0.92) * totalRegions);
  const pacedRegions = Math.floor(
    clamp01(loadingElapsedMs / INTRO_TIMING.minVisibleMs) * totalRegions,
  );
  const ignited = Math.max(1, Math.min(totalRegions, Math.max(progressRegions, Math.min(pacedRegions, totalRegions - 1))));
  return {
    ignitedCount: ignited,
    activeRegionIndex: Math.min(totalRegions - 1, ignited - 1),
  };
}

export interface CreateIntroStateOptions {
  mountedAtMs?: number;
  seenInSession?: boolean;
  reducedMotion?: boolean;
  webglSupported?: boolean;
  fontsReady?: boolean;
}

export function createIntroState(options: CreateIntroStateOptions = {}): IntroMachineState {
  const {
    mountedAtMs = 0,
    seenInSession = false,
    reducedMotion = false,
    webglSupported = true,
    fontsReady = false,
  } = options;

  if (!webglSupported) {
    return {
      phase: "skipped",
      variant: seenInSession ? "minimal" : "full",
      mountedAtMs,
      loadingShownAtMs: null,
      exitingStartedAtMs: mountedAtMs,
      progress: 1,
      stage: "firstFrame",
      stageLabel: STAGE_WEIGHTS.firstFrame.label,
      pointsPlaced: null,
      pointsTotal: null,
      ignitedCount: 0,
      activeRegionIndex: null,
      brainReady: false,
      fontsReady,
      webglSupported: false,
      reducedMotion,
      canSkip: false,
      timedOut: false,
      shouldPersistSeen: false,
      headlineReleased: true,
      overlayMounted: false,
    };
  }

  return {
    phase: "idle",
    variant: seenInSession ? "minimal" : "full",
    mountedAtMs,
    loadingShownAtMs: null,
    exitingStartedAtMs: null,
    progress: 0,
    stage: "chunk",
    stageLabel: STAGE_WEIGHTS.chunk.label,
    pointsPlaced: null,
    pointsTotal: null,
    ignitedCount: 0,
    activeRegionIndex: null,
    brainReady: false,
    fontsReady,
    webglSupported: true,
    reducedMotion,
    canSkip: false,
    timedOut: false,
    shouldPersistSeen: false,
    headlineReleased: false,
    overlayMounted: true,
  };
}

function finalizeReadyState(state: IntroMachineState, nowMs: number): IntroMachineState {
  const isAllReady = state.brainReady && state.fontsReady;
  if (!isAllReady) return state;

  const elapsed = Math.max(0, nowMs - state.mountedAtMs);

  // Fast skip rule: ready before the 400ms threshold -> never flash full loader.
  if (state.phase === "idle" && elapsed < INTRO_TIMING.fastSkipMs) {
    return {
      ...state,
      phase: "done",
      progress: 1,
      stage: "firstFrame",
      stageLabel: STAGE_WEIGHTS.firstFrame.label,
      ignitedCount: IGNITION_ORDER.length,
      activeRegionIndex: IGNITION_ORDER.length - 1,
      headlineReleased: true,
      overlayMounted: false,
    };
  }

  if (state.phase === "idle" && state.variant === "minimal") {
    return {
      ...state,
      phase: "exiting",
      exitingStartedAtMs: nowMs,
      progress: 1,
      stage: "firstFrame",
      stageLabel: STAGE_WEIGHTS.firstFrame.label,
      headlineReleased: true,
    };
  }

  if (state.phase === "idle" || state.phase === "loading") {
    const shownAt = state.loadingShownAtMs ?? state.mountedAtMs;
    const minVisibleElapsed = nowMs - shownAt;
    if (minVisibleElapsed >= INTRO_TIMING.minVisibleMs) {
      return {
        ...state,
        phase: "exiting",
        exitingStartedAtMs: nowMs,
        progress: 1,
        stage: "firstFrame",
        stageLabel: STAGE_WEIGHTS.firstFrame.label,
        ignitedCount: IGNITION_ORDER.length,
        activeRegionIndex: IGNITION_ORDER.length - 1,
        shouldPersistSeen: true,
        headlineReleased: state.reducedMotion,
      };
    }
    return {
      ...state,
      phase: "ready",
      progress: 1,
      stage: "firstFrame",
      stageLabel: STAGE_WEIGHTS.firstFrame.label,
      ignitedCount: IGNITION_ORDER.length,
      activeRegionIndex: IGNITION_ORDER.length - 1,
    };
  }

  return state;
}

export function transitionIntro(state: IntroMachineState, event: IntroEvent): IntroMachineState {
  if (event.type === "SET_SESSION_SEEN") {
    if (!event.seen || state.variant === "minimal") return state;
    const next: IntroMachineState = { ...state, variant: "minimal" };
    if (next.phase === "loading") {
      return { ...next, phase: "idle" };
    }
    return next.brainReady && next.fontsReady ? finalizeReadyState(next, event.nowMs) : next;
  }

  if (event.type === "REDUCED_MOTION_CHANGE") {
    if (state.reducedMotion === event.reducedMotion) return state;
    const next = { ...state, reducedMotion: event.reducedMotion };
    if (next.phase === "loading") {
      const loadingElapsed = next.loadingShownAtMs !== null ? Math.max(0, 0) : 0;
      const ign = computeIgnitionForProgress(next.phase, next.progress, loadingElapsed, next.reducedMotion);
      return { ...next, ...ign };
    }
    return next;
  }

  if (event.type === "WEBGL_UNSUPPORTED") {
    if (state.phase === "done") return state;
    return {
      ...state,
      phase: "skipped",
      webglSupported: false,
      exitingStartedAtMs: event.nowMs,
      headlineReleased: true,
      overlayMounted: false,
    };
  }

  if (state.phase === "done") {
    return state;
  }

  if (state.phase === "skipped") {
    if (event.type !== "TICK") return state;
    if (!state.overlayMounted) return state;
    const fadeStart = state.exitingStartedAtMs ?? event.nowMs;
    if (event.nowMs - fadeStart >= INTRO_TIMING.skipFadeMs) {
      return { ...state, overlayMounted: false };
    }
    return state;
  }

  if (event.type === "SKIP") {
    return {
      ...state,
      phase: "skipped",
      exitingStartedAtMs: event.nowMs,
      canSkip: true,
      shouldPersistSeen: true,
      headlineReleased: true,
    };
  }

  if (event.type === "PROGRESS") {
    const mono = computeMonotonicStageProgress(
      state.progress,
      state.stage,
      event.stage,
      event.value,
    );
    const pointsPlaced =
      typeof event.pointsPlaced === "number" ? event.pointsPlaced : state.pointsPlaced;
    const pointsTotal =
      typeof event.pointsTotal === "number" ? event.pointsTotal : state.pointsTotal;
    const loadingElapsed =
      state.loadingShownAtMs !== null && typeof event.nowMs === "number"
        ? Math.max(0, event.nowMs - state.loadingShownAtMs)
        : 0;
    const ign = computeIgnitionForProgress(
      state.phase,
      mono.progress,
      loadingElapsed,
      state.reducedMotion,
    );
    return {
      ...state,
      progress: mono.progress,
      stage: mono.stage,
      stageLabel: mono.stageLabel,
      pointsPlaced,
      pointsTotal,
      ...ign,
    };
  }

  if (event.type === "BRAIN_READY") {
    return finalizeReadyState({ ...state, brainReady: true }, event.nowMs);
  }

  if (event.type === "FONTS_READY") {
    return finalizeReadyState({ ...state, fontsReady: true }, event.nowMs);
  }

  // event.type === "TICK"
  const nowMs = event.nowMs;
  const elapsed = Math.max(0, nowMs - state.mountedAtMs);
  const canSkip =
    state.canSkip || (elapsed >= INTRO_TIMING.skipButtonDelayMs && (state.phase === "idle" || state.phase === "loading" || state.phase === "ready"));

  // Exiting timeline progression
  if (state.phase === "exiting") {
    const exitStart = state.exitingStartedAtMs ?? nowMs;
    const exitDur = getExitDurationMs(state);
    const exitElapsed = Math.max(0, nowMs - exitStart);
    const ratio = exitDur > 0 ? exitElapsed / exitDur : 1;
    const headlineReleased =
      state.headlineReleased || ratio >= INTRO_TIMING.headlineRevealRatio;

    if (exitElapsed >= exitDur) {
      return {
        ...state,
        phase: "done",
        progress: 1,
        shouldPersistSeen: true,
        headlineReleased: true,
        overlayMounted: false,
      };
    }

    return headlineReleased !== state.headlineReleased
      ? { ...state, headlineReleased }
      : state;
  }

  // Hard timeout after 12 seconds -> hand off gracefully even if still loading.
  if (elapsed >= INTRO_TIMING.hardTimeoutMs) {
    return {
      ...state,
      phase: "exiting",
      exitingStartedAtMs: nowMs,
      timedOut: true,
      canSkip,
      shouldPersistSeen: true,
      headlineReleased: state.variant === "minimal" || state.reducedMotion,
    };
  }

  // Transition idle -> loading after the 400ms fast-skip window (only for full variant).
  if (state.phase === "idle") {
    if (state.brainReady && state.fontsReady) {
      return finalizeReadyState({ ...state, canSkip }, nowMs);
    }
    if (state.variant === "full" && elapsed >= INTRO_TIMING.fastSkipMs) {
      const loadingShownAtMs = nowMs;
      const ign = computeIgnitionForProgress("loading", state.progress, 0, state.reducedMotion);
      return {
        ...state,
        phase: "loading",
        loadingShownAtMs,
        canSkip,
        ...ign,
      };
    }
    return canSkip !== state.canSkip ? { ...state, canSkip } : state;
  }

  if (state.phase === "loading") {
    const shownAt = state.loadingShownAtMs ?? nowMs;
    const loadingElapsed = Math.max(0, nowMs - shownAt);
    const ign = computeIgnitionForProgress(
      "loading",
      state.progress,
      loadingElapsed,
      state.reducedMotion,
    );
    const updated: IntroMachineState = { ...state, canSkip, ...ign };
    if (updated.brainReady && updated.fontsReady) {
      return finalizeReadyState(updated, nowMs);
    }
    return updated;
  }

  if (state.phase === "ready") {
    const shownAt = state.loadingShownAtMs ?? state.mountedAtMs;
    if (nowMs - shownAt >= INTRO_TIMING.minVisibleMs) {
      return {
        ...state,
        phase: "exiting",
        exitingStartedAtMs: nowMs,
        canSkip,
        shouldPersistSeen: true,
        headlineReleased: state.reducedMotion,
      };
    }
    return canSkip !== state.canSkip ? { ...state, canSkip } : state;
  }

  return state;
}

export function readSessionIntroSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.document?.documentElement?.dataset?.intro === "seen" ||
      window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function writeSessionIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    window.document?.documentElement?.setAttribute("data-intro", "seen");
  } catch {
    // ignore storage quota / privacy mode failures
  }
}
