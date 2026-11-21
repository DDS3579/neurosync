"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Moon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDayLabel, formatMinutes } from "@/features/planner/dayContext";
import { buildPlannedActualReport, collectBlockSamples } from "@/features/planner/review/plannedVsActual";
import { SHUTDOWN_REFLECTION_MAX, closeDay } from "@/features/planner/services/blockActions";
import { cn } from "@/lib/utils";
import type { Block, ISODate, Task } from "@/types/domain";

type CloseAction = "tomorrow" | "tray" | "skip";

const ACTIONS: ReadonlyArray<{ value: CloseAction; label: string }> = [
  { value: "tomorrow", label: "Roll to tomorrow" },
  { value: "tray", label: "Back to tray" },
  { value: "skip", label: "Skip" },
];

export interface ShutdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: ISODate;
  blocks: readonly Block[];
  tasks: readonly Task[];
  reflection?: string;
  alreadyClosed?: boolean;
  onCompleted?: () => void;
}

export function ShutdownDialog({
  open,
  onOpenChange,
  date,
  blocks,
  tasks,
  reflection,
  alreadyClosed = false,
  onCompleted,
}: ShutdownDialogProps) {
  const isMobile = useIsMobile();
  const [choices, setChoices] = useState<Record<string, CloseAction>>({});
  const [note, setNote] = useState(reflection ?? "");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // The dialog is opened from state (and from a #shutdown deep link), so it has
  // no Radix trigger to restore focus to; remember what was focused instead.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) returnFocusRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const handleCloseAutoFocus = (event: Event) => {
    const target = returnFocusRef.current;
    if (target && target.isConnected) {
      event.preventDefault();
      target.focus();
    }
  };

  // Reset per-open state during render (React's "adjust state when props change"
  // pattern) instead of an effect, so opening never triggers a cascading render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setChoices({});
      setNote(reflection ?? "");
    }
  }

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const dayBlocks = useMemo(() => blocks.filter((b) => b.plannedDate === date), [blocks, date]);
  const unfinished = useMemo(
    () =>
      dayBlocks
        .filter((b) => b.status === "todo" || b.status === "scheduled")
        .sort((a, b) => (a.plannedStart ?? "99:99").localeCompare(b.plannedStart ?? "99:99") || a.order - b.order),
    [dayBlocks],
  );
  const report = useMemo(
    () => buildPlannedActualReport(collectBlockSamples(dayBlocks, tasks)),
    [dayBlocks, tasks],
  );

  const complete = async () => {
    setBusy(true);
    try {
      const entries = unfinished.map((block) => ({
        blockId: block.id,
        action: choices[block.id] ?? ("tomorrow" as CloseAction),
      }));
      await closeDay(date, entries, note);
      const message = `Day closed. ${entries.length} ${entries.length === 1 ? "block was" : "blocks were"} moved on. Nothing was deleted.`;
      setAnnouncement(message);
      toast.success(message);
      onCompleted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close the day.");
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Finished", value: `${report.doneBlocks}/${report.doneBlocks + report.openBlocks}` },
          { label: "Still open", value: String(report.openBlocks) },
          { label: "Planned", value: formatMinutes(report.plannedMin) },
          { label: "Logged", value: formatMinutes(report.actualTotalMin) },
        ].map((tile) => (
          <div key={tile.label} className="rounded-control border border-border bg-surface-2 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tile.label}</p>
            <p className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>
      <p className="text-caption text-muted-foreground">{report.summaryLine}</p>

      {unfinished.length > 0 ? (
        <section aria-labelledby="shutdown-open-heading" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="shutdown-open-heading" className="text-section font-medium text-foreground">
              Still open ({unfinished.length})
            </h3>
            <div role="group" aria-label="Apply to all" className="flex flex-wrap gap-1.5">
              {ACTIONS.map((action) => (
                <Button
                  key={action.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setChoices(Object.fromEntries(unfinished.map((b) => [b.id, action.value])))
                  }
                  className="h-7 rounded-control px-2 text-caption"
                >
                  All: {action.label}
                </Button>
              ))}
            </div>
          </div>
          <ul className="max-h-[32svh] space-y-2 overflow-y-auto pr-1">
            {unfinished.map((block) => {
              const current = choices[block.id] ?? "tomorrow";
              const title = taskById.get(block.taskId)?.title ?? "Untitled task";
              return (
                <li key={block.id} className="space-y-2 rounded-control border border-border bg-surface-2 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {block.plannedStart ? `${block.plannedStart} · ` : ""}
                      {formatMinutes(block.plannedMin)}
                    </span>
                  </div>
                  <div role="radiogroup" aria-label={`What to do with ${title}`} className="flex flex-wrap gap-1.5">
                    {ACTIONS.map((action) => (
                      <button
                        key={action.value}
                        type="button"
                        role="radio"
                        aria-checked={current === action.value}
                        onClick={() => setChoices((prev) => ({ ...prev, [block.id]: action.value }))}
                        className={cn(
                          "min-h-8 rounded-chip border px-2.5 py-1 text-caption transition-colors",
                          current === action.value
                            ? "border-violet bg-violet/15 text-foreground"
                            : "border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="rounded-control border border-dashed border-border px-3 py-3 text-caption text-muted-foreground">
          Nothing is left open for this day.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="shutdown-reflection">One line about today (optional)</Label>
        <Textarea
          id="shutdown-reflection"
          rows={2}
          maxLength={SHUTDOWN_REFLECTION_MAX}
          value={note}
          placeholder="Anything worth remembering. Stays in this browser."
          onChange={(event) => setNote(event.target.value.replace(/\n/g, " "))}
          className="rounded-control border-border bg-surface-2 text-body"
        />
        <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {note.length}/{SHUTDOWN_REFLECTION_MAX}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-control text-caption text-muted-foreground">
          Skip for now
        </Button>
        <Button type="button" disabled={busy} onClick={() => void complete()} className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90">
          {alreadyClosed ? <Check className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
          {busy ? "Closing…" : alreadyClosed ? "Update closed day" : "Complete shutdown"}
        </Button>
      </div>
    </div>
  );

  const title = `Shutdown · ${formatDayLabel(date)}`;
  const description = "Optional and skippable. Nothing is deleted, and there is nothing you have to keep up.";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          onCloseAutoFocus={handleCloseAutoFocus}
          className="max-h-[90svh] overflow-y-auto rounded-t-card border-border bg-surface pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-section font-medium">{title}</SheetTitle>
            <SheetDescription className="text-caption text-muted-foreground">{description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={handleCloseAutoFocus}
        className="max-h-[88svh] overflow-y-auto border-border bg-surface sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="text-section font-medium">{title}</DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="sr-only">
          <span>Use the buttons above to close or skip.</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
