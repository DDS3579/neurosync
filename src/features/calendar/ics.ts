import { addDays, format } from "date-fns";
import {
  formatIcsLocalDateTime,
  formatIcsUtcStamp,
  parseHHMM,
} from "@/features/reminders/reminderUtils";
import {
  isValidISODate,
  localDateFromISO,
  minutesToClock,
} from "@/features/planner/dayContext";
import { REVIEW_KIND_LABEL } from "@/features/planner/review/plannedVsActual";
import type { ExportableBlock } from "./types";

export const ICS_MIME_TYPE = "text/calendar;charset=utf-8";

/** RFC 5545 TEXT escaping. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds at 75 octets without splitting a multi-byte character. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const segments: string[] = [];
  let current = "";
  let bytes = 0;
  let first = true;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = first ? 75 : 74; // continuation lines carry one leading space
    if (bytes + size > limit) {
      segments.push(first ? current : ` ${current}`);
      first = false;
      current = ch;
      bytes = size;
    } else {
      current += ch;
      bytes += size;
    }
  }
  segments.push(first ? current : ` ${current}`);
  return segments.join("\r\n");
}

export function icsDocument(lines: readonly string[]): string {
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export interface BuildBlocksIcsOptions {
  now?: Date;
  /** Default "all-day": untimed blocks stay visible but never block busy time. */
  untimed?: "all-day" | "omit";
  includeFinished?: boolean;
  calendarName?: string;
}

export interface BlocksIcsResult {
  content: string;
  filename: string;
  timedEvents: number;
  allDayEvents: number;
  omitted: number;
  notes: string[];
}

const compactDate = (date: Date): string => format(date, "yyyyMMdd");

/**
 * One VEVENT per planned block.
 *
 * DST handling: every stamp is floating local wall-clock time built from calendar
 * parts — never an epoch offset. A 50-minute block at 09:00 stays 09:00–09:50 on a
 * spring-forward or fall-back day, and day arithmetic uses calendar `addDays`, so
 * no date is skipped or duplicated.
 */
export function buildBlocksIcs(
  blocks: readonly ExportableBlock[],
  options: BuildBlocksIcsOptions = {},
): BlocksIcsResult {
  const now = options.now ?? new Date();
  const untimed = options.untimed ?? "all-day";
  const includeFinished = options.includeFinished === true;
  const dtStamp = formatIcsUtcStamp(now);
  const notes: string[] = [];

  let omitted = 0;
  const usable: ExportableBlock[] = [];
  for (const block of blocks) {
    if (!isValidISODate(block.date)) {
      omitted += 1;
      continue;
    }
    if (!includeFinished && (block.status === "done" || block.status === "skipped")) {
      omitted += 1;
      continue;
    }
    if (!block.startTime && untimed === "omit") {
      omitted += 1;
      continue;
    }
    usable.push(block);
  }

  usable.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") ||
      a.id.localeCompare(b.id),
  );

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NeuroSync//Block Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName ?? "NeuroSync plan")}`,
  ];

  let timedEvents = 0;
  let allDayEvents = 0;

  for (const block of usable) {
    const dayDate = localDateFromISO(block.date);
    const minutes = Math.max(1, Math.round(block.plannedMin));
    // Project comes first so line folding (75 octets) can never split the label.
    const description = [
      block.projectName ? `Project: ${block.projectName}` : "Project: none",
      `NeuroSync block · ${REVIEW_KIND_LABEL[block.kind]}`,
      `Planned length: ${minutes} minutes`,
      block.startTime ? "Placed on the planner timeline." : "No fixed time — planned for this day.",
      block.notes ? `Notes: ${block.notes}` : "",
      "Educational planning entry, not a measurement.",
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:neurosync-block-${block.id}@local`,
      `DTSTAMP:${dtStamp}`,
    );

    const startMin = block.startTime ? parseHHMM(block.startTime) : null;
    if (startMin !== null) {
      const endMin = startMin + minutes;
      const endDate = addDays(dayDate, Math.floor(endMin / 1440));
      lines.push(
        `DTSTART:${formatIcsLocalDateTime(dayDate, minutesToClock(startMin))}`,
        `DTEND:${formatIcsLocalDateTime(endDate, minutesToClock(endMin))}`,
        "TRANSP:OPAQUE",
      );
      timedEvents += 1;
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(dayDate)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(dayDate, 1))}`,
        "TRANSP:TRANSPARENT",
      );
      allDayEvents += 1;
    }

    lines.push(
      `SUMMARY:${escapeIcsText(block.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `CATEGORIES:${escapeIcsText(`NeuroSync,${REVIEW_KIND_LABEL[block.kind]}`)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  notes.push(
    "Times are floating local wall-clock time (no offset, no TZID), so each block keeps its clock time wherever the calendar is opened, including across daylight-saving changes.",
  );
  if (allDayEvents > 0) {
    notes.push(
      `${allDayEvents} ${allDayEvents === 1 ? "block" : "blocks"} without a start time were exported as all-day entries marked free (TRANSP:TRANSPARENT), so they never block busy time.`,
    );
  }
  if (omitted > 0) {
    notes.push(
      `${omitted} ${omitted === 1 ? "block was" : "blocks were"} left out (already finished, skipped, undated${
        untimed === "omit" ? ", or without a start time" : ""
      }).`,
    );
  }
  if (usable.length === 0) {
    notes.push("Nothing to export yet — place a block on a day first.");
  }

  const first = usable[0]?.date;
  const last = usable[usable.length - 1]?.date;
  const filename = first
    ? `neurosync-plan-${first}${last && last !== first ? `-to-${last}` : ""}.ics`
    : "neurosync-plan.ics";

  return { content: icsDocument(lines), filename, timedEvents, allDayEvents, omitted, notes };
}
