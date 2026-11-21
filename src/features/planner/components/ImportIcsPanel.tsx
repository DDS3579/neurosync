"use client";

import { useRef, useState } from "react";
import { Info, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { busyRangeLabel, parseIcsBusyIntervals } from "@/features/calendar";
import type { BusyInterval } from "@/features/calendar";
import { formatDayLabel, shiftISODate } from "@/features/planner/dayContext";
import type { ISODate } from "@/types/domain";

export interface ImportIcsPanelProps {
  todayISO: ISODate;
  intervals: readonly BusyInterval[];
  onIntervalsChange: (intervals: BusyInterval[]) => void;
}

export function ImportIcsPanel({ todayISO, intervals, onIntervalsChange }: ImportIcsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState<ISODate>(todayISO);
  const [end, setEnd] = useState<ISODate>(shiftISODate(todayISO, 6));
  const [notes, setNotes] = useState<string[]>([]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = parseIcsBusyIntervals(text, { start, end });
    onIntervalsChange(result.intervals);
    setNotes(result.notes);
    toast.success(
      `Read ${result.intervals.length} busy ${result.intervals.length === 1 ? "window" : "windows"} from ${file.name}.`,
    );
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section aria-labelledby="import-ics-heading" className="space-y-2.5 rounded-card border border-border bg-surface p-4">
      <h2 id="import-ics-heading" className="text-section font-medium text-foreground">
        Import a calendar file (read-only)
      </h2>
      <p className="text-caption text-muted-foreground">
        Parse an <span className="font-mono">.ics</span> file you already have into busy windows for{" "}
        {busyRangeLabel({ start, end })}. They feed the day planner as fixed commitments. Parsed locally, loaded for this
        visit only — nothing is saved and nothing is uploaded.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="ics-range-start" className="text-caption text-muted-foreground">From</Label>
          <Input id="ics-range-start" type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="h-8 w-40 rounded-control border-border bg-surface-2 font-mono text-caption" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ics-range-end" className="text-caption text-muted-foreground">To</Label>
          <Input id="ics-range-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="h-8 w-40 rounded-control border-border bg-surface-2 font-mono text-caption" />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5 rounded-control">
          <Upload className="size-3.5" aria-hidden />
          Choose .ics
        </Button>
        {intervals.length > 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => { onIntervalsChange([]); setNotes([]); }}
            className="gap-1.5 rounded-control text-caption text-muted-foreground">
            <X className="size-3.5" aria-hidden />
            Clear
          </Button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          aria-label="Choose a calendar file to import"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      {intervals.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-control border border-border bg-surface-2 px-3 py-2 text-caption">
          {intervals.slice(0, 40).map((interval) => (
            <li key={interval.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-cyan tabular-nums">
                {formatDayLabel(interval.date)} {interval.startTime}–{interval.endTime}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{interval.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">read-only</span>
            </li>
          ))}
        </ul>
      ) : null}

      {notes.length > 0 ? (
        <div className="flex items-start gap-2 text-caption text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-cyan" aria-hidden />
          <ul className="space-y-0.5">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
