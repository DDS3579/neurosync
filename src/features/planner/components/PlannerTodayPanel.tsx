"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarClock, Check, ChevronLeft, ChevronRight, CircleDashed, ListChecks, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capacity, splitIntoBlocks } from "@/features/planner/blocks";
import {
  dayConstraintsFor,
  formatDayLabel,
  formatMinutes,
  plannedMinutes,
  shiftISODate,
} from "@/features/planner/dayContext";
import { PLANNER_ADD_TASK_EVENT } from "@/features/planner/plannerEvents";
import {
  addBlockToDay,
  blockFocusHref,
  completeBlock,
  placeBlockAt,
  returnBlockToTray,
  skipBlock,
} from "@/features/planner/services/blockActions";
import { blockRepository, taskRepository } from "@/lib/db/repositories";
import { cn } from "@/lib/utils";
import type { Block, DayPlan, ISODate, Project, Task, TaskKind, UserSettings } from "@/types/domain";

const KIND_STYLE: Record<TaskKind, { label: string; glyph: string; badge: string; rail: string }> = {
  deep: { label: "Deep", glyph: "◆", badge: "border-violet/50 bg-violet/20 text-violet-text", rail: "bg-violet/70" },
  shallow: { label: "Shallow", glyph: "▤", badge: "border-cyan/45 bg-cyan/15 text-cyan", rail: "bg-cyan/70" },
  recovery: { label: "Recovery", glyph: "○", badge: "border-success/45 bg-success/15 text-success", rail: "bg-success/70" },
};

export interface PlannerTodayPanelProps {
  date: ISODate;
  todayISO: ISODate;
  onChangeDate: (date: ISODate) => void;
  blocks: readonly Block[];
  tasks: readonly Task[];
  projects: readonly Project[];
  settings: UserSettings;
  plan?: DayPlan;
}

export function PlannerTodayPanel({
  date,
  todayISO,
  onChangeDate,
  blocks,
  tasks,
  projects,
  settings,
  plan,
}: PlannerTodayPanelProps) {
  const router = useRouter();
  const captureRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("deep");
  const [estimateMin, setEstimateMin] = useState(settings.defaultBlockMin ?? 50);
  const [split, setSplit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [clocks, setClocks] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const focus = () => captureRef.current?.focus();
    window.addEventListener(PLANNER_ADD_TASK_EVENT, focus);
    return () => window.removeEventListener(PLANNER_ADD_TASK_EVENT, focus);
  }, []);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const constraints = useMemo(
    () =>
      dayConstraintsFor(date, plan, {
        sleepTargetMin: settings.sleepTargetMin,
        deepWorkCapMin: settings.deepWorkCapMin,
        snapMin: settings.snapMin,
      }),
    [date, plan, settings.sleepTargetMin, settings.deepWorkCapMin, settings.snapMin],
  );

  const dayBlocks = useMemo(() => blocks.filter((b) => b.plannedDate === date), [blocks, date]);
  const scheduled = useMemo(
    () =>
      dayBlocks
        .filter((b) => Boolean(b.plannedStart))
        .sort((a, b) => (a.plannedStart ?? "").localeCompare(b.plannedStart ?? "")),
    [dayBlocks],
  );
  const listed = useMemo(
    () => dayBlocks.filter((b) => !b.plannedStart && b.status === "todo").sort((a, b) => a.order - b.order),
    [dayBlocks],
  );
  const settled = useMemo(
    () => dayBlocks.filter((b) => !b.plannedStart && b.status !== "todo").sort((a, b) => a.order - b.order),
    [dayBlocks],
  );
  const tray = useMemo(
    () =>
      blocks
        .filter((b) => !b.plannedDate && !b.plannedStart && b.status === "todo")
        .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    [blocks],
  );

  const summary = useMemo(
    () =>
      capacity({
        wakeTime: constraints.wakeTime,
        sleepTargetMin: constraints.sleepTargetMin,
        windDownMin: constraints.windDownMin,
        commitments: constraints.commitments ?? [],
        blocks: dayBlocks.map((b) => ({
          kind: taskById.get(b.taskId)?.kind ?? "shallow",
          plannedMin: b.plannedMin,
          status: b.status,
        })),
        deepWorkCapMin: settings.deepWorkCapMin,
      }),
    [constraints, dayBlocks, taskById, settings.deepWorkCapMin],
  );
  const planned = plannedMinutes(dayBlocks);
  const overBy = Math.max(0, planned - summary.availableMin);

  const run = useCallback(async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      setAnnouncement(message);
      toast.success(message);
    } catch (error) {
      const text = error instanceof Error ? error.message : "That change could not be saved.";
      setAnnouncement(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAddTask = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Give the task a title first.");
      return;
    }
    const estimate = Math.max(5, Math.min(1440, Math.round(estimateMin) || 50));
    setBusy(true);
    try {
      const task = await taskRepository.create({
        title: trimmed,
        kind,
        estimateMin: estimate,
        status: "active",
      });
      const parts = split ? splitIntoBlocks(estimate, settings.defaultBlockMin ?? 50) : [estimate];
      await blockRepository.bulkCreate(
        parts.map((plannedMin, index) => ({
          taskId: task.id,
          order: index,
          plannedMin,
          status: "todo" as const,
        })),
      );
      setTitle("");
      const message = `Added "${trimmed}" with ${parts.length} ${parts.length === 1 ? "block" : "blocks"} in the tray.`;
      setAnnouncement(message);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that task.");
    } finally {
      setBusy(false);
    }
  };

  const renderBlock = (block: Block, context: "timeline" | "list" | "tray") => {
    const task = taskById.get(block.taskId);
    const project = task?.projectId ? projectById.get(task.projectId) : undefined;
    const style = KIND_STYLE[task?.kind ?? "shallow"];
    const blockTitle = task?.title ?? "Untitled task";
    const finished = block.status === "done" || block.status === "skipped";
    const timeId = `block-clock-${block.id}`;
    return (
      <li
        key={block.id}
        className="relative overflow-hidden rounded-card border border-border bg-surface p-3"
      >
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", style.rail)} />
        <div className="flex flex-wrap items-center gap-2 pl-1.5">
          {!finished ? (
            <input
              type="checkbox"
              checked={false}
              aria-label={`Mark ${blockTitle} done`}
              onChange={() => void run(() => completeBlock(block.id), `${blockTitle} marked done.`)}
              className="size-4 shrink-0 accent-cyan"
            />
          ) : null}
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full border border-white/25"
            style={{ backgroundColor: project?.color ?? "rgba(255,255,255,0.2)" }}
          />
          <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{blockTitle}</span>
          <span className={cn("shrink-0 rounded-chip border px-1.5 py-0.5 font-mono text-[10px]", style.badge)}>
            <span aria-hidden className="mr-0.5">{style.glyph}</span>
            {style.label}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
            {block.plannedStart ? `${block.plannedStart} · ` : ""}
            {formatMinutes(block.plannedMin)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-1.5">
          {finished ? (
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {block.status === "done"
                ? `Done · ${formatMinutes(block.actualMin ?? block.plannedMin)}`
                : "Skipped for this day"}
            </span>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => task && router.push(blockFocusHref(block, task))}
                aria-label={`Start ${blockTitle} in the Focus Lab`}
                className="h-7 gap-1 rounded-control bg-violet px-2 text-caption text-white hover:bg-violet/90"
              >
                <Play className="size-3" aria-hidden />
                Start
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Skip ${blockTitle}`}
                onClick={() => void run(() => skipBlock(block.id), `${blockTitle} skipped for this day.`)}
                className="h-7 gap-1 rounded-control px-2 text-caption text-muted-foreground"
              >
                <CircleDashed className="size-3" aria-hidden />
                Skip
              </Button>
              {context !== "timeline" ? (
                <div className="flex items-end gap-1">
                  <Label htmlFor={timeId} className="sr-only">
                    Start time for {blockTitle}
                  </Label>
                  <Input
                    id={timeId}
                    type="time"
                    step={(settings.snapMin ?? 15) * 60}
                    value={clocks[block.id] ?? block.plannedStart ?? ""}
                    onChange={(event) =>
                      setClocks((prev) => ({ ...prev, [block.id]: event.target.value }))
                    }
                    className="h-7 w-24 rounded-control border-border bg-surface-2 font-mono text-[11px] tabular-nums"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !(clocks[block.id] ?? block.plannedStart)}
                    onClick={() =>
                      void run(
                        () => placeBlockAt(block.id, date, clocks[block.id] ?? block.plannedStart!, settings, plan),
                        `${blockTitle} placed at ${clocks[block.id] ?? block.plannedStart}.`,
                      )
                    }
                    className="h-7 rounded-control px-2 text-caption"
                  >
                    Place
                  </Button>
                </div>
              ) : null}
              {context === "tray" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => addBlockToDay(block.id, date), `${blockTitle} added to this day's list.`)}
                  className="h-7 rounded-control px-2 text-caption"
                >
                  Add to day
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run(() => returnBlockToTray(block.id), `${blockTitle} returned to the tray.`)}
                  className="h-7 gap-1 rounded-control px-2 text-caption text-muted-foreground"
                >
                  <Archive className="size-3" aria-hidden />
                  Tray
                </Button>
              )}
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleAddTask();
        }}
        className="space-y-2.5 rounded-card border border-border bg-surface p-4"
      >
        <Label htmlFor="planner-add-task" className="text-section font-medium">
          Add a task
        </Label>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id="planner-add-task"
            ref={captureRef}
            value={title}
            autoComplete="off"
            placeholder="e.g. Synaptic plasticity chapter"
            onChange={(event) => setTitle(event.target.value)}
            className="min-w-48 flex-1 rounded-control border-border bg-surface-2"
          />
          <Select value={kind} onValueChange={(next) => setKind(next as TaskKind)}>
            <SelectTrigger aria-label="Task kind" className="w-32 rounded-control border-border bg-surface-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deep">Deep</SelectItem>
              <SelectItem value="shallow">Shallow</SelectItem>
              <SelectItem value="recovery">Recovery</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={5}
            max={1440}
            step={5}
            aria-label="Estimate in minutes"
            value={estimateMin}
            onChange={(event) => setEstimateMin(Number(event.target.value) || 50)}
            className="h-8 w-24 rounded-control border-border bg-surface-2 font-mono tabular-nums"
          />
          <Button type="submit" size="sm" disabled={busy} className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90">
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
        </div>
        <label className="flex items-center gap-2 text-caption text-muted-foreground">
          <input
            type="checkbox"
            checked={split}
            onChange={(event) => setSplit(event.target.checked)}
            className="size-3.5 accent-violet"
          />
          Split into {settings.defaultBlockMin ?? 50}-minute blocks in the tray
        </label>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="icon-sm" variant="outline" aria-label="Previous day"
            onClick={() => onChangeDate(shiftISODate(date, -1))} className="rounded-control">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-body font-medium text-foreground">
            <CalendarClock className="size-3.5 text-cyan" aria-hidden />
            {formatDayLabel(date)}
          </span>
          <Button type="button" size="icon-sm" variant="outline" aria-label="Next day"
            onClick={() => onChangeDate(shiftISODate(date, 1))} className="rounded-control">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          {date !== todayISO ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChangeDate(todayISO)}
              className="h-8 rounded-control px-2 text-caption text-cyan">
              Today
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Available time", value: formatMinutes(summary.availableMin) },
          { label: "Planned time", value: formatMinutes(planned) },
          { label: "On the timeline", value: formatMinutes(summary.scheduledMin) },
          { label: "Deep planned", value: formatMinutes(summary.deepWorkPlannedMin) },
        ].map((tile) => (
          <div key={tile.label} className="rounded-control border border-border bg-surface-2 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{tile.label}</p>
            <p className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>

      <p className="text-caption text-muted-foreground">
        Deep work planned:{" "}
        <span className="font-mono text-foreground tabular-nums">{formatMinutes(summary.deepWorkPlannedMin)}</span> of your{" "}
        <span className="font-mono text-foreground tabular-nums">{formatMinutes(summary.deepWorkCapMin)}</span> guideline.
        {summary.exceedsDeepWorkCap ? " Nothing is locked — move a block whenever it suits you." : null}
      </p>

      {overBy > 0 ? (
        <p role="status" className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-caption text-foreground">
          Overpacked by <span className="font-mono tabular-nums">{formatMinutes(overBy)}</span>. You can move a block to
          another day, return it to the tray, or leave it as it is.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section aria-labelledby="planner-timeline-heading" className="min-w-0 space-y-2">
          <h2 id="planner-timeline-heading" className="text-section font-medium text-foreground">
            Timeline
            <span className="ml-2 font-mono text-caption text-muted-foreground tabular-nums">{scheduled.length}</span>
          </h2>
          {scheduled.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="Nothing on the timeline yet"
              description="Break a task into blocks, then give a block a start time. Blocks without a time stay in the day's list."
            />
          ) : (
            <ul className="space-y-2">{scheduled.map((b) => renderBlock(b, "timeline"))}</ul>
          )}
        </section>

        <div className="min-w-0 space-y-4">
          <section aria-labelledby="planner-list-heading" className="space-y-2">
            <h2 id="planner-list-heading" className="text-section font-medium text-foreground">
              <ListChecks className="mr-1.5 inline size-3.5 text-cyan" aria-hidden />
              This day&apos;s list
              <span className="ml-2 font-mono text-caption text-muted-foreground tabular-nums">{listed.length}</span>
            </h2>
            {listed.length === 0 ? (
              <p className="rounded-control border border-dashed border-border px-3 py-3 text-caption text-muted-foreground">
                Blocks here belong to this day without a fixed clock time.
              </p>
            ) : (
              <ul className="space-y-2">{listed.map((b) => renderBlock(b, "list"))}</ul>
            )}
            {settled.length > 0 ? (
              <details className="rounded-control border border-border bg-surface-2/60 px-3 py-2">
                <summary className="cursor-pointer text-caption text-muted-foreground">
                  Done &amp; skipped ({settled.length})
                </summary>
                <ul className="mt-2 space-y-2">{settled.map((b) => renderBlock(b, "list"))}</ul>
              </details>
            ) : null}
          </section>

          <section aria-labelledby="planner-tray-heading" className="space-y-2">
            <h2 id="planner-tray-heading" className="text-section font-medium text-foreground">
              <Archive className="mr-1.5 inline size-3.5 text-cyan" aria-hidden />
              Block tray
              <span className="ml-2 font-mono text-caption text-muted-foreground tabular-nums">{tray.length}</span>
            </h2>
            {tray.length === 0 ? (
              <p className="rounded-control border border-dashed border-border px-3 py-3 text-caption text-muted-foreground">
                The tray is empty. Add a task above and its blocks wait here.
              </p>
            ) : (
              <ul className="max-h-[36svh] space-y-2 overflow-y-auto pr-1">{tray.map((b) => renderBlock(b, "tray"))}</ul>
            )}
          </section>
        </div>
      </div>

      <p className="text-caption text-muted-foreground">
        <Check className="mr-1 inline size-3 align-[-2px]" aria-hidden />
        Every action has a button or a checkbox — no dragging required. Placing a block re-checks overlaps, fixed
        commitments and your wind-down window before saving.
      </p>
    </div>
  );
}
