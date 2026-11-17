import { z } from "zod";

import type { GratitudeEntry, JournalEntry, MindfulnessType } from "@/types/domain";

export type BreathingPatternId = "box_breathing" | "4_7_8_breathing";

export interface BreathingPhaseDef {
  label: "Inhale" | "Hold" | "Exhale";
  durationSec: number;
  kind: "inhale" | "hold_high" | "exhale" | "hold_low";
}

export interface BreathingPatternSpec {
  id: BreathingPatternId;
  label: string;
  cadenceLabel: string;
  description: string;
  phases: readonly BreathingPhaseDef[];
  cycleSec: number;
}

export const BREATHING_PATTERNS: Record<BreathingPatternId, BreathingPatternSpec> = {
  box_breathing: {
    id: "box_breathing",
    label: "Box breathing",
    cadenceLabel: "4 · 4 · 4 · 4",
    description: "Equal four-second inhale, hold, exhale, and hold.",
    phases: [
      { label: "Inhale", durationSec: 4, kind: "inhale" },
      { label: "Hold", durationSec: 4, kind: "hold_high" },
      { label: "Exhale", durationSec: 4, kind: "exhale" },
      { label: "Hold", durationSec: 4, kind: "hold_low" },
    ],
    cycleSec: 16,
  },
  "4_7_8_breathing": {
    id: "4_7_8_breathing",
    label: "4-7-8 breathing",
    cadenceLabel: "4 · 7 · 8",
    description: "Four-second inhale, seven-second hold, eight-second exhale.",
    phases: [
      { label: "Inhale", durationSec: 4, kind: "inhale" },
      { label: "Hold", durationSec: 7, kind: "hold_high" },
      { label: "Exhale", durationSec: 8, kind: "exhale" },
    ],
    cycleSec: 19,
  },
};

export const BREATHING_PRESETS_MIN = [1, 2, 3, 5] as const;
export const MEDITATION_PRESETS_MIN = [5, 10, 15, 20] as const;

export const MINDFULNESS_TYPE_LABELS: Record<MindfulnessType, string> = {
  box_breathing: "Box breathing",
  "4_7_8_breathing": "4-7-8 breathing",
  meditation: "Meditation",
};

export interface BreathingPhaseState {
  phaseIndex: number;
  label: "Inhale" | "Hold" | "Exhale";
  phaseDurationSec: number;
  phaseElapsedSec: number;
  phaseRemainingSec: number;
  /** 0..1 progress within the current phase. */
  phaseProgress: number;
  /** Suggested visual guide scale (0.65..1.0) during inhale/hold/exhale. */
  scale: number;
  cycleNumber: number;
}

const MIN_GUIDE_SCALE = 0.65;
const MAX_GUIDE_SCALE = 1.0;

/**
 * Computes the active breathing phase, remaining seconds, and calm visual scale
 * from an elapsed millisecond offset.
 */
export function computeBreathingPhase(
  patternId: BreathingPatternId,
  elapsedMs: number,
): BreathingPhaseState {
  const spec = BREATHING_PATTERNS[patternId];
  const safeMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const totalSec = safeMs / 1000;
  const cycleNumber = Math.floor(totalSec / spec.cycleSec) + 1;
  const inCycleSec = totalSec % spec.cycleSec;

  let cursor = 0;
  for (let i = 0; i < spec.phases.length; i += 1) {
    const phase = spec.phases[i]!;
    const phaseEnd = cursor + phase.durationSec;
    if (inCycleSec < phaseEnd || i === spec.phases.length - 1) {
      const phaseElapsedSec = Math.min(phase.durationSec, Math.max(0, inCycleSec - cursor));
      const phaseProgress = phase.durationSec > 0 ? phaseElapsedSec / phase.durationSec : 0;
      const phaseRemainingSec = Math.max(1, Math.ceil(phase.durationSec - phaseElapsedSec));

      let scale = MIN_GUIDE_SCALE;
      if (phase.kind === "inhale") {
        scale = MIN_GUIDE_SCALE + (MAX_GUIDE_SCALE - MIN_GUIDE_SCALE) * phaseProgress;
      } else if (phase.kind === "hold_high") {
        scale = MAX_GUIDE_SCALE;
      } else if (phase.kind === "exhale") {
        scale = MAX_GUIDE_SCALE - (MAX_GUIDE_SCALE - MIN_GUIDE_SCALE) * phaseProgress;
      } else {
        scale = MIN_GUIDE_SCALE;
      }

      return {
        phaseIndex: i,
        label: phase.label,
        phaseDurationSec: phase.durationSec,
        phaseElapsedSec,
        phaseRemainingSec,
        phaseProgress,
        scale,
        cycleNumber,
      };
    }
    cursor = phaseEnd;
  }

  return {
    phaseIndex: 0,
    label: "Inhale",
    phaseDurationSec: 4,
    phaseElapsedSec: 0,
    phaseRemainingSec: 4,
    phaseProgress: 0,
    scale: MIN_GUIDE_SCALE,
    cycleNumber: 1,
  };
}

/** Formats milliseconds into MM:SS for breathing and meditation readouts. */
export function formatMindClock(ms: number): string {
  const safeSec = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const minutes = Math.floor(safeSec / 60);
  const seconds = safeSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Filters journal entries by text or date substring and sorts newest-first. */
export function filterJournalEntries(
  entries: readonly JournalEntry[],
  query: string,
): JournalEntry[] {
  const normalized = query.trim().toLowerCase();
  const sorted = [...entries].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });

  if (!normalized) return sorted;

  return sorted.filter(
    (entry) =>
      entry.text.toLowerCase().includes(normalized) ||
      entry.date.toLowerCase().includes(normalized),
  );
}

/** Trims gratitude lines, removes blanks, and caps at 3 lines. */
export function normalizeGratitudeItems(lines: readonly string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

/** Sorts gratitude entries newest-first by date. */
export function sortGratitudeEntries(entries: readonly GratitudeEntry[]): GratitudeEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export const journalFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  text: z
    .string()
    .trim()
    .min(1, "Write a short note before saving.")
    .max(2000, "Keep entries under 2,000 characters."),
});

export type JournalFormValues = z.input<typeof journalFormSchema>;

export const gratitudeFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  line1: z.string().trim().min(1, "Add at least one line.").max(200, "Keep each line under 200 characters."),
  line2: z.string().trim().max(200, "Keep each line under 200 characters."),
  line3: z.string().trim().max(200, "Keep each line under 200 characters."),
});

export type GratitudeFormValues = z.input<typeof gratitudeFormSchema>;
