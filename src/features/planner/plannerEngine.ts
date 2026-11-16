import { parseISO } from "date-fns";

import { parseHHMM } from "@/features/reminders/reminderUtils";
import type {
  FocusSession,
  ISODate,
  PlanBlockKind,
  PlannerFixedCommitment,
  PlannerStudyGoal,
  ScheduledPlanBlock,
  UnscheduledGoalItem,
} from "@/types/domain";

export interface PlannerInputs {
  date: ISODate;
  wakeTime: string; // 'HH:MM'
  sleepTargetMin: number;
  windDownMin: number;
  maxStudyBlockMin: number;
  breakMin: number;
  bufferMin: number;
  movementGoalMin: number;
  preferRecoverySpacing: boolean;
  commitments: readonly PlannerFixedCommitment[];
  studyGoals: readonly PlannerStudyGoal[];
  focusHistory?: readonly FocusSession[];
}

export interface PlanBalanceSummary {
  studyMin: number;
  recoveryMin: number;
  movementMin: number;
  fixedMin: number;
  sleepMin: number;
}

export interface GeneratedDayPlan {
  blocks: ScheduledPlanBlock[];
  unscheduled: UnscheduledGoalItem[];
  usedHistoryWindows: boolean;
  preferredHours: number[];
  balance: PlanBalanceSummary;
}

interface Interval {
  start: number; // offset minutes from wakeTime (0..1440)
  end: number;   // offset minutes from wakeTime (0..1440)
}

export function formatOffsetTime(wakeMin: number, offsetMin: number): string {
  const total = (((wakeMin + offsetMin) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function timeToOffset(wakeMin: number, timeHHMM: string): number {
  const m = parseHHMM(timeHHMM);
  if (m === null) return 0;
  return (((m - wakeMin) % 1440) + 1440) % 1440;
}

function durationBetweenTimes(startHHMM: string, endHHMM: string): number {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  if (s === null || e === null) return 0;
  if (e > s) return e - s;
  if (e < s) return 1440 - s + e;
  return 0;
}

/**
 * Infers preferred study start hours from past FocusSessions when at least 5
 * sessions across 2+ distinct hours exist; otherwise defaults to calm daytime windows.
 */
export function inferPreferredFocusHours(
  focusHistory: readonly FocusSession[] = [],
): { usedHistory: boolean; hours: number[] } {
  const DEFAULT_HOURS = [9, 10, 11, 14, 15, 16, 8, 17, 13, 18, 19, 20];
  if (focusHistory.length < 5) {
    return { usedHistory: false, hours: DEFAULT_HOURS };
  }

  const byHour = new Map<number, { sum: number; count: number }>();
  for (const s of focusHistory) {
    const parsed = parseISO(s.startedAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const h = parsed.getHours();
    const prev = byHour.get(h) ?? { sum: 0, count: 0 };
    byHour.set(h, { sum: prev.sum + s.focusRating, count: prev.count + 1 });
  }

  if (byHour.size < 2) {
    return { usedHistory: false, hours: DEFAULT_HOURS };
  }

  const ranked = [...byHour.entries()]
    .map(([hour, stats]) => ({
      hour,
      avg: stats.sum / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.hour - b.hour)
    .map((entry) => entry.hour);

  const combined = [...ranked];
  for (const h of DEFAULT_HOURS) {
    if (!combined.includes(h)) combined.push(h);
  }
  return { usedHistory: true, hours: combined };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function subtractBusy(totalEnd: number, busy: readonly Interval[]): Interval[] {
  const sorted = [...busy]
    .map((iv) => ({ start: Math.max(0, iv.start), end: Math.min(totalEnd, iv.end) }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const free: Interval[] = [];
  let cursor = 0;
  for (const iv of sorted) {
    if (iv.start > cursor) {
      free.push({ start: cursor, end: iv.start });
    }
    cursor = Math.max(cursor, iv.end);
  }
  if (cursor < totalEnd) {
    free.push({ start: cursor, end: totalEnd });
  }
  return free;
}

/**
 * Pure deterministic daily schedule planner.
 * All time coordinates run in [0, 1440) minutes from `wakeTime` so midnight-crossing
 * sleep windows are handled uniformly without wrapping errors.
 */
export function generateDayPlan(inputs: PlannerInputs): GeneratedDayPlan {
  const wakeMin = parseHHMM(inputs.wakeTime) ?? 420; // default 07:00
  const sleepMin = Math.max(240, Math.min(720, Math.round(inputs.sleepTargetMin)));
  const windDownMin = Math.max(0, Math.min(180, Math.round(inputs.windDownMin)));
  const maxStudyBlockMin = Math.max(15, Math.min(90, Math.round(inputs.maxStudyBlockMin)));
  const breakMin = Math.max(0, Math.min(45, Math.round(inputs.breakMin)));
  const bufferMin = Math.max(0, Math.min(30, Math.round(inputs.bufferMin)));
  const movementGoalMin = Math.max(0, Math.min(180, Math.round(inputs.movementGoalMin)));

  const sleepStart = 1440 - sleepMin;
  const windDownStart = Math.max(0, sleepStart - windDownMin);

  const blocks: ScheduledPlanBlock[] = [];
  const unscheduled: UnscheduledGoalItem[] = [];
  const occupied: Interval[] = [];
  const bufferedReserved: Interval[] = [];

  const pushBlock = (
    id: string,
    kind: PlanBlockKind,
    title: string,
    start: number,
    end: number,
    extra?: Pick<ScheduledPlanBlock, "subject" | "difficulty" | "notes">,
  ) => {
    blocks.push({
      id,
      kind,
      title,
      startTime: formatOffsetTime(wakeMin, start),
      endTime: formatOffsetTime(wakeMin, end),
      durationMin: end - start,
      ...extra,
    });
  };

  // 1. Protect sleep and wind-down windows unconditionally.
  if (windDownStart < sleepStart) {
    pushBlock("wind-down", "wind_down", "Wind-down window", windDownStart, sleepStart, {
      notes: "Protected evening step-down before sleep.",
    });
  }
  pushBlock("sleep", "sleep", "Protected sleep", sleepStart, 1440, {
    notes: `${Math.round((sleepMin / 60) * 10) / 10}h target sleep window.`,
  });

  // 2. Place fixed commitments (detecting overlaps with earlier commitments or sleep).
  const sortedCommitments = [...inputs.commitments]
    .map((c) => {
      const start = timeToOffset(wakeMin, c.startTime);
      const dur = durationBetweenTimes(c.startTime, c.endTime);
      return { ...c, start, end: start + dur, dur };
    })
    .filter((c) => c.dur > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (const c of sortedCommitments) {
    const iv: Interval = { start: c.start, end: c.end };
    const conflict = occupied.find((o) => overlaps(o, iv));
    if (conflict) {
      unscheduled.push({
        id: c.id,
        kind: "fixed",
        title: c.title,
        minutes: c.dur,
        reason: `Overlaps with an earlier fixed block (${formatOffsetTime(wakeMin, conflict.start)}–${formatOffsetTime(wakeMin, conflict.end)}).`,
      });
      continue;
    }

    if (iv.end > sleepStart) {
      unscheduled.push({
        id: c.id,
        kind: "fixed",
        title: c.title,
        minutes: c.dur,
        reason: "Extends into your protected sleep window.",
      });
      continue;
    }

    occupied.push(iv);
    bufferedReserved.push({
      start: Math.max(0, iv.start - bufferMin),
      end: Math.min(windDownStart, iv.end + bufferMin),
    });
    pushBlock(`fixed-${c.id}`, "fixed", c.title, iv.start, iv.end);
  }

  // 3. Determine preferred hours from focus history (or defaults).
  const { usedHistory, hours: preferredHours } = inferPreferredFocusHours(inputs.focusHistory);
  const preferredHourRank = new Map<number, number>(
    preferredHours.map((h, idx) => [h, idx]),
  );

  // Score a candidate start offset by which historical/preferred hour it lands in.
  const scoreStartOffset = (offsetMin: number): number => {
    const clockHour = Math.floor((((wakeMin + offsetMin) % 1440) + 1440) % 1440 / 60);
    return preferredHourRank.get(clockHour) ?? 99;
  };

  // Helper to claim a contiguous sub-interval inside free windows before windDownStart.
  const allReserved = () => [...occupied, ...bufferedReserved];

  const findSlotForDuration = (neededMin: number, preferLateAfternoon = false): Interval | null => {
    const freeSlots = subtractBusy(windDownStart, allReserved()).filter(
      (slot) => slot.end - slot.start >= neededMin,
    );
    if (freeSlots.length === 0) return null;

    if (preferLateAfternoon) {
      // Pick slot closest to 16:00–18:30 (or last daytime slot).
      const targetOffset = timeToOffset(wakeMin, "16:30");
      const ranked = [...freeSlots].sort(
        (a, b) => Math.abs(a.start - targetOffset) - Math.abs(b.start - targetOffset),
      );
      const chosen = ranked[0]!;
      return { start: chosen.start, end: chosen.start + neededMin };
    }

    // Evaluate candidate start offsets inside each free slot, preferring best focus hours.
    let bestCandidate: { start: number; rank: number } | null = null;
    for (const slot of freeSlots) {
      // Check slot start and hourly boundaries within the slot.
      const candidates = [slot.start];
      for (let t = Math.ceil(slot.start / 60) * 60; t + neededMin <= slot.end; t += 60) {
        if (!candidates.includes(t)) candidates.push(t);
      }
      for (const cand of candidates) {
        if (cand + neededMin > slot.end) continue;
        const rank = scoreStartOffset(cand);
        if (
          bestCandidate === null ||
          rank < bestCandidate.rank ||
          (rank === bestCandidate.rank && cand < bestCandidate.start)
        ) {
          bestCandidate = { start: cand, rank };
        }
      }
    }

    return bestCandidate
      ? { start: bestCandidate.start, end: bestCandidate.start + neededMin }
      : null;
  };

  // 4. Schedule study goals split into <= maxStudyBlockMin chunks + breaks.
  const sortedGoals = [...inputs.studyGoals]
    .filter((g) => g.subject.trim().length > 0 && g.minutes > 0)
    .sort((a, b) => (b.difficulty ?? 3) - (a.difficulty ?? 3));

  for (const goal of sortedGoals) {
    let remaining = Math.round(goal.minutes);
    let chunkIndex = 1;

    while (remaining > 0) {
      const chunkMin = Math.min(maxStudyBlockMin, remaining);
      const needsBreakAfter = remaining > chunkMin && breakMin > 0;
      const slot =
        findSlotForDuration(chunkMin + (needsBreakAfter ? breakMin : 0)) ??
        findSlotForDuration(chunkMin);

      if (!slot) {
        // See if a smaller partial chunk fits, otherwise report unscheduled clearly.
        const available = subtractBusy(windDownStart, allReserved());
        const largestGap = available.reduce(
          (max, iv) => Math.max(max, iv.end - iv.start),
          0,
        );

        if (largestGap >= 15) {
          const partialSlot = findSlotForDuration(largestGap)!;
          occupied.push(partialSlot);
          pushBlock(
            `study-${goal.id}-${chunkIndex}`,
            "study",
            `${goal.subject} (part ${chunkIndex})`,
            partialSlot.start,
            partialSlot.end,
            { subject: goal.subject, difficulty: goal.difficulty },
          );
          remaining -= largestGap;
          chunkIndex += 1;
          continue;
        }

        unscheduled.push({
          id: `${goal.id}-rem`,
          kind: "study",
          title: goal.subject,
          minutes: remaining,
          reason:
            largestGap === 0
              ? "No open daytime slots remain before wind-down and sleep."
              : `Remaining gaps are under 15 minutes (${largestGap}m max) before wind-down.`,
        });
        break;
      }

      const studyEnd = slot.start + chunkMin;
      occupied.push({ start: slot.start, end: studyEnd });
      pushBlock(
        `study-${goal.id}-${chunkIndex}`,
        "study",
        remaining === Math.round(goal.minutes) && chunkMin === remaining
          ? goal.subject
          : `${goal.subject} (part ${chunkIndex})`,
        slot.start,
        studyEnd,
        { subject: goal.subject, difficulty: goal.difficulty },
      );
      remaining -= chunkMin;
      chunkIndex += 1;

      if (breakMin > 0 && slot.end - studyEnd >= breakMin) {
        occupied.push({ start: studyEnd, end: studyEnd + breakMin });
        pushBlock(
          `break-${goal.id}-${chunkIndex}`,
          "break",
          "Short break",
          studyEnd,
          studyEnd + breakMin,
        );
      } else if (remaining > 0 && breakMin > 0) {
        // Reserve a break immediately after if free space exists.
        const afterFree = subtractBusy(windDownStart, occupied).find(
          (iv) => iv.start === studyEnd && iv.end - iv.start >= breakMin,
        );
        if (afterFree) {
          occupied.push({ start: studyEnd, end: studyEnd + breakMin });
          pushBlock(
            `break-${goal.id}-${chunkIndex}`,
            "break",
            "Short break",
            studyEnd,
            studyEnd + breakMin,
          );
        }
      }
    }
  }

  // 5. Schedule movement goal before wind-down.
  if (movementGoalMin > 0) {
    const moveSlot = findSlotForDuration(movementGoalMin, true);
    if (moveSlot) {
      occupied.push(moveSlot);
      pushBlock("movement-goal", "movement", "Movement", moveSlot.start, moveSlot.end, {
        notes: "Walk, stretch, or exercise goal.",
      });
    } else {
      unscheduled.push({
        id: "movement-goal",
        kind: "movement",
        title: "Movement goal",
        minutes: movementGoalMin,
        reason: "No contiguous free slot before wind-down fits your movement goal.",
      });
    }
  }

  // 6. Optional recovery breather block in remaining open space.
  if (inputs.preferRecoverySpacing) {
    const recoverySlot = findSlotForDuration(20, true);
    if (recoverySlot) {
      occupied.push(recoverySlot);
      pushBlock(
        "recovery-pause",
        "recovery",
        "Unhurried recovery pause",
        recoverySlot.start,
        recoverySlot.end,
        { notes: "Protected time away from study and screens." },
      );
    }
  }

  // Sort blocks in chronological offset order from wakeTime.
  const blockOrder = new Map<string, number>();
  for (const b of blocks) {
    blockOrder.set(b.id, timeToOffset(wakeMin, b.startTime));
  }
  blocks.sort((a, b) => (blockOrder.get(a.id) ?? 0) - (blockOrder.get(b.id) ?? 0));

  return {
    blocks,
    unscheduled,
    usedHistoryWindows: usedHistory,
    preferredHours,
    balance: computePlanBalance(blocks),
  };
}

export function computePlanBalance(blocks: readonly ScheduledPlanBlock[]): PlanBalanceSummary {
  let studyMin = 0;
  let recoveryMin = 0;
  let movementMin = 0;
  let fixedMin = 0;
  let sleepMin = 0;

  for (const b of blocks) {
    if (b.kind === "study") studyMin += b.durationMin;
    else if (b.kind === "break" || b.kind === "recovery" || b.kind === "wind_down") {
      recoveryMin += b.durationMin;
    } else if (b.kind === "movement") movementMin += b.durationMin;
    else if (b.kind === "fixed") fixedMin += b.durationMin;
    else if (b.kind === "sleep") sleepMin += b.durationMin;
  }

  return { studyMin, recoveryMin, movementMin, fixedMin, sleepMin };
}
