import { describe, expect, it } from "vitest";

import {
  WEEKLY_EXPORT_FOOTER,
  formatDeltaBadge,
  formatMinutesLabel,
} from "./weeklyExport";

describe("weeklyExport helpers", () => {
  it("formats durations cleanly", () => {
    expect(formatMinutesLabel(45)).toBe("45m");
    expect(formatMinutesLabel(120)).toBe("2h");
    expect(formatMinutesLabel(95)).toBe("1h 35m");
  });

  it("formats neutral week-over-week delta badges", () => {
    expect(formatDeltaBadge(undefined, "m")).toBeNull();
    expect(formatDeltaBadge({ delta: 10, direction: "flat" }, "m")).toBe(
      "Similar to prev week",
    );
    expect(
      formatDeltaBadge(
        { delta: 45, direction: "up" },
        "m",
        { formatValue: formatMinutesLabel },
      ),
    ).toBe("+45m vs prev week");
    expect(formatDeltaBadge({ delta: -0.6, direction: "down" }, "/5")).toBe(
      "−0.6/5 vs prev week",
    );
  });

  it("keeps the required medical/self-report disclaimer footer verbatim", () => {
    expect(WEEKLY_EXPORT_FOOTER).toBe(
      "Self-reported data from NeuroSync. Not a medical assessment.",
    );
  });
});
