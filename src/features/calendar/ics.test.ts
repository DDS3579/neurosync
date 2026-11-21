import { describe, expect, it } from "vitest";
import { isoDatesInRange } from "@/features/planner/dayContext";
import { buildBlocksIcs, escapeIcsText, foldIcsLine } from "./ics";
import { parseIcsBusyIntervals } from "./parseIcs";
import type { ExportableBlock } from "./types";

const NOW = new Date("2026-11-19T10:00:00Z");

const block = (over: Partial<ExportableBlock> & { id: string }): ExportableBlock => ({
  title: "Chapter", date: "2026-11-19", startTime: "09:00", plannedMin: 50, kind: "deep", ...over,
});

describe("ICS text helpers", () => {
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets with a single leading space", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"x".repeat(200)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.length).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(" ")).toBe(true);
      expect(part.length).toBeLessThanOrEqual(75);
    }
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(`DESCRIPTION:${"x".repeat(200)}`);
  });

  it("never splits a multi-byte character while folding", () => {
    const folded = foldIcsLine(`SUMMARY:${"é".repeat(60)}`);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});

describe("buildBlocksIcs", () => {
  it("writes one timed event per scheduled block with project and kind in the description", () => {
    const result = buildBlocksIcs([block({ id: "b1", projectName: "Thesis" })], { now: NOW });
    expect(result.timedEvents).toBe(1);
    expect(result.allDayEvents).toBe(0);
    expect(result.content).toContain("BEGIN:VCALENDAR\r\n");
    expect(result.content).toContain("UID:neurosync-block-b1@local\r\n");
    expect(result.content).toContain("DTSTART:20261119T090000\r\n");
    expect(result.content).toContain("DTEND:20261119T095000\r\n");
    expect(result.content).toContain("DTSTAMP:20261119T100000Z\r\n");
    expect(result.content).toContain("SUMMARY:Chapter\r\n");
    expect(result.content).toContain("Project: Thesis");
    expect(result.content).toContain("Deep");
    expect(result.content.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(result.filename).toBe("neurosync-plan-2026-11-19.ics");
  });

  it("exports untimed blocks as all-day entries that never block busy time", () => {
    const result = buildBlocksIcs([block({ id: "u1", startTime: undefined })], { now: NOW });
    expect(result.allDayEvents).toBe(1);
    expect(result.content).toContain("DTSTART;VALUE=DATE:20261119\r\n");
    expect(result.content).toContain("DTEND;VALUE=DATE:20261120\r\n");
    expect(result.content).toContain("TRANSP:TRANSPARENT\r\n");
    expect(result.notes.join(" ")).toMatch(/all-day entries marked free/i);
    // Round trip: our own all-day export produces zero busy intervals.
    const parsed = parseIcsBusyIntervals(result.content, { start: "2026-11-19", end: "2026-11-19" });
    expect(parsed.intervals).toEqual([]);
    expect(parsed.skipped.allDay).toBe(1);
  });

  it("can omit untimed blocks instead, with a note", () => {
    const result = buildBlocksIcs([block({ id: "u1", startTime: undefined })], { now: NOW, untimed: "omit" });
    expect(result.allDayEvents).toBe(0);
    expect(result.omitted).toBe(1);
    expect(result.notes.join(" ")).toMatch(/left out/i);
  });

  it("excludes finished and skipped blocks and reports how many", () => {
    const result = buildBlocksIcs(
      [block({ id: "a" }), block({ id: "b", status: "done" }), block({ id: "c", status: "skipped" })],
      { now: NOW },
    );
    expect(result.timedEvents).toBe(1);
    expect(result.omitted).toBe(2);
  });

  it("rolls a block that crosses midnight into the next calendar date", () => {
    const result = buildBlocksIcs([block({ id: "late", startTime: "23:30", plannedMin: 45 })], { now: NOW });
    expect(result.content).toContain("DTSTART:20261119T233000\r\n");
    expect(result.content).toContain("DTEND:20261120T001500\r\n");
  });

  it("keeps wall-clock times identical across a spring-forward week (DST)", () => {
    const dates = isoDatesInRange("2026-03-05", "2026-03-11");
    expect(dates).toHaveLength(7);
    expect(new Set(dates).size).toBe(7);
    const result = buildBlocksIcs(
      dates.map((date, i) => block({ id: `sp${i}`, date, startTime: "09:00", plannedMin: 50 })),
      { now: NOW },
    );
    expect(result.timedEvents).toBe(7);
    for (const date of dates) {
      const compact = date.replace(/-/g, "");
      expect(result.content).toContain(`DTSTART:${compact}T090000\r\n`);
      expect(result.content).toContain(`DTEND:${compact}T095000\r\n`);
    }
    expect(result.filename).toBe("neurosync-plan-2026-03-05-to-2026-03-11.ics");
  });

  it("keeps wall-clock times identical across a fall-back week, including the ambiguous hour", () => {
    const dates = isoDatesInRange("2026-10-29", "2026-11-04");
    expect(dates).toHaveLength(7);
    const result = buildBlocksIcs(
      dates.map((date, i) => block({ id: `fb${i}`, date, startTime: "01:30", plannedMin: 50 })),
      { now: NOW },
    );
    for (const date of dates) {
      const compact = date.replace(/-/g, "");
      expect(result.content).toContain(`DTSTART:${compact}T013000\r\n`);
      expect(result.content).toContain(`DTEND:${compact}T022000\r\n`);
    }
    expect(result.notes.join(" ")).toMatch(/floating local wall-clock time/i);
  });

  it("is deterministic for the same input and stamp, and stable on re-export (same UID)", () => {
    const blocks = [block({ id: "b2", startTime: "11:00" }), block({ id: "b1" })];
    const a = buildBlocksIcs(blocks, { now: NOW });
    const b = buildBlocksIcs([...blocks].reverse(), { now: NOW });
    expect(a.content).toBe(b.content);
    expect(a.content.indexOf("neurosync-block-b1@local")).toBeLessThan(
      a.content.indexOf("neurosync-block-b2@local"),
    );
  });

  it("still emits a valid empty calendar with an explanatory note", () => {
    const result = buildBlocksIcs([], { now: NOW });
    expect(result.content).toContain("BEGIN:VCALENDAR\r\n");
    expect(result.content).toContain("END:VCALENDAR\r\n");
    expect(result.notes.join(" ")).toMatch(/Nothing to export yet/i);
    expect(result.filename).toBe("neurosync-plan.ics");
  });
});
