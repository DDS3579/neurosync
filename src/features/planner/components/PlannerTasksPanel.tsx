"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
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
import { splitIntoBlocks } from "@/features/planner/blocks";
import { formatMinutes } from "@/features/planner/dayContext";
import { PLANNER_ADD_TASK_EVENT } from "@/features/planner/plannerEvents";
import { blockRepository, taskRepository } from "@/lib/db/repositories";
import { cn } from "@/lib/utils";
import type { Block, ISODate, Project, Task, TaskKind, UserSettings } from "@/types/domain";

const KIND_STYLE: Record<TaskKind, string> = {
  deep: "border-violet/50 bg-violet/20 text-violet-text",
  shallow: "border-cyan/45 bg-cyan/15 text-cyan",
  recovery: "border-success/45 bg-success/15 text-success",
};

export interface PlannerTasksPanelProps {
  todayISO: ISODate;
  tasks: readonly Task[];
  blocks: readonly Block[];
  projects: readonly Project[];
  settings: UserSettings;
  onOpenDay: (date: ISODate) => void;
}

/**
 * Task board: capture, split into blocks and see progress. Planned blocks are
 * then placed from Today, so this panel never writes a start time itself.
 */
export function PlannerTasksPanel({
  todayISO,
  tasks,
  blocks,
  projects,
  settings,
  onOpenDay,
}: PlannerTasksPanelProps) {
  const captureRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("deep");
  const [estimateMin, setEstimateMin] = useState(settings.defaultBlockMin ?? 50);
  const [projectId, setProjectId] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const focus = () => captureRef.current?.focus();
    window.addEventListener(PLANNER_ADD_TASK_EVENT, focus);
    return () => window.removeEventListener(PLANNER_ADD_TASK_EVENT, focus);
  }, []);

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const blocksByTask = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const block of blocks) {
      const list = map.get(block.taskId) ?? [];
      list.push(block);
      map.set(block.taskId, list);
    }
    return map;
  }, [blocks]);

  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "active" || task.status === "inbox")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [tasks],
  );

  const handleAdd = useCallback(async () => {
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
        ...(projectId !== "none" ? { projectId } : {}),
      });
      const parts = splitIntoBlocks(estimate, settings.defaultBlockMin ?? 50);
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
  }, [estimateMin, kind, projectId, settings.defaultBlockMin, title]);

  const handlePlanToday = useCallback(
    async (task: Task) => {
      setBusy(true);
      try {
        const existing = blocksByTask.get(task.id) ?? [];
        const plannedAlready = existing
          .filter((block) => block.status !== "skipped")
          .reduce((sum, block) => sum + block.plannedMin, 0);
        const remaining = Math.max(settings.defaultBlockMin ?? 50, task.estimateMin - plannedAlready);
        const parts = splitIntoBlocks(remaining, settings.defaultBlockMin ?? 50);
        await blockRepository.bulkCreate(
          parts.map((plannedMin, index) => ({
            taskId: task.id,
            order: existing.length + index,
            plannedMin,
            status: "todo" as const,
            plannedDate: todayISO,
          })),
        );
        const message = `Added ${parts.length} ${parts.length === 1 ? "block" : "blocks"} for "${task.title}" to today's list.`;
        setAnnouncement(message);
        toast.success(message);
      } catch (error) {
        const text = error instanceof Error ? error.message : "Could not plan that task.";
        setAnnouncement(text);
        toast.error(text);
      } finally {
        setBusy(false);
      }
    },
    [blocksByTask, settings.defaultBlockMin, todayISO],
  );

  const handleArchive = useCallback(async (task: Task) => {
    setBusy(true);
    try {
      await taskRepository.archive(task.id);
      const message = `Archived "${task.title}". Its blocks were removed; focus sessions stay untouched.`;
      setAnnouncement(message);
      toast.success(message);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not archive that task.";
      setAnnouncement(text);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleAdd();
        }}
        className="space-y-2.5 rounded-card border border-border bg-surface p-4"
      >
        <Label htmlFor="tasks-new-title" className="text-section font-medium">
          Add a task
        </Label>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id="tasks-new-title"
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
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger aria-label="Project" className="w-40 rounded-control border-border bg-surface-2">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
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
        <p className="text-caption text-muted-foreground">
          Added tasks split into {settings.defaultBlockMin ?? 50}-minute blocks in the tray. Nothing is scheduled until
          you place a block on a day.
        </p>
      </form>

      <section aria-labelledby="tasks-open-heading" className="space-y-2">
        <h2 id="tasks-open-heading" className="flex items-center gap-1.5 text-section font-medium text-foreground">
          <ListChecks className="size-4 text-cyan" aria-hidden />
          Open tasks
          <span className="ml-1 font-mono text-caption text-muted-foreground tabular-nums">{openTasks.length}</span>
        </h2>

        {openTasks.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title="No open tasks yet"
            description="Add a task above. It becomes blocks in the tray, ready to place on a day when you choose."
          />
        ) : (
          <ul className="space-y-2">
            {openTasks.map((task) => {
              const taskBlocks = blocksByTask.get(task.id) ?? [];
              const done = taskBlocks.filter((block) => block.status === "done").length;
              const planned = taskBlocks
                .filter((block) => block.status !== "skipped")
                .reduce((sum, block) => sum + block.plannedMin, 0);
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{task.title}</span>
                  <Badge variant="outline" className={cn("rounded-chip font-mono text-[10px]", KIND_STYLE[task.kind])}>
                    {task.kind}
                  </Badge>
                  {task.projectId && projectNameById.has(task.projectId) ? (
                    <span className="text-[11px] text-muted-foreground">{projectNameById.get(task.projectId)}</span>
                  ) : null}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {formatMinutes(planned)} in {taskBlocks.length} {taskBlocks.length === 1 ? "block" : "blocks"} ·{" "}
                    {done} done
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handlePlanToday(task)}
                      aria-label={`Add blocks for ${task.title} to today`}
                      className="min-h-9 rounded-control px-2 text-caption"
                    >
                      Add to today
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onOpenDay(todayISO)}
                      className="min-h-9 rounded-control px-2 text-caption text-cyan"
                    >
                      Open today
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Archive ${task.title}`}
                      onClick={() => void handleArchive(task)}
                      className="min-h-9 min-w-9 rounded-control"
                    >
                      <Archive className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
