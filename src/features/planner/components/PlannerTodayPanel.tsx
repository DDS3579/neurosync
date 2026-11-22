"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Archive, CalendarClock, Check, ChevronLeft, ChevronRight, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { nudgeClock, slotClocksFor } from "@/features/planner/timelineSlots";
import { blockRepository, taskRepository } from "@/lib/db/repositories";
import type { Block, DayPlan, ISODate, Project, Task, TaskKind, UserSettings } from "@/types/domain";
import type { BeginBlockDragParams } from "@/features/planner/dnd/pointerDrag";

import { PlannerBlockRow } from "./PlannerBlockRow";

/**
 * The drop rail (slot grid + pointer-drag target markup) is code-split so the
 * planner's base chunk does not carry placement-mode markup it rarely needs.
 */
const TimelineDropRail = dynamic(
  () => import("./TimelineDropRail").then((module) => module.TimelineDropRail),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-card border border-border bg-surface p-3" aria-hidden>
        <Skeleton className="h-5 w-40 rounded-[4px]" />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-control" />
          ))}
        </div>
      </div>
    ),
  },
);

type DragApi = { beginBlockPointerDrag: (params: BeginBlockDragParams) => void };

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
  const dragApiRef = useRef<DragApi | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("deep");
  const [estimateMin, setEstimateMin] = useState(settings.defaultBlockMin ?? 50);
  const [split, setSplit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [placing, setPlacing] = useState<{ blockId: string; title: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverClock, setHoverClock] = useState<string | null>(null);

  useEffect(() => {
    const focus = () => captureRef.current?.focus();
    window.addEventListener(PLANNER_ADD_TASK_EVENT, focus);
    return () => window.removeEventListener(PLANNER_ADD_TASK_EVENT, focus);
  }, []);

  // Pointer-drag support is a separate chunk, fetched only when Today mounts.
  useEffect(() => {
    let alive = true;
    void import("@/features/planner/dnd/pointerDrag").then((module) => {
      if (alive) dragApiRef.current = module;
    });
    return () => {
      alive = false;
      dragApiRef.current = null;
    };
  }, []);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const constraints = useMemo(
    () =>
      dayConstraintsFor(date, plan, {
        sleepTargetMin: settings.sleepTargetMin,
        deepWorkCapMin: settings.deepWorkCapMin,
        snapMin: settings.snapMin,
      }),
    [date, plan, settings.sleepTargetMin, settings.deepWorkCapMin, settings.snapMin],
  );

  const dayBlocks = useMemo(() => blocks.filter((block) => block.plannedDate === date), [blocks, date]);
  const scheduled = useMemo(
    () =>
      dayBlocks
        .filter((block) => Boolean(block.plannedStart))
        .sort((a, b) => (a.plannedStart ?? "").localeCompare(b.plannedStart ?? "")),
    [dayBlocks],
  );
  const listed = useMemo(
    () =>
      dayBlocks
        .filter((block) => !block.plannedStart && block.status === "todo")
        .sort((a, b) => a.order - b.order),
    [dayBlocks],
  );
  const settled = useMemo(
    () =>
      dayBlocks
        .filter((block) => !block.plannedStart && block.status !== "todo")
        .sort((a, b) => a.order - b.order),
    [dayBlocks],
  );
  const tray = useMemo(
    () =>
      blocks
        .filter((block) => !block.plannedDate && !block.plannedStart && block.status === "todo")
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
        blocks: dayBlocks.map((block) => ({
          kind: taskById.get(block.taskId)?.kind ?? "shallow",
          plannedMin: block.plannedMin,
          status: block.status,
        })),
        deepWorkCapMin: settings.deepWorkCapMin,
      }),
    [constraints, dayBlocks, taskById, settings.deepWorkCapMin],
  );
  const planned = plannedMinutes(dayBlocks);
  const overBy = Math.max(0, planned - summary.availableMin);

  const slotClocks = useMemo(
    () =>
      slotClocksFor({
        wakeTime: constraints.wakeTime,
        sleepTargetMin: constraints.sleepTargetMin,
        windDownMin: constraints.windDownMin,
        snapMin: settings.snapMin ?? 15,
      }),
    [constraints.wakeTime, constraints.sleepTargetMin, constraints.windDownMin, settings.snapMin],
  );

  const focusRow = useCallback((blockId: string) => {
    window.setTimeout(() => {
      document.getElementById(`block-row-${blockId}`)?.focus();
    }, 30);
  }, []);

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

  const placeAt = useCallback(
    async (blockId: string, blockTitle: string, clock: string) => {
      setBusy(true);
      try {
        await placeBlockAt(blockId, date, clock, settings, plan);
        const message = `${blockTitle} placed at ${clock}.`;
        setAnnouncement(message);
        toast.success(message);
        setPlacing(null);
        setDraggingId(null);
        setHoverClock(null);
        focusRow(blockId);
      } catch (error) {
        const text = error instanceof Error ? error.message : "That placement was not saved.";
        setAnnouncement(text);
        toast.error(text);
        focusRow(blockId);
      } finally {
        setBusy(false);
      }
    },
    [date, focusRow, plan, settings],
  );

  const nudge = useCallback(
    (block: Block, blockTitle: string, deltaMin: number) => {
      if (!block.plannedStart) return;
      void placeAt(block.id, blockTitle, nudgeClock(block.plannedStart, deltaMin));
    },
    [placeAt],
  );

  const armPlace = useCallback((block: Block, blockTitle: string) => {
    setDraggingId(null);
    setHoverClock(null);
    setPlacing((current) =>
      current?.blockId === block.id ? null : { blockId: block.id, title: blockTitle },
    );
  }, []);

  const cancelPlacement = useCallback(() => {
    const blockId = placing?.blockId ?? draggingId;
    setPlacing(null);
    setDraggingId(null);
    setHoverClock(null);
    setAnnouncement("Placement cancelled. Nothing changed.");
    if (blockId) focusRow(blockId);
  }, [draggingId, focusRow, placing?.blockId]);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, block: Block, blockTitle: string) => {
      if (event.button !== 0 || busy) return;
      const api = dragApiRef.current;
      if (!api) return;
      event.preventDefault();
      setDraggingId(block.id);
      api.beginBlockPointerDrag({
        blockId: block.id,
        title: blockTitle,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        onStart: () => setAnnouncement(`Dragging ${blockTitle}. Release on a timeline slot to place it.`),
        onHover: (clock) => setHoverClock(clock),
        onDrop: (blockId, clock) => {
          void placeAt(blockId, blockTitle, clock);
        },
        onCancel: () => {
          setDraggingId(null);
          setHoverClock(null);
        },
      });
    },
    [busy, placeAt],
  );

  const handleAddTask = useCallback(async () => {
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
      const text = error instanceof Error ? error.message : "Could not add that task.";
      setAnnouncement(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  }, [estimateMin, kind, settings.defaultBlockMin, split, title]);

  const renderRow = useCallback(
    (block: Block, context: "timeline" | "list" | "tray") => {
      const task = taskById.get(block.taskId);
      const project = task?.projectId ? projectById.get(task.projectId) : undefined;
      return (
        <PlannerBlockRow
          key={block.id}
          block={block}
          task={task}
          projectColor={project?.color}
          settings={settings}
          context={context}
          busy={busy}
          onStart={(rowBlock, rowTask) => router.push(blockFocusHref(rowBlock, rowTask))}
          onComplete={(rowBlock) => void run(() => completeBlock(rowBlock.id), `${task?.title ?? "Block"} marked done.`)}
          onSkip={(rowBlock, rowTitle) => void run(() => skipBlock(rowBlock.id), `${rowTitle} skipped for this day.`)}
          onTray={(rowBlock, rowTitle) => void run(() => returnBlockToTray(rowBlock.id), `${rowTitle} returned to the tray.`)}
          onAddToDay={(rowBlock, rowTitle) =>
            void run(() => addBlockToDay(rowBlock.id, date), `${rowTitle} added to this day's list.`)
          }
          onPlace={(rowBlock, rowTitle, clock) => void placeAt(rowBlock.id, rowTitle, clock)}
          onArmPlace={armPlace}
          onNudge={nudge}
          onBeginDrag={beginDrag}
        />
      );
    },
    [armPlace, beginDrag, busy, date, nudge, placeAt, projectById, router, run, settings, taskById],
  );

  // Tray blocks have no plannedDate, so the rail target must search every block.
  const railTargetBlock =
    (placing ? blocks.find((block) => block.id === placing.blockId) : undefined) ??
    (draggingId ? blocks.find((block) => block.id === draggingId) : undefined);
  const railOpen = Boolean(railTargetBlock);
  const railTitle = railTargetBlock ? taskById.get(railTargetBlock.taskId)?.title ?? "this block" : "";

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

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
            className="h-9 w-24 rounded-control border-border bg-surface-2 font-mono tabular-nums"
          />
          <Button type="submit" size="sm" disabled={busy} className="min-h-9 gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90">
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
        </div>
        <label className="flex items-center gap-2 text-caption text-muted-foreground">
          <input
            type="checkbox"
            checked={split}
            onChange={(event) => setSplit(event.target.checked)}
            className="size-4 accent-violet"
          />
          Split into {settings.defaultBlockMin ?? 50}-minute blocks in the tray
        </label>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Previous day"
            onClick={() => onChangeDate(shiftISODate(date, -1))}
            className="min-h-9 min-w-9 rounded-control"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-body font-medium text-foreground">
            <CalendarClock className="size-3.5 text-cyan" aria-hidden />
            {formatDayLabel(date)}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Next day"
            onClick={() => onChangeDate(shiftISODate(date, 1))}
            className="min-h-9 min-w-9 rounded-control"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          {date !== todayISO ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChangeDate(todayISO)}
              className="h-9 rounded-control px-2 text-caption text-cyan"
            >
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
            <ul className="space-y-2">{scheduled.map((block) => renderRow(block, "timeline"))}</ul>
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
              <ul className="space-y-2">{listed.map((block) => renderRow(block, "list"))}</ul>
            )}
            {settled.length > 0 ? (
              <details className="rounded-control border border-border bg-surface-2/60 px-3 py-2">
                <summary className="cursor-pointer text-caption text-muted-foreground">
                  Done &amp; skipped ({settled.length})
                </summary>
                <ul className="mt-2 space-y-2">{settled.map((block) => renderRow(block, "list"))}</ul>
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
              <ul className="max-h-[36svh] space-y-2 overflow-y-auto pr-1">
                {tray.map((block) => renderRow(block, "tray"))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {railOpen ? (
        <TimelineDropRail
          title={railTitle}
          clocks={slotClocks}
          activeClock={hoverClock}
          busy={busy}
          onPlace={(clock) => {
            if (!railTargetBlock) return;
            const targetTitle = taskById.get(railTargetBlock.taskId)?.title ?? "Block";
            void placeAt(railTargetBlock.id, targetTitle, clock);
          }}
          onCancel={cancelPlacement}
        />
      ) : null}

      <p className="text-caption text-muted-foreground">
        <Check className="mr-1 inline size-3 align-[-2px]" aria-hidden />
        Every action has a button or a checkbox: drag a block onto a slot, tap <em>Slots</em>, or use{" "}
        <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">Alt</kbd>+
        <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↑/↓</kbd> on a placed block.
        Placing a block re-checks overlaps, fixed commitments and your wind-down window before saving.
      </p>
    </div>
  );
}
