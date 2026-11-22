import { describe, expect, it } from "vitest";
import { parseIcsBusyIntervals, parseIcsDurationMinutes, unfoldIcsLines } from "./parseIcs";

const RANGE = { start: "2026-11-16", end: "2026-11-22" };

const wrap = (events: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN", events, "END:VCALENDAR"].join("\r\n") + "\r\n";

describe("unfoldIcsLines", () => {
  it("joins continuation lines and normalises CRLF", () => {
    expect(unfoldIcsLines("SUMMARY:Long\r\n  title\r\nDTSTART:20261119T090000\r\n")).toEqual([
      "SUMMARY:Long title",
      "DTSTART:20261119T090000",
    ]);
  });
});

describe("parseIcsDurationMinutes", () => {
  it("parses hours, minutes, days and weeks", () => {
    expect(parseIcsDurationMinutes("PT50M")).toBe(50);
    expect(parseIcsDurationMinutes("PT1H30M")).toBe(90);
    expect(parseIcsDurationMinutes("P1D")).toBe(1440);
    expect(parseIcsDurationMinutes("P1W")).toBe(10080);
    expect(parseIcsDurationMinutes("-PT15M")).toBe(-15);
    expect(parseIcsDurationMinutes("nonsense")).toBeNull();
  });
});

describe("parseIcsBusyIntervals", () => {
  it("reads a folded, escaped, TZID event as a read-only busy window", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT",
        "UID:sem-1",
        "DTSTART;TZID=Europe/London:20261119T100000",
        "DTEND;TZID=Europe/London:20261119T110000",
        "SUMMARY:Lab seminar\\, room 2",
        "END:VEVENT",
      ].join("\r\n"),
    );
    const result = parseIcsBusyIntervals(ics, RANGE);
    expect(result.intervals).toEqual([
      {
        id: "sem-1:2026-11-19",
        title: "Lab seminar, room 2",
        date: "2026-11-19",
        startTime: "10:00",
        endTime: "11:00",
        readOnly: true,
        source: "imported-ics",
      },
    ]);
    expect(result.notes.join(" ")).toMatch(/TZID/);
  });

  it("supports DURATION instead of DTEND", () => {
    const ics = wrap(
      ["BEGIN:VEVENT", "UID:d1", "DTSTART:20261119T090000", "DURATION:PT50M", "SUMMARY:Reading", "END:VEVENT"].join("\r\n"),
    );
    expect(parseIcsBusyIntervals(ics, RANGE).intervals[0]).toMatchObject({ startTime: "09:00", endTime: "09:50" });
  });

  it("skips all-day and transparent entries so they never block time", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT", "UID:a1", "DTSTART;VALUE=DATE:20261119", "DTEND;VALUE=DATE:20261120", "SUMMARY:Holiday", "END:VEVENT",
        "BEGIN:VEVENT", "UID:t1", "DTSTART:20261119T120000", "DTEND:20261119T130000", "TRANSP:TRANSPARENT", "SUMMARY:Fyi", "END:VEVENT",
      ].join("\r\n"),
    );
    const result = parseIcsBusyIntervals(ics, RANGE);
    expect(result.intervals).toEqual([]);
    expect(result.skipped.allDay).toBe(1);
    expect(result.skipped.transparent).toBe(1);
  });

  it("expands FREQ=DAILY inside the range and honours COUNT and INTERVAL", () => {
    const daily = wrap(
      ["BEGIN:VEVENT", "UID:r1", "DTSTART:20261116T220000", "DTEND:20261116T221000", "RRULE:FREQ=DAILY", "SUMMARY:Wind-down", "END:VEVENT"].join("\r\n"),
    );
    expect(parseIcsBusyIntervals(daily, RANGE).intervals).toHaveLength(7);

    const counted = wrap(
      ["BEGIN:VEVENT", "UID:r2", "DTSTART:20261116T080000", "DTEND:20261116T083000", "RRULE:FREQ=DAILY;COUNT=3", "SUMMARY:Standup", "END:VEVENT"].join("\r\n"),
    );
    expect(parseIcsBusyIntervals(counted, RANGE).intervals.map((i) => i.date)).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18",
    ]);

    const alternate = wrap(
      ["BEGIN:VEVENT", "UID:r3", "DTSTART:20261116T080000", "DTEND:20261116T083000", "RRULE:FREQ=DAILY;INTERVAL=2", "SUMMARY:Every other day", "END:VEVENT"].join("\r\n"),
    );
    expect(parseIcsBusyIntervals(alternate, RANGE).intervals.map((i) => i.date)).toEqual([
      "2026-11-16", "2026-11-18", "2026-11-20", "2026-11-22",
    ]);
  });

  it("reports unsupported recurrence rather than guessing", () => {
    const weekly = wrap(
      ["BEGIN:VEVENT", "UID:w1", "DTSTART:20261116T080000", "DTEND:20261116T090000", "RRULE:FREQ=WEEKLY", "SUMMARY:Weekly", "END:VEVENT"].join("\r\n"),
    );
    const result = parseIcsBusyIntervals(weekly, RANGE);
    expect(result.intervals).toEqual([]);
    expect(result.skipped.unsupportedRecurrence).toBe(1);
    expect(result.notes.join(" ")).toMatch(/Only daily repeating events/i);
  });

  it("keeps events outside the range out, and handles a midnight-crossing event", () => {
    const ics = wrap(
      [
        "BEGIN:VEVENT", "UID:out", "DTSTART:20261101T080000", "DTEND:20261101T090000", "SUMMARY:Old", "END:VEVENT",
        "BEGIN:VEVENT", "UID:late", "DTSTART:20261119T233000", "DTEND:20261120T001500", "SUMMARY:Late call", "END:VEVENT",
      ].join("\r\n"),
    );
    const result = parseIcsBusyIntervals(ics, RANGE);
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]).toMatchObject({ date: "2026-11-19", startTime: "23:30", endTime: "00:15" });
    expect(result.skipped.outOfRange).toBe(1);
  });

  it("rejects an invalid range and malformed events without throwing", () => {
    expect(parseIcsBusyIntervals("not a calendar", RANGE).intervals).toEqual([]);
    expect(parseIcsBusyIntervals("x", { start: "2026-11-22", end: "2026-11-16" }).notes[0]).toMatch(/valid date range/i);
    const broken = wrap(["BEGIN:VEVENT", "UID:bad", "DTSTART:nonsense", "END:VEVENT"].join("\r\n"));
    expect(parseIcsBusyIntervals(broken, RANGE).skipped.invalid).toBe(1);
  });

  it("converts a UTC stamp into local wall-clock time", () => {
    const ics = wrap(
      ["BEGIN:VEVENT", "UID:z1", "DTSTART:20261119T090000Z", "DTEND:20261119T100000Z", "SUMMARY:UTC call", "END:VEVENT"].join("\r\n"),
    );
    const result = parseIcsBusyIntervals(ics, { start: "2026-11-18", end: "2026-11-20" });
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]!.startTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
