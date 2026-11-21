"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Download, Moon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { busyIntervalsForDate, mergeBusyIntervals, toFixedCommitments } from "@/features/calendar";
import type { BusyInterval, ExportableBlock } from "@/features/calendar";
import { LocalIcsProvider } from "@/features/calendar/localProvider";
import { isoDatesInRange, shiftISODate, toISODate } from "@/features/planner/dayContext";
import {
  PLANNER_HASH_EVENT,
  PLANNER_TAB_LABELS,
  parsePlannerHash,
  type PlannerTab,
} from "@/features/planner/plannerEvents";
import { REVIEW_KIND_LABEL } from "@/features/planner/review/plannedVsActual";
import { useTodayISO } from "@/features/planner/useTodayISO";
import type { Block, DayPlan, FocusSession, ISODate, Project, Task, UserSettings } from "@/types/domain";
import { ImportIcsPanel } from "./ImportIcsPanel";
import { PlannerReviewPanel } from "./PlannerReviewPanel";
import { PlannerTodayPanel } from "./PlannerTodayPanel";
import { PlannerWorkspace } from "./PlannerWorkspace";
import { ShutdownDialog } from "./ShutdownDialog";

// useSyncExternalStore requires a cached snapshot: returning a fresh object on
// every read makes React re-render forever ("getSnapshot should be cached").
let cachedHash = "";
let cachedSnapshot: { tab: PlannerTab; shutdown: boolean } = { tab: "today", shutdown: false };

function getHashSnapshot(): { tab: PlannerTab; shutdown: boolean } {
  const raw = window.location.hash;
  if (raw !== cachedHash) {
    cachedHash = raw;
    cachedSnapshot = parsePlannerHash(raw);
  }
  return cachedSnapshot;
}

function subscribeHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(PLANNER_HASH_EVENT, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(PLANNER_HASH_EVENT, callback);
  };
}

export interface PlannerConnectionsShellProps {
  settings: UserSettings;
  projects: readonly Project[];
  tasks: readonly Task[];
  blocks: readonly Block[];
  focusSessions: readonly FocusSession[];
  plans: readonly DayPlan[];
  shutdownDates: ReadonlySet<ISODate>;
  reflections: ReadonlyMap<ISODate, string>;
  onSavePlan: (plan: Omit<DayPlan, "id" | "createdAt" | "updatedAt">) => Promise<"created" | "updated">;
}

export function PlannerConnectionsShell({
  settings,
  projects,
  tasks,
  blocks,
  focusSessions,
  plans,
  shutdownDates,
  reflections,
  onSavePlan,
}: PlannerConnectionsShellProps) {
  const todayISO = useTodayISO();
  const hash = useSyncExternalStore(subscribeHash, getHashSnapshot, () =>
    parsePlannerHash(""),
  );
  const [date, setDate] = useState<ISODate>(todayISO);
  const [followsToday, setFollowsToday] = useState(true);
  const [manualShutdownOpen, setManualShutdownOpen] = useState(false);
  const shutdownOpen = manualShutdownOpen || hash.shutdown;
  const [imported, setImported] = useState<BusyInterval[]>([]);
  const [plannerBusy, setPlannerBusy] = useState<BusyInterval[]>([]);
  const effectiveDate = followsToday ? todayISO : date;

  /** Closes the dialog and also clears a `#shutdown` deep link so it cannot reopen. */
  const setShutdownOpen = useCallback((next: boolean) => {
    setManualShutdownOpen(next);
    if (!next) {
      const current = parsePlannerHash(window.location.hash);
      if (current.shutdown) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#${current.tab}`,
        );
        window.dispatchEvent(new Event(PLANNER_HASH_EVENT));
      }
    }
  }, []);

  const changeTab = useCallback((next: string) => {
    const parsed = parsePlannerHash(next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${parsed.tab}`,
    );
    window.dispatchEvent(new Event(PLANNER_HASH_EVENT));
  }, []);

  const changeDate = useCallback(
    (next: ISODate) => {
      setDate(next);
      setFollowsToday(next === todayISO);
    },
    [todayISO],
  );

  // LocalIcsProvider is the single read interface for busy time.
  useEffect(() => {
    let cancelled = false;
    void new LocalIcsProvider()
      .getBusyIntervals({ start: effectiveDate, end: effectiveDate })
      .then((intervals) => {
        if (!cancelled) setPlannerBusy(intervals);
      })
      .catch(() => {
        if (!cancelled) setPlannerBusy([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveDate, plans]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const plan = plans.find((entry) => entry.date === effectiveDate);

  /** Planner commitments already live inside PlannerWorkspace; only foreign ones merge. */
  const externalCommitments = useMemo(() => {
    const merged = mergeBusyIntervals(
      busyIntervalsForDate(imported, effectiveDate),
      busyIntervalsForDate(plannerBusy, effectiveDate).filter((i) => i.source !== "planner"),
    );
    return toFixedCommitments(merged);
  }, [imported, plannerBusy, effectiveDate]);

  const exportable = useCallback(
    (start: ISODate, end: ISODate): ExportableBlock[] => {
      const dates = new Set(isoDatesInRange(start, end, 62));
      return blocks
        .filter((block) => block.plannedDate && dates.has(block.plannedDate))
        .map((block) => {
          const task = taskById.get(block.taskId);
          const project = task?.projectId ? projectById.get(task.projectId) : undefined;
          return {
            id: block.id,
            title: task?.title ?? "Untitled task",
            date: block.plannedDate!,
            ...(block.plannedStart ? { startTime: block.plannedStart } : {}),
            plannedMin: block.plannedMin,
            kind: task?.kind ?? "shallow",
            ...(project?.name ? { projectName: project.name } : {}),
            ...(task?.notes ? { notes: task.notes } : {}),
            status: block.status,
          };
        });
    },
    [blocks, taskById, projectById],
  );

  const handleExport = useCallback(
    async (scope: "day" | "week") => {
      const start = effectiveDate;
      const end = scope === "day" ? effectiveDate : shiftISODate(effectiveDate, 6);
      const result = await new LocalIcsProvider().exportBlocks(exportable(start, end));
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${result.filename}.`, {
        description: result.notes.join(" "),
      });
    },
    [effectiveDate, exportable],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planner"
        description="Place blocks in your day, review planned against logged time, and export the plan as a calendar file. Everything stays in this browser."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void handleExport("day")} className="gap-1.5 rounded-control">
              <Download className="size-3.5" aria-hidden />
              Export day (.ics)
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleExport("week")} className="gap-1.5 rounded-control">
              <Download className="size-3.5" aria-hidden />
              Export week (.ics)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={shutdownDates.has(effectiveDate) ? "outline" : "default"}
              onClick={() => setShutdownOpen(true)}
              className="gap-1.5 rounded-control"
            >
              <Moon className="size-3.5" aria-hidden />
              {shutdownDates.has(effectiveDate) ? "Day closed" : "Shutdown"}
            </Button>
          </div>
        }
      />

      <Tabs value={hash.tab} onValueChange={changeTab} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-control border border-border bg-surface p-1 sm:w-fit">
          {(["today", "review", "day"] as const).map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {PLANNER_TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="today">
          <PlannerTodayPanel
            date={effectiveDate}
            todayISO={todayISO}
            onChangeDate={changeDate}
            blocks={blocks}
            tasks={tasks}
            projects={projects}
            settings={settings}
            plan={plan}
          />
        </TabsContent>

        <TabsContent value="review">
          <PlannerReviewPanel todayISO={todayISO} blocks={blocks} tasks={tasks} />
        </TabsContent>

        <TabsContent value="day" className="space-y-4">
          <ImportIcsPanel todayISO={todayISO} intervals={imported} onIntervalsChange={setImported} />
          <PlannerWorkspace
            defaultSleepTargetMin={settings.sleepTargetMin}
            defaultBreakMin={settings.breakDefaultMin}
            focusSessions={[...focusSessions]}
            savedPlans={[...plans]}
            onSavePlan={onSavePlan}
            externalCommitments={externalCommitments}
          />
        </TabsContent>
      </Tabs>

      <ShutdownDialog
        open={shutdownOpen}
        onOpenChange={setShutdownOpen}
        date={effectiveDate}
        blocks={blocks}
        tasks={tasks}
        reflection={reflections.get(effectiveDate)}
        alreadyClosed={shutdownDates.has(effectiveDate)}
      />

      <p className="text-caption text-muted-foreground">
        {REVIEW_KIND_LABEL.deep} blocks map to the existing deep-focus association in the atlas; shallow and recovery
        blocks keep their own study-method association. Educational associations only, never measurements. Exported
        files use local wall-clock time, so daylight-saving changes cannot shift a block.
      </p>
    </div>
  );
}

export function PlannerConnectionsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <Skeleton className="h-10 w-72 rounded-control" />
      <Skeleton className="h-28 rounded-card" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Skeleton className="h-[420px] rounded-card" />
        <Skeleton className="h-[420px] rounded-card" />
      </div>
    </div>
  );
}

/** Re-exported so the page can build the export filename from the same helper. */
export { toISODate };
