import { buildBlocksIcs, ICS_MIME_TYPE } from "./ics";
import { busyDurationMin, filterBusyRange } from "./busy";
import type {
  BusyInterval,
  CalendarDateRange,
  CalendarExport,
  CalendarProvider,
  ExportableBlock,
} from "./types";

/** Pure in-memory provider: used for imported .ics data and for tests. */
export function createStaticCalendarProvider(params: {
  id: string;
  name: string;
  intervals: readonly BusyInterval[];
  readOnly?: boolean;
}): CalendarProvider {
  const readOnly = params.readOnly !== false;
  return {
    id: params.id,
    name: params.name,
    async getBusyIntervals(range: CalendarDateRange): Promise<BusyInterval[]> {
      return filterBusyRange(params.intervals, range).map((interval) => ({
        ...interval,
        readOnly,
      }));
    },
    async exportBlocks(blocks: readonly ExportableBlock[]): Promise<CalendarExport> {
      const result = buildBlocksIcs(blocks);
      return {
        filename: result.filename,
        mimeType: ICS_MIME_TYPE,
        content: result.content,
        notes: result.notes,
      };
    },
  };
}

/** Turns busy intervals back into exportable blocks (round-trip helper). */
export function busyIntervalsToExportable(
  intervals: readonly BusyInterval[],
): ExportableBlock[] {
  return intervals.map((interval) => ({
    id: interval.id,
    title: interval.title,
    date: interval.date,
    startTime: interval.startTime,
    plannedMin: Math.max(1, busyDurationMin(interval)),
    kind: "shallow",
  }));
}

export function createCompositeCalendarProvider(
  providers: readonly CalendarProvider[],
): CalendarProvider {
  const primary = providers[0];
  return {
    id: "composite",
    name: "All local calendars",
    async getBusyIntervals(range) {
      const lists = await Promise.all(providers.map((p) => p.getBusyIntervals(range)));
      const seen = new Map<string, BusyInterval>();
      for (const list of lists) {
        for (const interval of list) {
          const key = `${interval.date}|${interval.startTime}|${interval.endTime}|${interval.title}`;
          if (!seen.has(key)) seen.set(key, interval);
        }
      }
      return [...seen.values()].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime) ||
          a.id.localeCompare(b.id),
      );
    },
    async exportBlocks(blocks) {
      if (!primary) {
        return {
          filename: "neurosync-plan.ics",
          mimeType: ICS_MIME_TYPE,
          content: buildBlocksIcs(blocks).content,
          notes: ["No calendar provider is configured; exported a plain local file."],
        };
      }
      return primary.exportBlocks(blocks);
    },
  };
}
