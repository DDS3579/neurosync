import { minutesToClock } from "@/features/planner/dayContext";
import { parseHHMM } from "@/features/reminders/reminderUtils";

export interface SlotOptions {
  wakeTime: string;
  sleepTargetMin: number;
  windDownMin: number;
  snapMin?: number;
  /** Hard cap so a broken sleep target can never render thousands of slots. */
  limit?: number;
}

/**
 * Start times for the day's open timeline: from wake time up to the start of
 * wind-down, on the snap grid. Pure and deterministic, so the drop rail, the
 * keyboard picker and the tests all agree on the same clock strings.
 */
export function slotClocksFor(options: SlotOptions): string[] {
  const wakeMin = parseHHMM(options.wakeTime) ?? 420;
  const snap = Math.max(5, Math.min(60, Math.round(options.snapMin ?? 15)));
  const sleepMin = Math.max(60, Math.min(960, Math.round(options.sleepTargetMin)));
  const windDownMin = Math.max(0, Math.min(360, Math.round(options.windDownMin)));
  const windDownStart = Math.max(0, 1440 - sleepMin - windDownMin);
  const limit = Math.max(1, Math.min(96, options.limit ?? 64));

  // The planner's schedule validator measures offsets from wake time, so the
  // same relative window is used here and capped at midnight.
  const dayEnd = Math.min(1440, wakeMin + windDownStart);
  const out: string[] = [];
  for (let minutes = wakeMin; minutes + snap <= dayEnd && out.length < limit; minutes += snap) {
    out.push(minutesToClock(minutes));
  }
  return out;
}

/**
 * Nudges a clock string by a number of minutes. Clamped to 00:00–23:59 rather
 * than wrapping, so nudging a late block never jumps it to the early morning.
 */
export function nudgeClock(clock: string, deltaMin: number): string {
  const minutes = parseHHMM(clock);
  if (minutes === null) return clock;
  return minutesToClock(Math.max(0, Math.min(1439, minutes + deltaMin)));
}
