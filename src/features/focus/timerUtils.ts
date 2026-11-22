import { format, startOfWeek } from "date-fns";
import { z } from "zod";

import type { FocusSession, ISODate, ISODateTime, LearningMethod } from "@/types/domain";

export const FOCUS_STORAGE_KEY = "nx:focus-running-session-v1";
export const FOCUS_PRESETS = [25, 50, 90] as const;

export const FOCUS_TABS = ["timer", "review", "methods", "microtasks"] as const;
export type FocusTab = (typeof FOCUS_TABS)[number];

export const FOCUS_HASH_EVENT = "nx:focus-hash-change";

/** Parses a Focus Lab URL hash (#timer, #review, #methods, #microtasks); unknown hashes default to "timer". */
export function parseFocusTabHash(hash: string): FocusTab {
  const cleaned = hash.replace(/^#/, "").trim().toLowerCase();
  return (FOCUS_TABS as readonly string[]).includes(cleaned)
    ? (cleaned as FocusTab)
    : "timer";
}

export const LEARNING_METHOD_OPTIONS: ReadonlyArray<{
  value: LearningMethod;
  label: string;
}> = [
  { value: "active_recall", label: "Active recall" },
  { value: "spaced_repetition", label: "Spaced repetition" },
  { value: "problem_solving", label: "Problem solving" },
  { value: "deep_reading", label: "Deep reading" },
  { value: "skill_practice", label: "Skill practice" },
  { value: "teaching", label: "Teaching" },
];

export interface PauseInterval {
  pausedAt: number;
  resumedAt?: number;
}

export interface RunningFocusSession {
  id: string;
  subject: string;
  method: LearningMethod;
  plannedMin: number;
  startedAtMs: number;
  startedAtISO: ISODateTime;
  date: ISODate;
  pausedIntervals: PauseInterval[];
  distractions: number;
  notifiedComplete?: boolean;
  /** Set when this timer was started from a planner block. */
  blockId?: string;
}

export function isSessionPaused(session: RunningFocusSession): boolean {
  const last = session.pausedIntervals[session.pausedIntervals.length - 1];
  return last !== undefined && last.resumedAt === undefined;
}

export function computePausedMs(intervals: readonly PauseInterval[], nowMs: number): number {
  let total = 0;
  for (const interval of intervals) {
    const end = interval.resumedAt ?? nowMs;
    if (end > interval.pausedAt) {
      total += end - interval.pausedAt;
    }
  }
  return total;
}

export function computeElapsedMs(session: RunningFocusSession, nowMs: number): number {
  const pausedMs = computePausedMs(session.pausedIntervals, nowMs);
  return Math.max(0, nowMs - session.startedAtMs - pausedMs);
}

export function computeRemainingMs(session: RunningFocusSession, nowMs: number): number {
  const plannedMs = Math.max(0, session.plannedMin) * 60_000;
  return Math.max(0, plannedMs - computeElapsedMs(session, nowMs));
}

export function startRunningSession(params: {
  subject: string;
  method: LearningMethod;
  plannedMin: number;
  nowMs?: number;
  blockId?: string;
}): RunningFocusSession {
  const nowMs = params.nowMs ?? Date.now();
  const now = new Date(nowMs);
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(nowMs),
    subject: params.subject.trim(),
    method: params.method,
    plannedMin: params.plannedMin,
    startedAtMs: nowMs,
    startedAtISO: format(now, "yyyy-MM-dd'T'HH:mm:ss"),
    date: format(now, "yyyy-MM-dd"),
    pausedIntervals: [],
    distractions: 0,
    notifiedComplete: false,
    ...(params.blockId ? { blockId: params.blockId } : {}),
  };
}

export function pauseRunningSession(
  session: RunningFocusSession,
  nowMs: number = Date.now(),
): RunningFocusSession {
  if (isSessionPaused(session)) return session;
  return {
    ...session,
    pausedIntervals: [...session.pausedIntervals, { pausedAt: Math.max(session.startedAtMs, nowMs) }],
  };
}

export function resumeRunningSession(
  session: RunningFocusSession,
  nowMs: number = Date.now(),
): RunningFocusSession {
  if (!isSessionPaused(session)) return session;
  const intervals = [...session.pausedIntervals];
  const last = intervals[intervals.length - 1];
  if (!last) return session;
  intervals[intervals.length - 1] = {
    ...last,
    resumedAt: Math.max(last.pausedAt, nowMs),
  };
  return {
    ...session,
    pausedIntervals: intervals,
  };
}

export function incrementDistractions(session: RunningFocusSession): RunningFocusSession {
  return {
    ...session,
    distractions: session.distractions + 1,
  };
}

export function serializeRunningSession(session: RunningFocusSession): string {
  return JSON.stringify(session);
}

export function deserializeRunningSession(raw: string | null): RunningFocusSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RunningFocusSession>;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.subject !== "string" ||
      typeof parsed.method !== "string" ||
      typeof parsed.plannedMin !== "number" ||
      typeof parsed.startedAtMs !== "number" ||
      typeof parsed.startedAtISO !== "string" ||
      typeof parsed.date !== "string" ||
      !Array.isArray(parsed.pausedIntervals) ||
      typeof parsed.distractions !== "number"
    ) {
      return null;
    }
    const session = parsed as RunningFocusSession;
    // A malformed block link must never make the timer unusable.
    if (session.blockId !== undefined && typeof session.blockId !== "string") {
      delete session.blockId;
    }
    return session;
  } catch {
    return null;
  }
}

export function formatTimerClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function summarizeFocusTotals(
  sessions: readonly FocusSession[],
  today: Date = new Date(),
): { todayMinutes: number; weekMinutes: number; todayCount: number; weekCount: number } {
  const todayISO = format(today, "yyyy-MM-dd");
  const weekStartISO = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");

  let todayMinutes = 0;
  let weekMinutes = 0;
  let todayCount = 0;
  let weekCount = 0;

  for (const s of sessions) {
    if (s.date === todayISO) {
      todayMinutes += s.durationMin;
      todayCount += 1;
    }
    if (s.date >= weekStartISO && s.date <= todayISO) {
      weekMinutes += s.durationMin;
      weekCount += 1;
    }
  }

  return { todayMinutes, weekMinutes, todayCount, weekCount };
}

export const focusSetupSchema = z.object({
  subject: z.string().trim().min(1, "Enter what you are focusing on.").max(120, "Keep it concise."),
  method: z.enum([
    "active_recall",
    "spaced_repetition",
    "problem_solving",
    "deep_reading",
    "skill_practice",
    "teaching",
  ]),
  plannedMin: z.number().int("Whole minutes only.").min(1, "At least 1 minute.").max(240, "Max 240 minutes."),
});

export type FocusSetupValues = z.input<typeof focusSetupSchema>;

const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const focusCompleteSchema = z.object({
  durationMin: z.number().int("Whole minutes only.").min(1, "At least 1 minute.").max(600, "Max 600 minutes."),
  focusRating: ratingSchema,
  difficulty: ratingSchema,
  practicedRetrieval: z.boolean(),
  reviewedPrior: z.boolean(),
  addToReviewQueue: z.boolean().optional(),
  notes: z.string().max(1000, "Keep notes under 1000 characters.").optional(),
});

export type FocusCompleteValues = z.input<typeof focusCompleteSchema>;
