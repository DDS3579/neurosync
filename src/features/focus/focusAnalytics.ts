import type { FocusSession, LearningMethod } from "@/types/domain";
import { LEARNING_METHOD_OPTIONS } from "./timerUtils";

export const METHOD_LIBRARY_LINKS: Record<
  LearningMethod,
  { entryId: string; title: string }
> = {
  active_recall: {
    entryId: "active-recall",
    title: "Active recall: the testing effect",
  },
  spaced_repetition: {
    entryId: "spaced-repetition",
    title: "Spaced repetition: let time do some work",
  },
  problem_solving: {
    entryId: "interleaving",
    title: "Interleaving: mix it up",
  },
  deep_reading: {
    entryId: "active-recall",
    title: "Active recall vs re-reading",
  },
  skill_practice: {
    entryId: "deliberate-practice",
    title: "Deliberate practice: practice with a target",
  },
  teaching: {
    entryId: "active-recall",
    title: "Explaining from memory",
  },
};

export interface MethodStat {
  method: LearningMethod;
  label: string;
  libraryHref: string;
  libraryTitle: string;
  sessionCount: number;
  totalMinutes: number;
  avgFocus: number | null;
  avgDifficulty: number | null;
}

/**
 * Summarizes per-method session counts, total minutes, average self-rated focus,
 * and average difficulty. Returned in fixed option order (never ranked as "best").
 */
export function summarizeMethodStats(sessions: readonly FocusSession[]): MethodStat[] {
  const buckets = new Map<
    LearningMethod,
    { count: number; minutes: number; focusSum: number; difficultySum: number }
  >();

  for (const s of sessions) {
    const prev = buckets.get(s.method) ?? {
      count: 0,
      minutes: 0,
      focusSum: 0,
      difficultySum: 0,
    };
    buckets.set(s.method, {
      count: prev.count + 1,
      minutes: prev.minutes + s.durationMin,
      focusSum: prev.focusSum + s.focusRating,
      difficultySum: prev.difficultySum + s.difficulty,
    });
  }

  return LEARNING_METHOD_OPTIONS.map((opt) => {
    const bucket = buckets.get(opt.value);
    const link = METHOD_LIBRARY_LINKS[opt.value];
    if (!bucket || bucket.count === 0) {
      return {
        method: opt.value,
        label: opt.label,
        libraryHref: `/library#${link.entryId}`,
        libraryTitle: link.title,
        sessionCount: 0,
        totalMinutes: 0,
        avgFocus: null,
        avgDifficulty: null,
      };
    }

    return {
      method: opt.value,
      label: opt.label,
      libraryHref: `/library#${link.entryId}`,
      libraryTitle: link.title,
      sessionCount: bucket.count,
      totalMinutes: bucket.minutes,
      avgFocus: Number((bucket.focusSum / bucket.count).toFixed(1)),
      avgDifficulty: Number((bucket.difficultySum / bucket.count).toFixed(1)),
    };
  });
}
