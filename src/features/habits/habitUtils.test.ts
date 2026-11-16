import { describe, expect, it } from "vitest";

import { parseHabitTabHash } from "./habitUtils";

describe("parseHabitTabHash", () => {
  it("parses valid habit tab hashes", () => {
    expect(parseHabitTabHash("#checkin")).toBe("checkin");
    expect(parseHabitTabHash("#sleep")).toBe("sleep");
    expect(parseHabitTabHash("#movement")).toBe("movement");
    expect(parseHabitTabHash("#nutrition")).toBe("nutrition");
    expect(parseHabitTabHash("#habits")).toBe("habits");
    expect(parseHabitTabHash("#mind")).toBe("mind");
    expect(parseHabitTabHash("#activities")).toBe("activities");
  });

  it("normalizes case and missing leading hash", () => {
    expect(parseHabitTabHash("#SLEEP")).toBe("sleep");
    expect(parseHabitTabHash("  habits  ")).toBe("habits");
    expect(parseHabitTabHash("#MIND")).toBe("mind");
    expect(parseHabitTabHash("#ACTIVITIES")).toBe("activities");
  });

  it("falls back to checkin for empty or unknown hashes", () => {
    expect(parseHabitTabHash("")).toBe("checkin");
    expect(parseHabitTabHash("#")).toBe("checkin");
    expect(parseHabitTabHash("#unknown-tab")).toBe("checkin");
  });
});
