import { mean, median, round1 } from "@/lib/insights/stats";
import type {
  GoNoGoMetrics,
  MemorySpanMetrics,
  MicrotaskInputType,
  MicrotaskKind,
  MicrotaskResult,
  MicrotaskTimeOfDay,
  ReactionTimeMetrics,
} from "@/types/domain";

export const REACTION_TRIAL_COUNT = 5;
export const REACTION_PRACTICE_COUNT = 2;
export const REACTION_FALSE_START_MS = 100;
export const REACTION_MIN_DELAY_MS = 1000;
export const REACTION_MAX_DELAY_MS = 4000;

export const MEMORY_SPAN_GRID_SIZE = 9;
export const MEMORY_SPAN_START_LENGTH = 3;
export const MEMORY_SPAN_PRACTICE_LENGTH = 2;
export const MEMORY_SPAN_MAX_FAILURES_PER_LENGTH = 2;
export const MEMORY_SPAN_MAX_LENGTH = 12;

export const GO_NO_GO_TRIAL_COUNT = 40;
export const GO_NO_GO_PRACTICE_COUNT = 6;
export const GO_NO_GO_RATIO = 0.75;
export const GO_NO_GO_STIMULUS_MS = 500;
export const GO_NO_GO_GAP_MIN_MS = 1000;
export const GO_NO_GO_GAP_MAX_MS = 1500;

export const MICROTASK_PRACTICE_STORAGE_KEY = "ns:ui:v1:microtask-practice-done";

export const MICROTASKS_FRAMING_POINTS: readonly string[] = [
  "Not diagnostic tests or IQ tests.",
  "Practice effects raise scores across repeated runs.",
  "Results vary with sleep, time of day, device, and input method.",
  "Compare only against your own history.",
];

export const FLASHING_STIMULI_NOTE =
  "Memory span and Attention use brief visual flashes to show stimuli. Reduced motion removes decorative animation while keeping task cues clear.";

export const PRACTICE_EFFECT_CAVEAT =
  "Practice effects commonly shift results across repeated runs even when nothing else changes. Compare only against your own history alongside rest, time-of-day, and device context.";

export const MICROTASKS_LABELS: Record<MicrotaskKind, string> = {
  reaction_time: "Reaction time",
  memory_span: "Memory span",
  go_no_go: "Attention (go/no-go)",
};

export const TIME_OF_DAY_LABELS: Record<MicrotaskTimeOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export const INPUT_TYPE_LABELS: Record<MicrotaskInputType, string> = {
  mouse: "Mouse",
  touch: "Touch",
  keyboard: "Keyboard",
};

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomIntInclusive(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

export function detectTimeOfDayBucket(date: Date = new Date()): MicrotaskTimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 21) return "evening";
  return "night";
}

export function readPracticeCompleted(task: MicrotaskKind): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(MICROTASK_PRACTICE_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as Record<string, unknown>)[task] === true
    );
  } catch {
    return false;
  }
}

export function markPracticeCompleted(task: MicrotaskKind): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MICROTASK_PRACTICE_STORAGE_KEY);
    const prev =
      raw && typeof JSON.parse(raw) === "object" && JSON.parse(raw) !== null
        ? (JSON.parse(raw) as Record<string, boolean>)
        : {};
    prev[task] = true;
    window.localStorage.setItem(MICROTASK_PRACTICE_STORAGE_KEY, JSON.stringify(prev));
  } catch {
    // Ignore storage unavailability/quota errors cleanly
  }
}

// ---------------------------------------------------------------------------
// 1. Reaction Time
// ---------------------------------------------------------------------------

export function sampleReactionDelayMs(rng: () => number = Math.random): number {
  return randomIntInclusive(REACTION_MIN_DELAY_MS, REACTION_MAX_DELAY_MS, rng);
}

export function classifyReactionAttempt(reactionMs: number): "false_start" | "valid" {
  if (!Number.isFinite(reactionMs) || reactionMs < REACTION_FALSE_START_MS) {
    return "false_start";
  }
  return "valid";
}

export function summarizeReactionTrials(
  trialsMs: readonly number[],
  falseStarts: number,
): ReactionTimeMetrics {
  const valid = trialsMs
    .filter((ms) => classifyReactionAttempt(ms) === "valid")
    .map((ms) => Math.round(ms));

  if (valid.length === 0) {
    return {
      trialsMs: [],
      medianMs: 0,
      bestMs: 0,
      falseStarts: Math.max(0, Math.round(falseStarts)),
    };
  }

  const med = median(valid) ?? valid[0]!;
  return {
    trialsMs: valid,
    medianMs: Math.round(med),
    bestMs: Math.min(...valid),
    falseStarts: Math.max(0, Math.round(falseStarts)),
  };
}

// ---------------------------------------------------------------------------
// 2. Memory Span (3x3 Grid)
// ---------------------------------------------------------------------------

export function generateSpanSequence(
  length: number,
  rng: () => number = Math.random,
  gridSize: number = MEMORY_SPAN_GRID_SIZE,
): number[] {
  const safeLen = Math.max(1, Math.round(length));
  const seq: number[] = [];
  for (let i = 0; i < safeLen; i += 1) {
    let pick = randomIntInclusive(0, gridSize - 1, rng);
    if (gridSize > 1 && i > 0 && pick === seq[i - 1]) {
      pick = (pick + 1 + Math.floor(rng() * (gridSize - 1))) % gridSize;
    }
    seq.push(pick);
  }
  return seq;
}

export function evaluateSpanAttempt(
  expected: readonly number[],
  entered: readonly number[],
): boolean {
  if (expected.length === 0 || expected.length !== entered.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== entered[i]) return false;
  }
  return true;
}

export interface SpanSessionState {
  startingLength: number;
  currentLength: number;
  failuresAtLength: number;
  longestSpan: number;
  totalRounds: number;
  failures: number;
  done: boolean;
}

export function createInitialSpanState(
  startingLength: number = MEMORY_SPAN_START_LENGTH,
): SpanSessionState {
  return {
    startingLength,
    currentLength: startingLength,
    failuresAtLength: 0,
    longestSpan: 0,
    totalRounds: 0,
    failures: 0,
    done: false,
  };
}

export function advanceSpanState(
  state: SpanSessionState,
  passed: boolean,
): SpanSessionState {
  if (state.done) return state;

  const totalRounds = state.totalRounds + 1;
  if (passed) {
    const longestSpan = Math.max(state.longestSpan, state.currentLength);
    const nextLength = state.currentLength + 1;
    const capped = nextLength > MEMORY_SPAN_MAX_LENGTH;
    return {
      startingLength: state.startingLength,
      currentLength: capped ? MEMORY_SPAN_MAX_LENGTH : nextLength,
      failuresAtLength: 0,
      longestSpan,
      totalRounds,
      failures: state.failures,
      done: capped,
    };
  }

  const failuresAtLength = state.failuresAtLength + 1;
  const failures = state.failures + 1;
  return {
    startingLength: state.startingLength,
    currentLength: state.currentLength,
    failuresAtLength,
    longestSpan: state.longestSpan,
    totalRounds,
    failures,
    done: failuresAtLength >= MEMORY_SPAN_MAX_FAILURES_PER_LENGTH,
  };
}

export function toMemorySpanMetrics(state: SpanSessionState): MemorySpanMetrics {
  return {
    longestSpan: state.longestSpan,
    startingLength: state.startingLength,
    totalRounds: state.totalRounds,
    failures: state.failures,
  };
}

// ---------------------------------------------------------------------------
// 3. Attention (Go / No-Go)
// ---------------------------------------------------------------------------

export interface GoNoGoPlannedTrial {
  index: number;
  cue: "go" | "nogo";
  gapMs: number;
}

export interface GoNoGoTrialOutcome {
  cue: "go" | "nogo";
  responded: boolean;
  reactionMs?: number | null;
}

export function generateGoNoGoTrials(
  totalTrials: number = GO_NO_GO_TRIAL_COUNT,
  goRatio: number = GO_NO_GO_RATIO,
  rng: () => number = Math.random,
): GoNoGoPlannedTrial[] {
  const safeTotal = Math.max(1, Math.round(totalTrials));
  const goCount = Math.min(safeTotal, Math.max(1, Math.round(safeTotal * goRatio)));
  const cues: Array<"go" | "nogo"> = [];
  for (let i = 0; i < safeTotal; i += 1) {
    cues.push(i < goCount ? "go" : "nogo");
  }
  for (let i = cues.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cues[i]!;
    cues[i] = cues[j]!;
    cues[j] = tmp;
  }

  return cues.map((cue, index) => ({
    index,
    cue,
    gapMs: randomIntInclusive(GO_NO_GO_GAP_MIN_MS, GO_NO_GO_GAP_MAX_MS, rng),
  }));
}

export function scoreGoNoGoTrials(
  outcomes: readonly GoNoGoTrialOutcome[],
): GoNoGoMetrics {
  let goTrials = 0;
  let noGoTrials = 0;
  let hits = 0;
  let misses = 0;
  let commissionErrors = 0;
  const hitRts: number[] = [];

  for (const trial of outcomes) {
    if (trial.cue === "go") {
      goTrials += 1;
      if (trial.responded) {
        hits += 1;
        if (
          typeof trial.reactionMs === "number" &&
          Number.isFinite(trial.reactionMs) &&
          trial.reactionMs >= 0
        ) {
          hitRts.push(Math.round(trial.reactionMs));
        }
      } else {
        misses += 1;
      }
    } else {
      noGoTrials += 1;
      if (trial.responded) {
        commissionErrors += 1;
      }
    }
  }

  const rtMean = mean(hitRts);
  return {
    totalTrials: outcomes.length,
    goTrials,
    noGoTrials,
    hits,
    misses,
    commissionErrors,
    meanReactionMs: rtMean === null ? null : Math.round(rtMean),
  };
}

// ---------------------------------------------------------------------------
// Trends extraction (descriptive, zero good/bad labels)
// ---------------------------------------------------------------------------

export interface MicrotaskTrendPoint {
  id: string;
  date: string;
  createdAt: string;
  value: number;
  secondaryLabel: string;
  timeOfDay: MicrotaskTimeOfDay;
  inputType: MicrotaskInputType;
  restedRating?: number;
}

export interface MicrotaskTrendSummary {
  task: MicrotaskKind;
  sampleSize: number;
  medianValue: number | null;
  unit: string;
  metricLabel: string;
  points: MicrotaskTrendPoint[];
}

export function buildMicrotaskTrend(
  results: readonly MicrotaskResult[],
  task: MicrotaskKind,
): MicrotaskTrendSummary {
  const filtered = results
    .filter((r) => r.task === task)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const points: MicrotaskTrendPoint[] = filtered.map((row) => {
    if (row.task === "reaction_time") {
      return {
        id: row.id,
        date: row.date,
        createdAt: row.createdAt,
        value: row.metrics.medianMs,
        secondaryLabel: `best ${row.metrics.bestMs} ms · ${row.metrics.trialsMs.length} trials`,
        timeOfDay: row.timeOfDay,
        inputType: row.inputType,
        restedRating: row.restedRating,
      };
    }
    if (row.task === "memory_span") {
      return {
        id: row.id,
        date: row.date,
        createdAt: row.createdAt,
        value: row.metrics.longestSpan,
        secondaryLabel: `${row.metrics.totalRounds} rounds · ${row.metrics.failures} misses`,
        timeOfDay: row.timeOfDay,
        inputType: row.inputType,
        restedRating: row.restedRating,
      };
    }
    const meanRt = row.metrics.meanReactionMs;
    const goPct =
      row.metrics.goTrials > 0
        ? Math.round((row.metrics.hits / row.metrics.goTrials) * 100)
        : 0;
    return {
      id: row.id,
      date: row.date,
      createdAt: row.createdAt,
      value: meanRt ?? 0,
      secondaryLabel: `${row.metrics.hits}/${row.metrics.goTrials} go hits (${goPct}%) · ${row.metrics.commissionErrors} no-go taps`,
      timeOfDay: row.timeOfDay,
      inputType: row.inputType,
      restedRating: row.restedRating,
    };
  });

  const numericForMedian =
    task === "go_no_go"
      ? points.filter((p) => p.value > 0).map((p) => p.value)
      : points.map((p) => p.value);

  const med = median(numericForMedian);
  return {
    task,
    sampleSize: points.length,
    medianValue:
      med === null ? null : task === "memory_span" ? round1(med) : Math.round(med),
    unit: task === "memory_span" ? "items" : "ms",
    metricLabel:
      task === "reaction_time"
        ? "Median reaction time"
        : task === "memory_span"
          ? "Longest span"
          : "Mean go-cue reaction time",
    points,
  };
}
