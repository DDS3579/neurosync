import { format, startOfDay, subDays } from "date-fns";

import { ACTIVITY_META, activityToRegionIntensity } from "@/data/brainRegions";
import type {
  ActivityKind,
  FocusSession,
  Habit,
  HabitLog,
  ISODate,
  LearningMethod,
  MovementLog,
  RegionId,
  SleepLog,
} from "@/types/domain";

const METHOD_TO_ACTIVITY: Record<LearningMethod, ActivityKind> = {
  active_recall: "active_recall",
  spaced_repetition: "spaced_repetition",
  problem_solving: "problem_solving",
  deep_reading: "reading",
  skill_practice: "skill_practice",
  teaching: "teaching",
};

function inferHabitActivityKind(name: string): ActivityKind {
  const lower = name.toLowerCase();
  if (lower.includes("meditat") || lower.includes("mindful") || lower.includes("breath")) {
    return "mindfulness";
  }
  if (lower.includes("read")) return "reading";
  if (
    lower.includes("outdoor") ||
    lower.includes("walk") ||
    lower.includes("stretch") ||
    lower.includes("run") ||
    lower.includes("exercise")
  ) {
    return "exercise";
  }
  if (lower.includes("music")) return "music";
  if (lower.includes("language")) return "language_learning";
  if (lower.includes("journal") || lower.includes("write") || lower.includes("draw")) {
    return "creative";
  }
  return "mindfulness";
}

export interface LoggedActivitySummary {
  kind: ActivityKind;
  label: string;
  minutes: number;
  count: number;
}

export function deriveWeeklyBrainActivity(params: {
  focus: readonly FocusSession[];
  movement: readonly MovementLog[];
  sleep: readonly SleepLog[];
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  today?: Date;
}): {
  activity: Partial<Record<RegionId, number>>;
  items: LoggedActivitySummary[];
  windowStart: ISODate;
  windowEnd: ISODate;
} {
  const end = startOfDay(params.today ?? new Date());
  const start = subDays(end, 6);
  const windowStart = format(start, "yyyy-MM-dd");
  const windowEnd = format(end, "yyyy-MM-dd");

  const inRange = (d: ISODate) => d >= windowStart && d <= windowEnd;

  const rawItems: { kind: ActivityKind; minutes: number }[] = [];
  const counts = new Map<ActivityKind, { minutes: number; count: number }>();

  const add = (kind: ActivityKind, minutes: number) => {
    if (minutes <= 0) return;
    rawItems.push({ kind, minutes });
    const prev = counts.get(kind) ?? { minutes: 0, count: 0 };
    counts.set(kind, { minutes: prev.minutes + minutes, count: prev.count + 1 });
  };

  for (const f of params.focus) {
    if (inRange(f.date)) add(METHOD_TO_ACTIVITY[f.method], f.durationMin);
  }

  for (const m of params.movement) {
    if (inRange(m.date)) add("exercise", m.durationMin);
  }

  for (const s of params.sleep) {
    if (inRange(s.date)) {
      // Scale sleep nights modestly so a single night complements waking activities.
      add("sleep_rest", Math.max(15, Math.round(s.durationMin / 16)));
    }
  }

  const habitNameById = new Map(params.habits.map((h) => [h.id, h.name]));
  for (const hl of params.habitLogs) {
    if (hl.done && inRange(hl.date)) {
      const habitName = habitNameById.get(hl.habitId) ?? "";
      add(inferHabitActivityKind(habitName), 15);
    }
  }

  const items: LoggedActivitySummary[] = [...counts.entries()]
    .map(([kind, stats]) => ({
      kind,
      label: ACTIVITY_META[kind].label,
      minutes: stats.minutes,
      count: stats.count,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    activity: activityToRegionIntensity(rawItems),
    items,
    windowStart,
    windowEnd,
  };
}
