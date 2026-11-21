import type { BlockStatus, ISODate, TaskKind } from "@/types/domain";

export interface CalendarDateRange {
  start: ISODate;
  end: ISODate;
}

/** A read-only busy window in local wall-clock terms. endTime may wrap past midnight. */
export interface BusyInterval {
  id: string;
  title: string;
  date: ISODate;
  startTime: string;
  endTime: string;
  readOnly: boolean;
  source: string;
}

export interface ExportableBlock {
  id: string;
  title: string;
  date: ISODate;
  startTime?: string;
  plannedMin: number;
  kind: TaskKind;
  projectName?: string;
  notes?: string;
  status?: BlockStatus;
}

export interface CalendarExport {
  filename: string;
  mimeType: string;
  content: string;
  notes: string[];
}

/**
 * The boundary a future Google provider plugs into. The planner never talks to a
 * calendar SDK directly: it asks providers for busy intervals and hands them to
 * `generateDayPlan` as fixed commitments.
 */
export interface CalendarProvider {
  readonly id: string;
  readonly name: string;
  getBusyIntervals(range: CalendarDateRange): Promise<BusyInterval[]>;
  exportBlocks(blocks: readonly ExportableBlock[]): Promise<CalendarExport>;
}
