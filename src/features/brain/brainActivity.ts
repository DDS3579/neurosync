import { format, startOfDay, subDays } from "date-fns";

import {
  ACTIVITY_META,
  ACTIVITY_REGION_MAP,
  BRAIN_REGIONS,
  activityToRegionIntensity,
} from "@/data/brainRegions";
import {
  activityKindForFocusSession,
  buildLinkedKindMap,
} from "@/features/planner/review/focusLedger";
import type {
  ActivityKind,
  ActivityLog,
  Block,
  FocusSession,
  Habit,
  HabitLog,
  ISODate,
  MindfulnessSession,
  MovementLog,
  RegionId,
  SleepLog,
  Task,
} from "@/types/domain";

const REGION_NAME_BY_ID: Record<RegionId, string> = Object.fromEntries(
  BRAIN_REGIONS.map((r) => [r.id, r.name]),
) as Record<RegionId, string>;

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

export interface BrainActivitySources {
  focus: readonly FocusSession[];
  movement: readonly MovementLog[];
  sleep: readonly SleepLog[];
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  mindfulness?: readonly MindfulnessSession[];
  activities?: readonly ActivityLog[];
  /**
   * Planner blocks are used ONLY to resolve which task kind produced a linked
   * FocusSession. Block minutes are never added — the session is the single
   * source of focus minutes, so nothing is counted twice.
   */
  blocks?: readonly Block[];
  tasks?: readonly Task[];
}

export interface BrainTimelineSnapshot {
  items: LoggedActivitySummary[];
  regionIntensity: Partial<Record<RegionId, number>>;
  totalMinutes: number;
}

export interface BrainTimelineDay {
  date: ISODate;
  shortLabel: string;
  dayOnly: BrainTimelineSnapshot;
  cumulative: BrainTimelineSnapshot;
}

export interface BrainTimelineData {
  windowDays: 7 | 30;
  windowStart: ISODate;
  windowEnd: ISODate;
  days: BrainTimelineDay[];
}

export interface ImpactRegionBar {
  region: RegionId;
  regionName: string;
  weight: number;
}

export interface RankedImpactActivity {
  kind: ActivityKind;
  label: string;
  minutes: number;
  count: number;
  regions: ImpactRegionBar[];
}

export interface RegionContributionItem {
  kind: ActivityKind;
  label: string;
  minutes: number;
  count: number;
  weight: number;
  weightedMinutes: number;
  share: number;
  explanation: string;
}

function summarizeRawMap(
  counts: ReadonlyMap<ActivityKind, { minutes: number; count: number }>,
): LoggedActivitySummary[] {
  return [...counts.entries()]
    .map(([kind, stats]) => ({
      kind,
      label: ACTIVITY_META[kind].label,
      minutes: stats.minutes,
      count: stats.count,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
}

function collectRawEventsByDate(
  params: BrainActivitySources,
  windowStart: ISODate,
  windowEnd: ISODate,
): Map<ISODate, { kind: ActivityKind; minutes: number }[]> {
  const byDate = new Map<ISODate, { kind: ActivityKind; minutes: number }[]>();
  const add = (date: ISODate, kind: ActivityKind, minutes: number) => {
    if (minutes <= 0 || date < windowStart || date > windowEnd) return;
    const list = byDate.get(date);
    if (list) list.push({ kind, minutes });
    else byDate.set(date, [{ kind, minutes }]);
  };

  const linkedKinds = buildLinkedKindMap(params.blocks ?? [], params.tasks ?? []);
  for (const f of params.focus) {
    add(f.date, activityKindForFocusSession(f, linkedKinds.get(f.id)), f.durationMin);
  }
  for (const m of params.movement) {
    add(m.date, "exercise", m.durationMin);
  }
  for (const s of params.sleep) {
    // Scale sleep nights modestly so a single night complements waking activities.
    add(s.date, "sleep_rest", Math.max(15, Math.round(s.durationMin / 16)));
  }

  const habitNameById = new Map(params.habits.map((h) => [h.id, h.name]));
  for (const hl of params.habitLogs) {
    if (!hl.done) continue;
    const habitName = habitNameById.get(hl.habitId) ?? "";
    add(hl.date, inferHabitActivityKind(habitName), 15);
  }
  for (const ms of params.mindfulness ?? []) {
    add(ms.date, "mindfulness", ms.durationMin);
  }
  for (const act of params.activities ?? []) {
    add(act.date, act.type, act.durationMin);
  }

  return byDate;
}

export function deriveWeeklyBrainActivity(
  params: BrainActivitySources & { today?: Date },
): {
  activity: Partial<Record<RegionId, number>>;
  items: LoggedActivitySummary[];
  windowStart: ISODate;
  windowEnd: ISODate;
} {
  const end = startOfDay(params.today ?? new Date());
  const start = subDays(end, 6);
  const windowStart = format(start, "yyyy-MM-dd");
  const windowEnd = format(end, "yyyy-MM-dd");

  const byDate = collectRawEventsByDate(params, windowStart, windowEnd);
  const rawItems: { kind: ActivityKind; minutes: number }[] = [];
  const counts = new Map<ActivityKind, { minutes: number; count: number }>();

  for (const dayEvents of byDate.values()) {
    for (const ev of dayEvents) {
      rawItems.push(ev);
      const prev = counts.get(ev.kind) ?? { minutes: 0, count: 0 };
      counts.set(ev.kind, { minutes: prev.minutes + ev.minutes, count: prev.count + 1 });
    }
  }

  return {
    activity: activityToRegionIntensity(rawItems),
    items: summarizeRawMap(counts),
    windowStart,
    windowEnd,
  };
}

/**
 * Pre-computes per-day and cumulative region intensities across a 7- or 30-day window
 * so scrubbing the time slider updates shader uniforms without recomputing aggregations.
 */
export function deriveBrainTimeline(
  params: BrainActivitySources & { windowDays: 7 | 30; today?: Date },
): BrainTimelineData {
  const end = startOfDay(params.today ?? new Date());
  const start = subDays(end, params.windowDays - 1);
  const windowStart = format(start, "yyyy-MM-dd");
  const windowEnd = format(end, "yyyy-MM-dd");

  const byDate = collectRawEventsByDate(params, windowStart, windowEnd);
  const cumCounts = new Map<ActivityKind, { minutes: number; count: number }>();
  const cumRawItems: { kind: ActivityKind; minutes: number }[] = [];
  let cumTotalMinutes = 0;

  const days: BrainTimelineDay[] = [];

  for (let offset = params.windowDays - 1; offset >= 0; offset -= 1) {
    const dayDate = subDays(end, offset);
    const iso = format(dayDate, "yyyy-MM-dd");
    const shortLabel = format(dayDate, "MMM d");
    const dayEvents = byDate.get(iso) ?? [];

    const dayCounts = new Map<ActivityKind, { minutes: number; count: number }>();
    let dayTotalMinutes = 0;

    for (const ev of dayEvents) {
      dayTotalMinutes += ev.minutes;
      const prevDay = dayCounts.get(ev.kind) ?? { minutes: 0, count: 0 };
      dayCounts.set(ev.kind, {
        minutes: prevDay.minutes + ev.minutes,
        count: prevDay.count + 1,
      });

      cumTotalMinutes += ev.minutes;
      cumRawItems.push(ev);
      const prevCum = cumCounts.get(ev.kind) ?? { minutes: 0, count: 0 };
      cumCounts.set(ev.kind, {
        minutes: prevCum.minutes + ev.minutes,
        count: prevCum.count + 1,
      });
    }

    days.push({
      date: iso,
      shortLabel,
      dayOnly: {
        items: summarizeRawMap(dayCounts),
        regionIntensity: activityToRegionIntensity(dayEvents),
        totalMinutes: dayTotalMinutes,
      },
      cumulative: {
        items: summarizeRawMap(cumCounts),
        regionIntensity: activityToRegionIntensity(cumRawItems),
        totalMinutes: cumTotalMinutes,
      },
    });
  }

  return {
    windowDays: params.windowDays,
    windowStart,
    windowEnd,
    days,
  };
}

/**
 * Ranks logged activity types by total minutes descending and pairs each with
 * its illustrative `ACTIVITY_REGION_MAP` educational region bars.
 */
export function rankLoggedActivitiesForImpact(
  items: readonly LoggedActivitySummary[],
): RankedImpactActivity[] {
  return [...items]
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label))
    .map((item) => ({
      kind: item.kind,
      label: item.label,
      minutes: item.minutes,
      count: item.count,
      regions: [...ACTIVITY_REGION_MAP[item.kind]]
        .sort((a, b) => b.weight - a.weight)
        .map((entry) => ({
          region: entry.region,
          regionName: REGION_NAME_BY_ID[entry.region],
          weight: entry.weight,
        })),
    }));
}

/**
 * Computes which logged activities contributed to a specific region's educational glow,
 * with minutes, weighted share of total, and a plain-language non-causal explanation.
 */
export function getRegionImpactContributions(
  regionId: RegionId,
  items: readonly LoggedActivitySummary[],
): RegionContributionItem[] {
  const regionName = REGION_NAME_BY_ID[regionId];
  const matches: Array<{
    item: LoggedActivitySummary;
    weight: number;
    weightedMinutes: number;
  }> = [];
  let totalWeighted = 0;

  for (const item of items) {
    if (item.minutes <= 0) continue;
    const mapping = ACTIVITY_REGION_MAP[item.kind].find((m) => m.region === regionId);
    if (!mapping || mapping.weight <= 0) continue;
    const weightedMinutes = item.minutes * mapping.weight;
    totalWeighted += weightedMinutes;
    matches.push({ item, weight: mapping.weight, weightedMinutes });
  }

  if (totalWeighted <= 0) return [];

  return matches
    .sort((a, b) => b.weightedMinutes - a.weightedMinutes || a.item.label.localeCompare(b.item.label))
    .map(({ item, weight, weightedMinutes }) => {
      const meta = ACTIVITY_META[item.kind];
      return {
        kind: item.kind,
        label: item.label,
        minutes: item.minutes,
        count: item.count,
        weight,
        weightedMinutes,
        share: weightedMinutes / totalWeighted,
        explanation: `${meta.label} (${meta.description.replace(/\.$/, "")}) is commonly associated with ${regionName} based on what you logged.`,
      };
    });
}

/**
 * Returns true if the user has any logged entries across the brain activity tables
 * (used to gate the "Load demo data" shortcut in empty states).
 */
export function hasAnyBrainActivityData(params: BrainActivitySources): boolean {
  return (
    params.focus.length > 0 ||
    params.movement.length > 0 ||
    params.sleep.length > 0 ||
    params.habitLogs.some((h) => h.done) ||
    (params.mindfulness?.length ?? 0) > 0 ||
    (params.activities?.length ?? 0) > 0
  );
}
