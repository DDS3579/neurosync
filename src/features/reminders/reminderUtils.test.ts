import { describe, expect, it } from "vitest";

import type { ReminderSettings } from "@/types/domain";
import {
  DEFAULT_REMINDER_SETTINGS,
  buildRemindersIcs,
  evaluateDueReminders,
  formatLocalDate,
  getReminderSlotKey,
  isInQuietHours,
  normalizeReminderSettings,
  parseHHMM,
} from "./reminderUtils";

const makeSettings = (over: Partial<ReminderSettings> = {}): ReminderSettings => ({
  ...DEFAULT_REMINDER_SETTINGS,
  quietHours: { enabled: false, start: "23:00", end: "07:00" },
  ...over,
});

describe("parseHHMM and quietHours", () => {
  it("parses valid 24-hour times and rejects invalid strings", () => {
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("23:59")).toBe(1439);
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("9:30")).toBeNull();
  });

  it("handles overnight quiet hours across midnight cleanly", () => {
    const overnight = { enabled: true, start: "23:00", end: "07:00" };
    expect(isInQuietHours(new Date(2026, 10, 16, 22, 59), overnight)).toBe(false);
    expect(isInQuietHours(new Date(2026, 10, 16, 23, 0), overnight)).toBe(true);
    expect(isInQuietHours(new Date(2026, 10, 17, 2, 30), overnight)).toBe(true);
    expect(isInQuietHours(new Date(2026, 10, 17, 6, 59), overnight)).toBe(true);
    expect(isInQuietHours(new Date(2026, 10, 17, 7, 0), overnight)).toBe(false);
  });

  it("handles same-day quiet hours", () => {
    const afternoon = { enabled: true, start: "13:00", end: "15:00" };
    expect(isInQuietHours(new Date(2026, 10, 16, 12, 59), afternoon)).toBe(false);
    expect(isInQuietHours(new Date(2026, 10, 16, 13, 30), afternoon)).toBe(true);
    expect(isInQuietHours(new Date(2026, 10, 16, 15, 0), afternoon)).toBe(false);
  });
});

describe("evaluateDueReminders", () => {
  it("fires enabled reminders within the grace window and deduplicates per slot", () => {
    const reminders = makeSettings({
      checkin: { enabled: true, time: "20:00" },
      windDown: { enabled: true, time: "22:00" },
      reviewDue: { enabled: true, time: "18:00" },
    });

    const now = new Date(2026, 10, 16, 20, 15);
    const first = evaluateDueReminders({
      reminders,
      now,
      firedSlotKeys: new Set(),
      dueReviewCount: 0,
    });

    // At 20:15: checkin (20:00) is due, windDown (22:00) is future, reviewDue has 0 due items.
    expect(first.map((r) => r.kind)).toEqual(["checkin"]);
    expect(first[0]?.slotKey).toBe("2026-11-16:checkin:20:00");

    // Same slot does not fire twice.
    const second = evaluateDueReminders({
      reminders,
      now: new Date(2026, 10, 16, 20, 45),
      firedSlotKeys: new Set([first[0]!.slotKey]),
      dueReviewCount: 0,
    });
    expect(second).toEqual([]);
  });

  it("fires reviewDue only when dueReviewCount > 0", () => {
    const reminders = makeSettings({
      reviewDue: { enabled: true, time: "18:00" },
    });
    const now = new Date(2026, 10, 16, 18, 10);

    expect(
      evaluateDueReminders({ reminders, now, firedSlotKeys: new Set(), dueReviewCount: 0 }),
    ).toEqual([]);

    const due = evaluateDueReminders({
      reminders,
      now,
      firedSlotKeys: new Set(),
      dueReviewCount: 3,
    });
    expect(due).toHaveLength(1);
    expect(due[0]?.body).toContain("3 topics");
  });

  it("handles midnight day-boundary grace window without double-firing across dates", () => {
    const reminders = makeSettings({
      windDown: { enabled: true, time: "23:50" },
    });

    // User opens app at 00:10 the next morning (20 min after 23:50 on Nov 16).
    const afterMidnight = new Date(2026, 10, 17, 0, 10);
    const dueAfterMidnight = evaluateDueReminders({
      reminders,
      now: afterMidnight,
      firedSlotKeys: new Set(),
      dueReviewCount: 0,
    });
    expect(dueAfterMidnight).toHaveLength(1);
    expect(dueAfterMidnight[0]?.scheduledDate).toBe("2026-11-16");
    expect(dueAfterMidnight[0]?.slotKey).toBe("2026-11-16:windDown:23:50");

    // If Nov 16 slot already fired at 23:55, 00:10 on Nov 17 must NOT re-fire it.
    const alreadyFired = new Set([getReminderSlotKey("windDown", "2026-11-16", "23:50")]);
    expect(
      evaluateDueReminders({
        reminders,
        now: afterMidnight,
        firedSlotKeys: alreadyFired,
        dueReviewCount: 0,
      }),
    ).toEqual([]);

    // Next night at 23:52 on Nov 17 is a fresh slot and fires normally.
    const nextNight = new Date(2026, 10, 17, 23, 52);
    const dueNextNight = evaluateDueReminders({
      reminders,
      now: nextNight,
      firedSlotKeys: alreadyFired,
      dueReviewCount: 0,
    });
    expect(dueNextNight).toHaveLength(1);
    expect(dueNextNight[0]?.scheduledDate).toBe("2026-11-17");
  });

  it("suppresses reminders during quiet hours", () => {
    const reminders = makeSettings({
      windDown: { enabled: true, time: "23:15" },
      quietHours: { enabled: true, start: "23:00", end: "07:00" },
    });

    expect(
      evaluateDueReminders({
        reminders,
        now: new Date(2026, 10, 16, 23, 20),
        firedSlotKeys: new Set(),
        dueReviewCount: 0,
      }),
    ).toEqual([]);
  });

  it("uses local calendar date rather than UTC date near midnight", () => {
    const localLate = new Date(2026, 10, 16, 23, 55, 0);
    expect(formatLocalDate(localLate)).toBe("2026-11-16");
  });
});

describe("buildRemindersIcs and normalizeReminderSettings", () => {
  it("generates recurring RFC 5545 events only for enabled reminders", () => {
    const reminders = normalizeReminderSettings({
      windDown: { enabled: true, time: "22:00" },
      checkin: { enabled: false, time: "20:00" },
      reviewDue: { enabled: true, time: "18:30" },
    });

    const ics = buildRemindersIcs(reminders, new Date(2026, 10, 16, 10, 0, 0));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("RRULE:FREQ=DAILY\r\n");
    expect(ics).toContain("DTSTART:20261116T220000\r\n");
    expect(ics).toContain("DTSTART:20261116T183000\r\n");
    expect(ics).toContain("SUMMARY:NeuroSync: Wind-down reminder\r\n");
    expect(ics).not.toContain("SUMMARY:NeuroSync: Daily check-in");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });
});
