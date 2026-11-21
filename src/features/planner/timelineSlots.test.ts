import { describe, expect, it } from "vitest";

import { nudgeClock, slotClocksFor } from "./timelineSlots";

describe("timeline slots", () => {
  const base = { wakeTime: "07:00", sleepTargetMin: 480, windDownMin: 45 };

  it("starts at wake time and stops before wind-down", () => {
    const slots = slotClocksFor({ ...base, snapMin: 15 });
    expect(slots[0]).toBe("07:00");
    // Wind-down starts at 22:15, so the last slot that still fits starts at 22:00.
    expect(slots).not.toContain("22:15");
    expect(slots[slots.length - 1]).toBe("22:00");
    expect(slots).toHaveLength(61);
  });

  it("honours custom snap steps and the hard cap", () => {
    expect(slotClocksFor({ ...base, snapMin: 30 })[1]).toBe("07:30");
    expect(slotClocksFor({ ...base, snapMin: 15, limit: 3 })).toEqual([
      "07:00",
      "07:15",
      "07:30",
    ]);
  });

  it("handles a late wake time without inventing morning slots", () => {
    const late = slotClocksFor({ wakeTime: "19:00", sleepTargetMin: 480, windDownMin: 45 });
    expect(late[0]).toBe("19:00");
    expect(late).toHaveLength(20);
    expect(late[late.length - 1]).toBe("23:45");
    expect(late).not.toContain("18:45");
  });

  it("nudges clocks forward and backward and never wraps past midnight", () => {
    expect(nudgeClock("09:00", 15)).toBe("09:15");
    expect(nudgeClock("09:00", -30)).toBe("08:30");
    expect(nudgeClock("23:50", 30)).toBe("23:59");
    expect(nudgeClock("00:05", -30)).toBe("00:00");
    expect(nudgeClock("not-a-time", 15)).toBe("not-a-time");
  });
});
