import { getDayPlanByDate } from "@/lib/db/repositories";
import { isoDatesInRange } from "@/features/planner/dayContext";
import { buildBlocksIcs, ICS_MIME_TYPE } from "./ics";
import type {
  BusyInterval,
  CalendarDateRange,
  CalendarExport,
  CalendarProvider,
  ExportableBlock,
} from "./types";

/**
 * The canonical local read/write path. A future Google provider implements the
 * same interface; nothing in the planner engine changes.
 */
export class LocalIcsProvider implements CalendarProvider {
  readonly id = "local-ics";
  readonly name = "This browser (.ics file)";

  async getBusyIntervals(range: CalendarDateRange): Promise<BusyInterval[]> {
    const out: BusyInterval[] = [];
    for (const date of isoDatesInRange(range.start, range.end, 62)) {
      const plan = await getDayPlanByDate(date);
      if (!plan) continue;
      for (const commitment of plan.commitments) {
        out.push({
          id: `planner:${plan.id}:${commitment.id}`,
          title: commitment.title,
          date,
          startTime: commitment.startTime,
          endTime: commitment.endTime,
          readOnly: false,
          source: "planner",
        });
      }
    }
    return out;
  }

  async exportBlocks(blocks: readonly ExportableBlock[]): Promise<CalendarExport> {
    const result = buildBlocksIcs(blocks);
    return {
      filename: result.filename,
      mimeType: ICS_MIME_TYPE,
      content: result.content,
      notes: result.notes,
    };
  }
}

export const CALENDAR_PROVIDER_DIRECTORY: ReadonlyArray<{
  id: string;
  name: string;
  status: "available" | "planned";
  detail: string;
}> = [
  {
    id: "local-ics",
    name: "This browser (.ics file)",
    status: "available",
    detail:
      "Exports your planned blocks as a calendar file and reads your planner commitments as busy time. Nothing leaves this device.",
  },
  {
    id: "imported-ics",
    name: "Imported .ics (read-only)",
    status: "available",
    detail:
      "Parse a calendar file you already have into read-only busy windows for a date range. Loaded for this visit only — nothing is saved.",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    status: "planned",
    detail:
      "Planned for a later release, after accounts and end-to-end-encrypted sync. No network requests are made today.",
  },
];
