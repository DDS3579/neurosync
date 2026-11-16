import { describe, expect, it } from "vitest";

import { computeSleepWindow, sleepFormSchema } from "./sleepUtils";

describe("computeSleepWindow", () => {
  it("computes duration across midnight when bedtime is later than wake time", () => {
    const result = computeSleepWindow({
      wakeDateISO: "2026-11-16",
      bedtimeHHMM: "23:15",
      wakeTimeHHMM: "07:00",
    });

    expect(result).toEqual({
      bedtime: "2026-11-15T23:15:00",
      wakeTime: "2026-11-16T07:00:00",
      durationMin: 465,
      crossedMidnight: true,
    });
  });

  it("handles late bedtimes after midnight on the same wake-up date", () => {
    const result = computeSleepWindow({
      wakeDateISO: "2026-11-16",
      bedtimeHHMM: "01:30",
      wakeTimeHHMM: "08:45",
    });

    expect(result).toEqual({
      bedtime: "2026-11-16T01:30:00",
      wakeTime: "2026-11-16T08:45:00",
      durationMin: 435,
      crossedMidnight: false,
    });
  });

  it("handles exact midnight crossing (23:59 to 00:01)", () => {
    const result = computeSleepWindow({
      wakeDateISO: "2026-11-16",
      bedtimeHHMM: "23:59",
      wakeTimeHHMM: "00:01",
    });

    expect(result?.durationMin).toBe(2);
    expect(result?.crossedMidnight).toBe(true);
    expect(result?.bedtime).toBe("2026-11-15T23:59:00");
  });

  it("rejects zero-minute duration in form validation", () => {
    const parsed = sleepFormSchema.safeParse({
      date: "2026-11-16",
      bedtimeHHMM: "07:00",
      wakeTimeHHMM: "07:00",
      quality: 3,
      rested: 3,
      interruptions: 0,
    });

    expect(parsed.success).toBe(false);
  });
});
