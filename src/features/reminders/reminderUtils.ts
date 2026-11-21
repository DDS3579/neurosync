import type {
  ISODate,
  QuietHoursConfig,
  ReminderKind,
  ReminderSettings,
} from "@/types/domain";

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  windDown: { enabled: false, time: "22:00" },
  checkin: { enabled: false, time: "20:00" },
  reviewDue: { enabled: false, time: "18:00" },
  quietHours: { enabled: true, start: "23:00", end: "07:00" },
};

export const FIRED_SLOTS_STORAGE_KEY = "nx:fired-reminder-slots-v1";
export const REMINDER_WINDOW_MIN = 120;

export function normalizeReminderSettings(
  raw?: Partial<ReminderSettings> | null,
): ReminderSettings {
  return {
    windDown: {
      enabled: Boolean(raw?.windDown?.enabled),
      time: parseHHMM(raw?.windDown?.time ?? "") !== null
        ? raw!.windDown!.time
        : DEFAULT_REMINDER_SETTINGS.windDown.time,
    },
    checkin: {
      enabled: Boolean(raw?.checkin?.enabled),
      time: parseHHMM(raw?.checkin?.time ?? "") !== null
        ? raw!.checkin!.time
        : DEFAULT_REMINDER_SETTINGS.checkin.time,
    },
    reviewDue: {
      enabled: Boolean(raw?.reviewDue?.enabled),
      time: parseHHMM(raw?.reviewDue?.time ?? "") !== null
        ? raw!.reviewDue!.time
        : DEFAULT_REMINDER_SETTINGS.reviewDue.time,
    },
    quietHours: {
      enabled: raw?.quietHours?.enabled ?? DEFAULT_REMINDER_SETTINGS.quietHours.enabled,
      start: parseHHMM(raw?.quietHours?.start ?? "") !== null
        ? raw!.quietHours!.start
        : DEFAULT_REMINDER_SETTINGS.quietHours.start,
      end: parseHHMM(raw?.quietHours?.end ?? "") !== null
        ? raw!.quietHours!.end
        : DEFAULT_REMINDER_SETTINGS.quietHours.end,
    },
  };
}

/** Parses 'HH:MM' into minutes since local midnight (0..1439), or null if invalid. */
export function parseHHMM(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

/** Formats a Date's local calendar date as 'YYYY-MM-DD' without UTC shift. */
export function formatLocalDate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function previousLocalDate(date: Date): ISODate {
  const prev = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  return formatLocalDate(prev);
}

export function localMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Returns true if `now` (in local wall-clock time) falls inside quiet hours.
 * Supports both same-day spans (e.g. 13:00–15:00) and overnight wrap (e.g. 23:00–07:00).
 * Start is inclusive; end is exclusive.
 */
export function isInQuietHours(now: Date, quietHours: QuietHoursConfig): boolean {
  if (!quietHours.enabled) return false;
  const startMin = parseHHMM(quietHours.start);
  const endMin = parseHHMM(quietHours.end);
  if (startMin === null || endMin === null || startMin === endMin) return false;

  const currentMin = localMinutesOfDay(now);
  if (startMin < endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}

export function getReminderSlotKey(
  kind: ReminderKind,
  localDate: ISODate,
  time: string,
): string {
  return `${localDate}:${kind}:${time}`;
}

export interface DueReminder {
  kind: ReminderKind;
  slotKey: string;
  scheduledDate: ISODate;
  scheduledTime: string;
  title: string;
  body: string;
  href: string;
}

const REMINDER_KINDS: readonly ReminderKind[] = ["windDown", "checkin", "reviewDue"];

function buildReminderCopy(
  kind: ReminderKind,
  dueReviewCount: number,
): { title: string; body: string; href: string } {
  switch (kind) {
    case "windDown":
      return {
        title: "Time to wind down",
        body: "A gentle cue to step back from demanding work and settle into your evening.",
        href: "/habits#mind",
      };
    case "checkin":
      return {
        title: "Quick check-in, whenever you have a moment",
        body: "Note how your mood, energy, and focus feel today — skip anytime.",
        href: "/habits#checkin",
      };
    case "reviewDue":
      return {
        title: "Topics ready for a quick review",
        body: `${dueReviewCount} ${dueReviewCount === 1 ? "topic is" : "topics are"} in your review queue whenever you feel like a short recall session.`,
        href: "/focus#review",
      };
  }
}

/**
 * Evaluates which enabled reminders are due at `now` (respecting quiet hours,
 * a grace window that crosses midnight cleanly, and per-slot deduplication).
 */
export function evaluateDueReminders(params: {
  reminders: ReminderSettings;
  now: Date;
  firedSlotKeys: ReadonlySet<string>;
  dueReviewCount: number;
  windowMin?: number;
}): DueReminder[] {
  const { reminders, now, firedSlotKeys, dueReviewCount } = params;
  const windowMin = params.windowMin ?? REMINDER_WINDOW_MIN;

  if (isInQuietHours(now, reminders.quietHours)) {
    return [];
  }

  const todayISO = formatLocalDate(now);
  const yesterdayISO = previousLocalDate(now);
  const nowMin = localMinutesOfDay(now);
  const due: DueReminder[] = [];

  for (const kind of REMINDER_KINDS) {
    const slot = reminders[kind];
    if (!slot.enabled) continue;
    if (kind === "reviewDue" && dueReviewCount <= 0) continue;

    const schedMin = parseHHMM(slot.time);
    if (schedMin === null) continue;

    let scheduledDate: ISODate | null = null;
    if (nowMin >= schedMin && nowMin - schedMin <= windowMin) {
      scheduledDate = todayISO;
    } else if (nowMin < schedMin) {
      // Handle slots from late yesterday evening that are still within windowMin after midnight.
      const minsSinceYesterday = 1440 - schedMin + nowMin;
      if (minsSinceYesterday <= windowMin) {
        scheduledDate = yesterdayISO;
      }
    }

    if (!scheduledDate) continue;

    const slotKey = getReminderSlotKey(kind, scheduledDate, slot.time);
    if (firedSlotKeys.has(slotKey)) continue;

    const copy = buildReminderCopy(kind, dueReviewCount);
    due.push({
      kind,
      slotKey,
      scheduledDate,
      scheduledTime: slot.time,
      ...copy,
    });
  }

  return due;
}

const ICS_META: Record<ReminderKind, { summary: string; description: string }> = {
  windDown: {
    summary: "NeuroSync: Wind-down reminder",
    description: "Gentle cue to step away from bright work and settle into your evening.",
  },
  checkin: {
    summary: "NeuroSync: Daily check-in",
    description: "Quick 30-second mood, energy, and focus check-in in NeuroSync (skip anytime).",
  },
  reviewDue: {
    summary: "NeuroSync: Review queue check",
    description: "Check your spaced-repetition review queue in NeuroSync Focus Lab.",
  },
};

/** Floating local wall-clock stamp (no offset, no TZID) — DST-safe by construction. */
export function formatIcsLocalDateTime(date: Date, timeHHMM: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const [hh = "20", mm = "00"] = timeHHMM.split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

export function formatIcsUtcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

/**
 * Generates an RFC 5545 recurring daily `.ics` calendar file for enabled reminders.
 * Uses floating local time (no TZID server dependency) so alerts follow local wall-clock time.
 */
export function buildRemindersIcs(
  reminders: ReminderSettings,
  now: Date = new Date(),
): string {
  const dtStamp = formatIcsUtcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NeuroSync//Local Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const kind of REMINDER_KINDS) {
    const slot = reminders[kind];
    if (!slot.enabled || parseHHMM(slot.time) === null) continue;
    const meta = ICS_META[kind];
    const dtStart = formatIcsLocalDateTime(now, slot.time);

    lines.push(
      "BEGIN:VEVENT",
      `UID:neurosync-${kind}@local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      "DURATION:PT10M",
      "RRULE:FREQ=DAILY",
      `SUMMARY:${meta.summary}`,
      `DESCRIPTION:${meta.description}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT0M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${meta.summary}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function readFiredSlotKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FIRED_SLOTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

export function writeFiredSlotKeys(keys: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only the most recent 60 fired slot keys so localStorage stays compact.
    const trimmed = [...keys].slice(-60);
    window.localStorage.setItem(FIRED_SLOTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors.
  }
}
