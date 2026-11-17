"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatMinutesLabel } from "@/features/insights/weeklyExport";
import {
  computePlanBalance,
  generateDayPlan,
  timeToOffset,
} from "@/features/planner/plannerEngine";
import { parseHHMM } from "@/features/reminders/reminderUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { cn } from "@/lib/utils";
import type {
  DayPlan,
  FocusSession,
  ISODate,
  PlanBlockKind,
  PlannerFixedCommitment,
  PlannerStudyGoal,
  Rating,
  ScheduledPlanBlock,
  UnscheduledGoalItem,
} from "@/types/domain";

const BLOCK_BADGES: Record<PlanBlockKind, { label: string; className: string }> = {
  fixed: {
    label: "Fixed",
    className: "border-border-strong bg-surface-2 text-foreground",
  },
  study: {
    label: "Study",
    className: "border-violet/40 bg-violet/15 text-foreground",
  },
  break: {
    label: "Break",
    className: "border-border bg-surface-2 text-muted-foreground",
  },
  movement: {
    label: "Movement",
    className: "border-cyan/40 bg-cyan/10 text-cyan",
  },
  recovery: {
    label: "Recovery",
    className: "border-cyan/30 bg-surface-2 text-cyan",
  },
  wind_down: {
    label: "Wind-down",
    className: "border-border bg-surface-2 text-muted-foreground",
  },
  sleep: {
    label: "Sleep",
    className: "border-border bg-background text-muted-foreground",
  },
};

export interface PlannerDraftState {
  date: ISODate;
  wakeTime: string;
  sleepTargetMin: number;
  windDownMin: number;
  maxStudyBlockMin: number;
  breakMin: number;
  bufferMin: number;
  movementGoalMin: number;
  preferRecoverySpacing: boolean;
  commitments: PlannerFixedCommitment[];
  studyGoals: PlannerStudyGoal[];
  blocks: ScheduledPlanBlock[];
  unscheduled: UnscheduledGoalItem[];
  usedHistoryWindows: boolean;
}

function buildInitialDraft(
  date: ISODate,
  saved: DayPlan | undefined,
  defaultSleepMin: number,
  defaultBreakMin: number,
  focusHistory: readonly FocusSession[],
): PlannerDraftState {
  if (saved) {
    const generatedMeta = generateDayPlan({
      date: saved.date,
      wakeTime: saved.wakeTime,
      sleepTargetMin: saved.sleepTargetMin,
      windDownMin: saved.windDownMin,
      maxStudyBlockMin: saved.maxStudyBlockMin,
      breakMin: saved.breakMin,
      bufferMin: saved.bufferMin,
      movementGoalMin: saved.movementGoalMin,
      preferRecoverySpacing: saved.preferRecoverySpacing,
      commitments: saved.commitments,
      studyGoals: saved.studyGoals,
      focusHistory,
    });
    return {
      date: saved.date,
      wakeTime: saved.wakeTime,
      sleepTargetMin: saved.sleepTargetMin,
      windDownMin: saved.windDownMin,
      maxStudyBlockMin: saved.maxStudyBlockMin,
      breakMin: saved.breakMin,
      bufferMin: saved.bufferMin,
      movementGoalMin: saved.movementGoalMin,
      preferRecoverySpacing: saved.preferRecoverySpacing,
      commitments: saved.commitments,
      studyGoals: saved.studyGoals,
      blocks: saved.blocks,
      unscheduled: saved.unscheduled,
      usedHistoryWindows: generatedMeta.usedHistoryWindows,
    };
  }

  const base = {
    date,
    wakeTime: "07:00",
    sleepTargetMin: defaultSleepMin || 480,
    windDownMin: 45,
    maxStudyBlockMin: 50,
    breakMin: Math.max(5, defaultBreakMin || 10),
    bufferMin: 10,
    movementGoalMin: 30,
    preferRecoverySpacing: true,
    commitments: [],
    studyGoals: [],
  };
  const generated = generateDayPlan({ ...base, focusHistory });
  return {
    ...base,
    blocks: generated.blocks,
    unscheduled: generated.unscheduled,
    usedHistoryWindows: generated.usedHistoryWindows,
  };
}

function computeDurationBetween(startHHMM: string, endHHMM: string): number | null {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  if (s === null || e === null || s === e) return null;
  return e > s ? e - s : 1440 - s + e;
}

export interface PlannerWorkspaceProps {
  defaultSleepTargetMin: number;
  defaultBreakMin: number;
  focusSessions: FocusSession[];
  savedPlans: DayPlan[];
  onSavePlan: (
    plan: Omit<DayPlan, "id" | "createdAt" | "updatedAt">,
  ) => Promise<"created" | "updated">;
}

export function PlannerWorkspace({
  defaultSleepTargetMin,
  defaultBreakMin,
  focusSessions,
  savedPlans,
  onSavePlan,
}: PlannerWorkspaceProps) {
  const router = useRouter();
  const todayISO = toLocalISODate();

  const savedByDate = useMemo(
    () => new Map(savedPlans.map((p) => [p.date, p])),
    [savedPlans],
  );

  const [draft, setDraft] = useState<PlannerDraftState>(() =>
    buildInitialDraft(
      todayISO,
      savedByDate.get(todayISO),
      defaultSleepTargetMin,
      defaultBreakMin,
      focusSessions,
    ),
  );

  // Add commitment local inputs
  const [commitTitle, setCommitTitle] = useState("");
  const [commitStart, setCommitStart] = useState("09:00");
  const [commitEnd, setCommitEnd] = useState("11:00");

  // Add study goal local inputs
  const [goalSubject, setGoalSubject] = useState("");
  const [goalMinutes, setGoalMinutes] = useState(50);
  const [goalDifficulty, setGoalDifficulty] = useState<Rating>(3);

  const [saving, setSaving] = useState(false);

  const hasSavedForDate = savedByDate.has(draft.date);

  const switchDate = (nextDate: ISODate) => {
    setDraft(
      buildInitialDraft(
        nextDate,
        savedByDate.get(nextDate),
        defaultSleepTargetMin,
        defaultBreakMin,
        focusSessions,
      ),
    );
  };

  const regenerateWith = (next: PlannerDraftState) => {
    const generated = generateDayPlan({
      date: next.date,
      wakeTime: next.wakeTime,
      sleepTargetMin: next.sleepTargetMin,
      windDownMin: next.windDownMin,
      maxStudyBlockMin: next.maxStudyBlockMin,
      breakMin: next.breakMin,
      bufferMin: next.bufferMin,
      movementGoalMin: next.movementGoalMin,
      preferRecoverySpacing: next.preferRecoverySpacing,
      commitments: next.commitments,
      studyGoals: next.studyGoals,
      focusHistory: focusSessions,
    });
    setDraft({
      ...next,
      blocks: generated.blocks,
      unscheduled: generated.unscheduled,
      usedHistoryWindows: generated.usedHistoryWindows,
    });
  };

  const addCommitment = () => {
    const title = commitTitle.trim();
    if (!title) {
      toast.error("Enter a title for the fixed commitment.");
      return;
    }
    const dur = computeDurationBetween(commitStart, commitEnd);
    if (dur === null || dur <= 0) {
      toast.error("Choose valid start and end times.");
      return;
    }
    const next: PlannerDraftState = {
      ...draft,
      commitments: [
        ...draft.commitments,
        {
          id: crypto.randomUUID(),
          title,
          startTime: commitStart,
          endTime: commitEnd,
        },
      ],
    };
    setCommitTitle("");
    regenerateWith(next);
  };

  const removeCommitment = (id: string) => {
    regenerateWith({
      ...draft,
      commitments: draft.commitments.filter((c) => c.id !== id),
    });
  };

  const addStudyGoal = () => {
    const subject = goalSubject.trim();
    if (!subject) {
      toast.error("Enter a subject for the study goal.");
      return;
    }
    const minutes = Math.max(15, Math.min(480, Math.round(goalMinutes)));
    const next: PlannerDraftState = {
      ...draft,
      studyGoals: [
        ...draft.studyGoals,
        {
          id: crypto.randomUUID(),
          subject,
          minutes,
          difficulty: goalDifficulty,
        },
      ],
    };
    setGoalSubject("");
    regenerateWith(next);
  };

  const removeStudyGoal = (id: string) => {
    regenerateWith({
      ...draft,
      studyGoals: draft.studyGoals.filter((g) => g.id !== id),
    });
  };

  const updateBlockTime = (
    blockId: string,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    const wakeMin = parseHHMM(draft.wakeTime) ?? 420;
    setDraft((prev) => {
      const updated = prev.blocks.map((block) => {
        if (block.id !== blockId) return block;
        const nextStart = field === "startTime" ? value : block.startTime;
        const nextEnd = field === "endTime" ? value : block.endTime;
        const nextDur = computeDurationBetween(nextStart, nextEnd);
        return {
          ...block,
          startTime: nextStart,
          endTime: nextEnd,
          durationMin: nextDur ?? block.durationMin,
        };
      });
      updated.sort(
        (a, b) => timeToOffset(wakeMin, a.startTime) - timeToOffset(wakeMin, b.startTime),
      );
      return { ...prev, blocks: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const mode = await onSavePlan({
        date: draft.date,
        wakeTime: draft.wakeTime,
        sleepTargetMin: draft.sleepTargetMin,
        windDownMin: draft.windDownMin,
        maxStudyBlockMin: draft.maxStudyBlockMin,
        breakMin: draft.breakMin,
        bufferMin: draft.bufferMin,
        movementGoalMin: draft.movementGoalMin,
        preferRecoverySpacing: draft.preferRecoverySpacing,
        commitments: draft.commitments,
        studyGoals: draft.studyGoals,
        blocks: draft.blocks,
        unscheduled: draft.unscheduled,
      });
      toast.success(
        mode === "updated"
          ? `Updated saved plan for ${draft.date}.`
          : `Saved day plan for ${draft.date}.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSaved = () => {
    const saved = savedByDate.get(draft.date);
    if (!saved) {
      toast.info(`No saved plan found for ${draft.date}.`);
      return;
    }
    setDraft(
      buildInitialDraft(
        draft.date,
        saved,
        defaultSleepTargetMin,
        defaultBreakMin,
        focusSessions,
      ),
    );
    toast.success(`Loaded saved plan for ${draft.date}.`);
  };

  const startStudyBlock = (block: ScheduledPlanBlock) => {
    const subject = encodeURIComponent(block.subject ?? block.title);
    const plannedMin = Math.max(1, Math.min(240, block.durationMin));
    router.push(`/focus?subject=${subject}&plannedMin=${plannedMin}`);
  };

  const balance = useMemo(() => computePlanBalance(draft.blocks), [draft.blocks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Schedule Planner"
        description="Rule-based day layout that protects sleep and wind-down, respects fixed commitments, and balances study with recovery."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasSavedForDate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadSaved}
                className="gap-1.5 rounded-control"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Load saved
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void handleSave()}
              className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
            >
              <Save className="size-3.5" aria-hidden />
              {hasSavedForDate ? "Update plan" : "Save plan"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Planner Inputs */}
        <div className="space-y-5 lg:col-span-5">
          <Card className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-none">
            <h2 className="text-section font-medium text-foreground">Day &amp; recovery rules</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="planner-date">Date</Label>
                <Input
                  id="planner-date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => switchDate(e.target.value)}
                  className="rounded-control border-border bg-surface-2 font-mono text-body"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="planner-wake">Wake time</Label>
                <Input
                  id="planner-wake"
                  type="time"
                  value={draft.wakeTime}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, wakeTime: e.target.value }))
                  }
                  className="rounded-control border-border bg-surface-2 font-mono text-body"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="planner-sleep-hours">Sleep target (hours)</Label>
                <Input
                  id="planner-sleep-hours"
                  type="number"
                  step="0.5"
                  min={4}
                  max={12}
                  value={Number((draft.sleepTargetMin / 60).toFixed(1))}
                  onChange={(e) => {
                    const hrs = Number(e.target.value);
                    if (Number.isFinite(hrs)) {
                      setDraft((prev) => ({
                        ...prev,
                        sleepTargetMin: Math.round(Math.max(4, Math.min(12, hrs)) * 60),
                      }));
                    }
                  }}
                  className="rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="planner-wind-down">Wind-down (min)</Label>
                <Input
                  id="planner-wind-down"
                  type="number"
                  min={0}
                  max={180}
                  step={5}
                  value={draft.windDownMin}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      windDownMin: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="planner-max-study">Max study block (min)</Label>
                <Input
                  id="planner-max-study"
                  type="number"
                  min={15}
                  max={90}
                  step={5}
                  value={draft.maxStudyBlockMin}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      maxStudyBlockMin: Math.max(15, Math.min(90, Number(e.target.value) || 50)),
                    }))
                  }
                  className="rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="planner-break">Break length (min)</Label>
                <Input
                  id="planner-break"
                  type="number"
                  min={0}
                  max={45}
                  step={5}
                  value={draft.breakMin}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      breakMin: Math.max(0, Math.min(45, Number(e.target.value) || 0)),
                    }))
                  }
                  className="rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="planner-movement">Movement goal (min)</Label>
                <Input
                  id="planner-movement"
                  type="number"
                  min={0}
                  max={180}
                  step={5}
                  value={draft.movementGoalMin}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      movementGoalMin: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="planner-buffer">Commitment buffer (min)</Label>
                <Input
                  id="planner-buffer"
                  type="number"
                  min={0}
                  max={30}
                  step={5}
                  value={draft.bufferMin}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      bufferMin: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                    }))
                  }
                  className="rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-3.5 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="planner-recovery-toggle" className="text-body font-medium">
                  Reserve recovery pause
                </Label>
                <p className="text-caption text-muted-foreground">
                  Keep a 20m screen-free breather when space allows.
                </p>
              </div>
              <Switch
                id="planner-recovery-toggle"
                checked={draft.preferRecoverySpacing}
                onCheckedChange={(next) =>
                  setDraft((prev) => ({ ...prev, preferRecoverySpacing: next }))
                }
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => regenerateWith(draft)}
              className="w-full gap-1.5 rounded-control"
            >
              <CalendarClock className="size-4" aria-hidden />
              Generate / refresh timeline
            </Button>
          </Card>

          {/* Fixed Commitments */}
          <Card className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-none">
            <h2 className="text-section font-medium text-foreground">Fixed commitments</h2>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="commit-title">Title</Label>
                <Input
                  id="commit-title"
                  value={commitTitle}
                  onChange={(e) => setCommitTitle(e.target.value)}
                  placeholder="e.g. Lectures, Part-time shift"
                  className="rounded-control border-border bg-surface-2"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="commit-start" className="text-caption">
                    Start
                  </Label>
                  <Input
                    id="commit-start"
                    type="time"
                    value={commitStart}
                    onChange={(e) => setCommitStart(e.target.value)}
                    className="w-28 rounded-control border-border bg-surface-2 font-mono text-caption"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="commit-end" className="text-caption">
                    End
                  </Label>
                  <Input
                    id="commit-end"
                    type="time"
                    value={commitEnd}
                    onChange={(e) => setCommitEnd(e.target.value)}
                    className="w-28 rounded-control border-border bg-surface-2 font-mono text-caption"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addCommitment}
                  className="gap-1 rounded-control"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add
                </Button>
              </div>
            </div>

            {draft.commitments.length > 0 ? (
              <ul className="space-y-2">
                {draft.commitments.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body text-foreground">{c.title}</p>
                      <p className="font-mono text-caption text-muted-foreground tabular-nums">
                        {c.startTime} – {c.endTime}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove commitment ${c.title}`}
                      onClick={() => removeCommitment(c.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {/* Study Goals */}
          <Card className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-none">
            <h2 className="text-section font-medium text-foreground">Study goals for today</h2>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="goal-subject">Subject</Label>
                <Input
                  id="goal-subject"
                  value={goalSubject}
                  onChange={(e) => setGoalSubject(e.target.value)}
                  placeholder="e.g. Organic chemistry, Flashcards"
                  className="rounded-control border-border bg-surface-2"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="goal-minutes" className="text-caption">
                    Minutes
                  </Label>
                  <Input
                    id="goal-minutes"
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    value={goalMinutes}
                    onChange={(e) => setGoalMinutes(Number(e.target.value) || 30)}
                    className="w-24 rounded-control border-border bg-surface-2 font-mono text-caption tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="goal-difficulty" className="text-caption">
                    Difficulty (1–5)
                  </Label>
                  <Input
                    id="goal-difficulty"
                    type="number"
                    min={1}
                    max={5}
                    value={goalDifficulty}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(5, Number(e.target.value) || 3)) as Rating;
                      setGoalDifficulty(val);
                    }}
                    className="w-20 rounded-control border-border bg-surface-2 font-mono text-caption tabular-nums"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addStudyGoal}
                  className="gap-1 rounded-control"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add
                </Button>
              </div>
            </div>

            {draft.studyGoals.length > 0 ? (
              <ul className="space-y-2">
                {draft.studyGoals.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body text-foreground">{g.subject}</p>
                      <p className="font-mono text-caption text-muted-foreground tabular-nums">
                        {g.minutes}m{g.difficulty ? ` · diff ${g.difficulty}/5` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove study goal ${g.subject}`}
                      onClick={() => removeStudyGoal(g.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        {/* Right: Timeline & Balance */}
        <div className="space-y-5 lg:col-span-7">
          {/* Neutral study vs recovery balance */}
          <Card className="space-y-3 rounded-card border border-border bg-surface p-5 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-section font-medium text-foreground">Day balance</h2>
              <span className="font-mono text-caption text-muted-foreground">
                {draft.usedHistoryWindows
                  ? "Using your best Focus Lab hours"
                  : "Using default daytime windows"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-control border border-border bg-surface-2 p-3">
                <p className="text-[11px] text-muted-foreground">Planned study</p>
                <p className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">
                  {formatMinutesLabel(balance.studyMin)}
                </p>
              </div>
              <div className="rounded-control border border-border bg-surface-2 p-3">
                <p className="text-[11px] text-muted-foreground">Breaks &amp; recovery</p>
                <p className="mt-0.5 font-mono text-body font-medium text-cyan tabular-nums">
                  {formatMinutesLabel(balance.recoveryMin)}
                </p>
              </div>
              <div className="rounded-control border border-border bg-surface-2 p-3">
                <p className="text-[11px] text-muted-foreground">Movement</p>
                <p className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">
                  {formatMinutesLabel(balance.movementMin)}
                </p>
              </div>
              <div className="rounded-control border border-border bg-surface-2 p-3">
                <p className="text-[11px] text-muted-foreground">Protected sleep</p>
                <p className="mt-0.5 font-mono text-body font-medium text-foreground tabular-nums">
                  {formatMinutesLabel(balance.sleepMin)}
                </p>
              </div>
            </div>
          </Card>

          {/* Unscheduled notice */}
          {draft.unscheduled.length > 0 ? (
            <Card className="space-y-2.5 rounded-card border border-border-strong bg-surface p-5 shadow-none">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-cyan" aria-hidden />
                <h2 className="text-section font-medium text-foreground">
                  Left unscheduled to protect sleep &amp; breaks
                </h2>
              </div>
              <ul className="space-y-2">
                {draft.unscheduled.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-control border border-border bg-surface-2 px-3.5 py-2.5 text-caption"
                  >
                    <p className="font-medium text-foreground">
                      {item.title} ({formatMinutesLabel(item.minutes)})
                    </p>
                    <p className="text-muted-foreground">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Timeline */}
          <div className="space-y-3">
            <h2 className="text-section font-medium text-foreground">
              Timeline ({draft.date})
            </h2>

            {draft.blocks.length === 0 ? (
              <EmptyState
                title="No blocks on the timeline"
                description="Add a commitment or study goal on the left and click Generate."
              />
            ) : (
              <ul className="space-y-2.5">
                {draft.blocks.map((block) => {
                  const badge = BLOCK_BADGES[block.kind];
                  return (
                    <li
                      key={block.id}
                      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("rounded-chip font-mono text-[11px]", badge.className)}
                          >
                            {badge.label}
                          </Badge>
                          <span className="text-body font-medium text-foreground">
                            {block.title}
                          </span>
                          <span className="font-mono text-caption text-muted-foreground tabular-nums">
                            {block.durationMin}m
                          </span>
                        </div>
                        {block.notes ? (
                          <p className="text-caption text-muted-foreground">{block.notes}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${block.title} start time`}
                          value={block.startTime}
                          onChange={(e) => updateBlockTime(block.id, "startTime", e.target.value)}
                          className="h-8 w-26 rounded-control border-border bg-surface-2 font-mono text-caption tabular-nums"
                        />
                        <span className="text-caption text-muted-foreground">–</span>
                        <Input
                          type="time"
                          aria-label={`${block.title} end time`}
                          value={block.endTime}
                          onChange={(e) => updateBlockTime(block.id, "endTime", e.target.value)}
                          className="h-8 w-26 rounded-control border-border bg-surface-2 font-mono text-caption tabular-nums"
                        />

                        {block.kind === "study" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => startStudyBlock(block)}
                            className="h-8 gap-1 rounded-control bg-violet px-2.5 text-caption text-white hover:bg-violet/90"
                          >
                            <Play className="size-3" aria-hidden />
                            Start this block
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlannerSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-52 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[520px] rounded-card lg:col-span-5" />
        <Skeleton className="h-[520px] rounded-card lg:col-span-7" />
      </div>
    </div>
  );
}
