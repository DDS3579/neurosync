import {
  daysBetweenISO,
  isValidISODate,
  minutesToClock,
  shiftISODate,
  toISODate,
} from "@/features/planner/dayContext";
import type { ISODate } from "@/types/domain";
import type { BusyInterval, CalendarDateRange } from "./types";

export interface ParseIcsSkipped {
  allDay: number;
  transparent: number;
  cancelled: number;
  unsupportedRecurrence: number;
  invalid: number;
  outOfRange: number;
}

export interface ParseIcsResult {
  intervals: BusyInterval[];
  skipped: ParseIcsSkipped;
  notes: string[];
}

interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Unfolds RFC 5545 continuation lines and normalises CRLF/CR to LF. */
export function unfoldIcsLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line.trim().length > 0) {
      out.push(line);
    }
  }
  return out;
}

function parseProp(line: string): IcsProp | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = parts[0]!.trim().toUpperCase();
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      params[part.slice(0, eq).trim().toUpperCase()] = part
        .slice(eq + 1)
        .trim()
        .replace(/^"|"$/g, "");
    }
  }
  return { name, params, value };
}

export function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

interface IcsDateTime {
  date: ISODate;
  minuteOfDay: number;
  allDay: boolean;
}

function parseIcsDateTime(prop: IcsProp): IcsDateTime | null {
  const value = prop.value.trim();
  if (prop.params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(value)) {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return isValidISODate(date) ? { date, minuteOfDay: 0, allDay: true } : null;
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm, , z] = match;
  if (z === "Z") {
    // A UTC stamp is an absolute instant: convert it into this device's local time.
    const instant = new Date(
      Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0),
    );
    if (Number.isNaN(instant.getTime())) return null;
    return {
      date: toISODate(instant),
      minuteOfDay: instant.getHours() * 60 + instant.getMinutes(),
      allDay: false,
    };
  }
  const date = `${y}-${m}-${d}`;
  const minuteOfDay = Number(hh) * 60 + Number(mm);
  if (!isValidISODate(date) || minuteOfDay > 1439) return null;
  return { date, minuteOfDay, allDay: false };
}

/** ISO 8601 duration → whole minutes. Supports PnW / PnD / PTnHnMnS. */
export function parseIcsDurationMinutes(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const weeks = Number(match[2] ?? 0);
  const days = Number(match[3] ?? 0);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  const total = weeks * 10080 + days * 1440 + hours * 60 + minutes + Math.round(seconds / 60);
  if (!Number.isFinite(total) || total <= 0) return null;
  return sign * total;
}

function parseRRule(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return out;
}

/**
 * Local-file parsing only — no network, no timezone database.
 *
 * `TZID` is read as wall-clock time (documented limitation, surfaced as a note).
 * All-day and TRANSPARENT events are skipped so they never become busy time,
 * which also means re-importing a NeuroSync export produces zero busy intervals.
 * `FREQ=DAILY` is expanded inside the range; other recurrence rules are reported
 * as skipped rather than silently guessed.
 */
export function parseIcsBusyIntervals(
  text: string,
  range: CalendarDateRange,
): ParseIcsResult {
  const skipped: ParseIcsSkipped = {
    allDay: 0,
    transparent: 0,
    cancelled: 0,
    unsupportedRecurrence: 0,
    invalid: 0,
    outOfRange: 0,
  };
  const notes = new Set<string>();
  const intervals: BusyInterval[] = [];

  if (!isValidISODate(range.start) || !isValidISODate(range.end) || range.end < range.start) {
    return { intervals, skipped, notes: ["Choose a valid date range first."] };
  }

  const lines = unfoldIcsLines(text);
  let event: IcsProp[] | null = null;
  let index = 0;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      event = [];
      continue;
    }
    if (upper === "END:VEVENT") {
      const props = event ?? [];
      event = null;
      index += 1;
      const get = (name: string): IcsProp | undefined =>
        props.find((prop) => prop.name === name);

      const dtStart = get("DTSTART");
      if (!dtStart) {
        skipped.invalid += 1;
        continue;
      }
      const start = parseIcsDateTime(dtStart);
      if (!start) {
        skipped.invalid += 1;
        continue;
      }
      if (start.allDay) {
        skipped.allDay += 1;
        continue;
      }
      if (get("TRANSP")?.value.trim().toUpperCase() === "TRANSPARENT") {
        skipped.transparent += 1;
        continue;
      }
      if (get("STATUS")?.value.trim().toUpperCase() === "CANCELLED") {
        skipped.cancelled += 1;
        continue;
      }
      if (dtStart.params.TZID) {
        notes.add(
          "Some events carried a TZID. Without a timezone database this app reads them as local wall-clock times, so an event from another timezone may land at the wrong hour.",
        );
      }

      let durationMin: number | null = null;
      const dtEnd = get("DTEND");
      if (dtEnd) {
        const end = parseIcsDateTime(dtEnd);
        if (!end || end.allDay) {
          skipped.invalid += 1;
          continue;
        }
        durationMin =
          daysBetweenISO(start.date, end.date) * 1440 + end.minuteOfDay - start.minuteOfDay;
      } else {
        const duration = get("DURATION");
        durationMin = duration ? parseIcsDurationMinutes(duration.value) : null;
      }
      if (durationMin === null || durationMin <= 0 || durationMin >= 1440) {
        skipped.invalid += 1;
        continue;
      }

      const rruleProp = get("RRULE");
      const rrule = rruleProp ? parseRRule(rruleProp.value) : null;
      const freq = rrule?.FREQ?.toUpperCase();
      if (freq && freq !== "DAILY") {
        skipped.unsupportedRecurrence += 1;
        notes.add(
          "Only daily repeating events are expanded. Weekly, monthly and yearly rules were skipped rather than guessed.",
        );
        continue;
      }

      const interval = Math.max(1, Number(rrule?.INTERVAL ?? 1) || 1);
      const count = rrule?.COUNT ? Math.max(1, Number(rrule.COUNT) || 1) : null;
      const untilRaw = rrule?.UNTIL ? parseIcsDateTime({ name: "UNTIL", params: {}, value: rrule.UNTIL }) : null;
      const until = untilRaw?.date ?? null;
      const uid = get("UID")?.value.trim() || `event-${index}`;
      const title = unescapeIcsText(get("SUMMARY")?.value ?? "Busy").trim() || "Busy";

      let cursor = start.date;
      let emitted = 0;
      let guard = 0;
      while (guard < 4000) {
        guard += 1;
        if (until && cursor > until) break;
        if (cursor > range.end) break;
        if (count !== null && emitted >= count) break;
        if (cursor >= range.start) {
          const endMin = start.minuteOfDay + durationMin;
          intervals.push({
            id: `${uid}:${cursor}`,
            title,
            date: cursor,
            startTime: minutesToClock(start.minuteOfDay),
            endTime: minutesToClock(endMin),
            readOnly: true,
            source: "imported-ics",
          });
        } else {
          skipped.outOfRange += 1;
        }
        emitted += 1;
        if (!rrule) break;
        cursor = shiftISODate(cursor, interval);
      }
      continue;
    }
    if (event) {
      const prop = parseProp(line);
      if (prop) event.push(prop);
    }
  }

  intervals.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.id.localeCompare(b.id),
  );

  if (skipped.allDay > 0) {
    notes.add(
      `${skipped.allDay} all-day ${skipped.allDay === 1 ? "entry was" : "entries were"} skipped — they do not block a time window.`,
    );
  }
  if (skipped.transparent > 0) {
    notes.add(
      `${skipped.transparent} ${skipped.transparent === 1 ? "entry marked free was" : "entries marked free were"} skipped.`,
    );
  }
  if (intervals.length === 0) {
    notes.add("No timed busy events were found inside that range.");
  }

  return { intervals, skipped, notes: [...notes] };
}
