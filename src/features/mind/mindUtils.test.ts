import { describe, expect, it } from "vitest";

import type { JournalEntry } from "@/types/domain";
import {
  computeBreathingPhase,
  filterJournalEntries,
  formatMindClock,
  gratitudeFormSchema,
  journalFormSchema,
  normalizeGratitudeItems,
} from "./mindUtils";

describe("computeBreathingPhase", () => {
  it("walks box breathing through Inhale, Hold, Exhale, Hold across 16s cycles", () => {
    const p0 = computeBreathingPhase("box_breathing", 0);
    expect(p0.label).toBe("Inhale");
    expect(p0.cycleNumber).toBe(1);
    expect(p0.scale).toBeCloseTo(0.65);

    const p2 = computeBreathingPhase("box_breathing", 2000);
    expect(p2.label).toBe("Inhale");
    expect(p2.phaseProgress).toBeCloseTo(0.5);
    expect(p2.scale).toBeCloseTo(0.825);

    const p4 = computeBreathingPhase("box_breathing", 4000);
    expect(p4.label).toBe("Hold");
    expect(p4.scale).toBe(1);

    const p10 = computeBreathingPhase("box_breathing", 10000);
    expect(p10.label).toBe("Exhale");
    expect(p10.phaseProgress).toBeCloseTo(0.5);
    expect(p10.scale).toBeCloseTo(0.825);

    const p13 = computeBreathingPhase("box_breathing", 13000);
    expect(p13.label).toBe("Hold");
    expect(p13.scale).toBe(0.65);

    const nextCycle = computeBreathingPhase("box_breathing", 16000);
    expect(nextCycle.label).toBe("Inhale");
    expect(nextCycle.cycleNumber).toBe(2);
  });

  it("walks 4-7-8 breathing across 19s cycles", () => {
    const inhale = computeBreathingPhase("4_7_8_breathing", 1000);
    expect(inhale.label).toBe("Inhale");
    expect(inhale.phaseDurationSec).toBe(4);

    const hold = computeBreathingPhase("4_7_8_breathing", 5000);
    expect(hold.label).toBe("Hold");
    expect(hold.phaseDurationSec).toBe(7);

    const exhale = computeBreathingPhase("4_7_8_breathing", 15000);
    expect(exhale.label).toBe("Exhale");
    expect(exhale.phaseDurationSec).toBe(8);
    expect(exhale.phaseRemainingSec).toBe(4);

    const cycle2 = computeBreathingPhase("4_7_8_breathing", 19500);
    expect(cycle2.cycleNumber).toBe(2);
    expect(cycle2.label).toBe("Inhale");
  });

  it("clamps negative elapsed values safely", () => {
    const result = computeBreathingPhase("box_breathing", -500);
    expect(result.label).toBe("Inhale");
    expect(result.cycleNumber).toBe(1);
    expect(result.scale).toBeCloseTo(0.65);
  });
});

describe("formatMindClock", () => {
  it("formats remaining milliseconds as MM:SS", () => {
    expect(formatMindClock(0)).toBe("00:00");
    expect(formatMindClock(59_100)).toBe("01:00");
    expect(formatMindClock(120_000)).toBe("02:00");
    expect(formatMindClock(9_500)).toBe("00:10");
  });
});

describe("filterJournalEntries", () => {
  const entries: JournalEntry[] = [
    {
      id: "1",
      date: "2026-11-14",
      text: "Long walk after reading.",
      createdAt: "2026-11-14T10:00:00.000Z",
      updatedAt: "2026-11-14T10:00:00.000Z",
    },
    {
      id: "2",
      date: "2026-11-16",
      text: "Quiet morning tea before focus block.",
      createdAt: "2026-11-16T08:00:00.000Z",
      updatedAt: "2026-11-16T08:00:00.000Z",
    },
    {
      id: "3",
      date: "2026-11-16",
      text: "Evening reflection on sleep routine.",
      createdAt: "2026-11-16T21:00:00.000Z",
      updatedAt: "2026-11-16T21:00:00.000Z",
    },
  ];

  it("returns all entries sorted newest-first when query is empty", () => {
    expect(filterJournalEntries(entries, "   ").map((e) => e.id)).toEqual(["3", "2", "1"]);
  });

  it("matches text case-insensitively and preserves newest-first order", () => {
    expect(filterJournalEntries(entries, "MORNING").map((e) => e.id)).toEqual(["2"]);
    expect(filterJournalEntries(entries, "2026-11-16").map((e) => e.id)).toEqual(["3", "2"]);
  });
});

describe("normalizeGratitudeItems and schemas", () => {
  it("trims blanks and caps at 3 lines", () => {
    expect(normalizeGratitudeItems(["  Warm sun  ", "", "   ", "Coffee", "Walk", "Extra"])).toEqual([
      "Warm sun",
      "Coffee",
      "Walk",
    ]);
  });

  it("validates journal and gratitude forms", () => {
    expect(journalFormSchema.safeParse({ date: "2026-11-16", text: "   " }).success).toBe(false);
    expect(journalFormSchema.safeParse({ date: "2026-11-16", text: "Steady afternoon." }).success).toBe(true);

    expect(
      gratitudeFormSchema.safeParse({ date: "2026-11-16", line1: "", line2: "", line3: "" }).success,
    ).toBe(false);
    expect(
      gratitudeFormSchema.safeParse({
        date: "2026-11-16",
        line1: "Quiet walk",
        line2: "",
        line3: "",
      }).success,
    ).toBe(true);
  });
});
