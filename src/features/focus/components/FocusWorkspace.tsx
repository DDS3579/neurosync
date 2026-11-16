"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, CheckCircle2, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  DurationInput,
  EmptyState,
  PageHeader,
  RatingInput,
  StatCard,
} from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  computeElapsedMs,
  computeRemainingMs,
  deserializeRunningSession,
  FOCUS_PRESETS,
  FOCUS_STORAGE_KEY,
  focusCompleteSchema,
  focusSetupSchema,
  formatTimerClock,
  incrementDistractions,
  isSessionPaused,
  LEARNING_METHOD_OPTIONS,
  pauseRunningSession,
  resumeRunningSession,
  serializeRunningSession,
  startRunningSession,
  summarizeFocusTotals,
  type FocusCompleteValues,
  type FocusSetupValues,
  type RunningFocusSession,
} from "@/features/focus/timerUtils";
import type { FocusSession } from "@/types/domain";

export interface FocusWorkspaceProps {
  defaultFocusMin: number;
  sessions: FocusSession[];
  onCreateSession: (values: Omit<FocusSession, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
}

function readNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function FocusWorkspace({
  defaultFocusMin,
  sessions,
  onCreateSession,
  onDeleteSession,
}: FocusWorkspaceProps) {
  const [running, setRunning] = useState<RunningFocusSession | null>(() => {
    if (typeof window === "undefined") return null;
    return deserializeRunningSession(window.localStorage.getItem(FOCUS_STORAGE_KEY));
  });
  const [finishing, setFinishing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notifiedSessionIdRef = useRef<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => readNotificationPermission(),
  );

  const setupForm = useForm<FocusSetupValues>({
    resolver: zodResolver(focusSetupSchema),
    defaultValues: {
      subject: "",
      method: "active_recall",
      plannedMin: defaultFocusMin || 25,
    },
  });

  const completeForm = useForm<FocusCompleteValues>({
    resolver: zodResolver(focusCompleteSchema),
    defaultValues: {
      durationMin: defaultFocusMin || 25,
      focusRating: 3,
      difficulty: 3,
      notes: "",
    },
  });

  // Persist active running session in localStorage so reloads resume cleanly.
  const persistRunning = (next: RunningFocusSession | null) => {
    setRunning(next);
    if (typeof window === "undefined") return;
    if (next) {
      window.localStorage.setItem(FOCUS_STORAGE_KEY, serializeRunningSession(next));
    } else {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
    }
  };

  const paused = running ? isSessionPaused(running) : false;

  // Timestamp-driven display refresh: never increments a counter, only reads Date.now().
  useEffect(() => {
    if (!running || paused || finishing) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(id);
  }, [running, paused, finishing]);

  const elapsedMs = running ? computeElapsedMs(running, nowMs) : 0;
  const remainingMs = running ? computeRemainingMs(running, nowMs) : 0;
  const plannedMs = running ? Math.max(1, running.plannedMin * 60_000) : 1;
  const progressPct = running ? Math.min(100, Math.round((elapsedMs / plannedMs) * 100)) : 0;
  const reachedTarget = Boolean(running && remainingMs === 0);

  // Fire optional break reminder notification once when timer finishes (only if granted).
  useEffect(() => {
    if (!running || !reachedTarget || running.notifiedComplete) return;
    if (notifiedSessionIdRef.current === running.id) return;

    notifiedSessionIdRef.current = running.id;
    const updated: RunningFocusSession = { ...running, notifiedComplete: true };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FOCUS_STORAGE_KEY, serializeRunningSession(updated));
    }

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("Focus session complete", {
        body: `Planned ${running.plannedMin}m on ${running.subject} finished. Take a short break before logging.`,
      });
    }
  }, [running, reachedTarget]);

  const totals = useMemo(() => summarizeFocusTotals(sessions), [sessions]);
  const sortedHistory = useMemo(
    () => [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions],
  );

  const onStartSession = (values: FocusSetupValues) => {
    const parsed = focusSetupSchema.parse(values);
    const session = startRunningSession({
      subject: parsed.subject,
      method: parsed.method,
      plannedMin: parsed.plannedMin,
    });
    setNowMs(session.startedAtMs);
    setFinishing(false);
    persistRunning(session);
  };

  const openFinishForm = () => {
    if (!running) return;
    const now = Date.now();
    setNowMs(now);
    const elapsedMin = Math.max(1, Math.round(computeElapsedMs(running, now) / 60_000));
    completeForm.reset({
      durationMin: elapsedMin,
      focusRating: 3,
      difficulty: 3,
      notes: "",
    });
    setFinishing(true);
  };

  const onCompleteSession = async (values: FocusCompleteValues) => {
    if (!running) return;
    const parsed = focusCompleteSchema.parse(values);
    await onCreateSession({
      date: running.date,
      startedAt: running.startedAtISO,
      durationMin: parsed.durationMin,
      plannedMin: running.plannedMin,
      subject: running.subject,
      method: running.method,
      focusRating: parsed.focusRating,
      difficulty: parsed.difficulty,
      distractions: running.distractions,
      notes: parsed.notes?.trim() || undefined,
    });
    toast.success(`Saved ${parsed.durationMin}m focus session on ${running.subject}.`);
    setFinishing(false);
    persistRunning(null);
    setupForm.reset({
      subject: "",
      method: running.method,
      plannedMin: defaultFocusMin || 25,
    });
  };

  const requestBreakReminder = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.info("Browser notifications are unavailable here.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      toast.success("Break reminder notifications enabled.");
    } else {
      toast.info("Notifications were not enabled; inline break reminders will still appear.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Focus Lab"
        description="Timestamp-accurate sessions with subject, learning method, distractions, and post-session reflection."
      />

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Focus today"
          value={totals.todayMinutes}
          unit="min"
          hint={`${totals.todayCount} ${totals.todayCount === 1 ? "session" : "sessions"}`}
          accent="cyan"
        />
        <StatCard
          label="Focus this week"
          value={totals.weekMinutes}
          unit="min"
          hint={`${totals.weekCount} ${totals.weekCount === 1 ? "session" : "sessions"} since Monday`}
          accent="violet"
        />
        <StatCard
          label="All logged sessions"
          value={sessions.length}
          hint="Stored locally in IndexedDB"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Timer / Setup / Completion stage */}
        <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-6">
          {!running ? (
            <form onSubmit={setupForm.handleSubmit(onStartSession)} className="space-y-6" noValidate>
              <div className="space-y-1">
                <h2 className="text-section font-medium text-foreground">Start a focus session</h2>
                <p className="text-caption text-muted-foreground">
                  The timer runs on timestamps so refreshing or switching tabs never loses time.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="focus-subject">Subject</Label>
                <Input
                  id="focus-subject"
                  placeholder="e.g. Linear algebra, Spanish reading, Code review"
                  {...setupForm.register("subject")}
                  className="rounded-control border-border bg-surface-2"
                />
                {setupForm.formState.errors.subject ? (
                  <p role="alert" className="text-caption text-danger">
                    {setupForm.formState.errors.subject.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="focus-method">Learning method</Label>
                <Controller
                  control={setupForm.control}
                  name="method"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="focus-method"
                        className="w-full rounded-control border-border bg-surface-2"
                      >
                        <SelectValue placeholder="Choose method" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEARNING_METHOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Controller
                  control={setupForm.control}
                  name="plannedMin"
                  render={({ field }) => (
                    <DurationInput
                      label="Planned length"
                      valueMin={field.value}
                      onChange={field.onChange}
                      presets={[...FOCUS_PRESETS]}
                    />
                  )}
                />
                {setupForm.formState.errors.plannedMin ? (
                  <p role="alert" className="text-caption text-danger">
                    {setupForm.formState.errors.plannedMin.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                {notifPermission !== "unsupported" && notifPermission !== "granted" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={requestBreakReminder}
                    className="gap-1.5 text-caption text-muted-foreground"
                  >
                    <Bell className="size-3.5" aria-hidden />
                    Enable break notification
                  </Button>
                ) : (
                  <span className="font-mono text-caption text-muted-foreground">
                    {notifPermission === "granted"
                      ? "Break notification ready"
                      : "Inline break prompt active"}
                  </span>
                )}

                <Button
                  type="submit"
                  className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  <Play className="size-4" aria-hidden />
                  Start session
                </Button>
              </div>
            </form>
          ) : finishing ? (
            <form
              onSubmit={completeForm.handleSubmit(onCompleteSession)}
              className="space-y-6"
              noValidate
            >
              <div className="space-y-1 border-b border-border pb-4">
                <p className="font-mono text-caption text-cyan">
                  {running.subject} ·{" "}
                  {LEARNING_METHOD_OPTIONS.find((m) => m.value === running.method)?.label}
                </p>
                <h2 className="text-section font-medium text-foreground">
                  How did this session feel?
                </h2>
              </div>

              <div className="space-y-2">
                <Controller
                  control={completeForm.control}
                  name="durationMin"
                  render={({ field }) => (
                    <DurationInput
                      label="Actual duration"
                      valueMin={field.value}
                      onChange={field.onChange}
                      presets={[15, 25, 50, 90]}
                    />
                  )}
                />
                {completeForm.formState.errors.durationMin ? (
                  <p role="alert" className="text-caption text-danger">
                    {completeForm.formState.errors.durationMin.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  control={completeForm.control}
                  name="focusRating"
                  render={({ field }) => (
                    <RatingInput
                      label="Focus quality"
                      value={field.value}
                      onChange={field.onChange}
                      lowLabel="Scattered"
                      highLabel="Locked in"
                    />
                  )}
                />
                <Controller
                  control={completeForm.control}
                  name="difficulty"
                  render={({ field }) => (
                    <RatingInput
                      label="Material difficulty"
                      value={field.value}
                      onChange={field.onChange}
                      lowLabel="Easy"
                      highLabel="Stretching"
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="focus-notes">Notes (optional)</Label>
                <Textarea
                  id="focus-notes"
                  rows={3}
                  placeholder="What clicked or what pulled your attention?"
                  {...completeForm.register("notes")}
                  className="rounded-control border-border bg-surface-2"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFinishing(false)}
                  className="rounded-control"
                >
                  Back to timer
                </Button>
                <Button
                  type="submit"
                  disabled={completeForm.formState.isSubmitting}
                  className="rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  Save session
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="font-mono text-caption text-cyan">
                    {LEARNING_METHOD_OPTIONS.find((m) => m.value === running.method)?.label}
                  </p>
                  <h2 className="mt-1 text-section font-medium text-foreground">
                    {running.subject}
                  </h2>
                </div>
                <span className="rounded-chip border border-border bg-surface-2 px-2.5 py-1 font-mono text-caption text-muted-foreground tabular-nums">
                  Planned {running.plannedMin}m
                </span>
              </div>

              {reachedTarget ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-control border border-cyan/40 bg-cyan/10 px-4 py-3 text-body text-foreground"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-cyan" aria-hidden />
                  <span>
                    Target reached — take a short break, then log your session when ready.
                  </span>
                </div>
              ) : null}

              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p
                  aria-live="off"
                  className="font-mono text-5xl font-medium tracking-tight text-foreground tabular-nums"
                >
                  {formatTimerClock(remainingMs)}
                </p>
                <p className="font-mono text-caption text-muted-foreground tabular-nums">
                  Elapsed {formatTimerClock(elapsedMs)} · Distractions {running.distractions}
                  {paused ? " · Paused" : ""}
                </p>
                <Progress value={progressPct} className="mt-2 h-1.5 w-full max-w-sm" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {paused ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const now = Date.now();
                      setNowMs(now);
                      persistRunning(resumeRunningSession(running, now));
                    }}
                    className="gap-1.5 rounded-control"
                  >
                    <Play className="size-4" aria-hidden />
                    Resume
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const now = Date.now();
                      setNowMs(now);
                      persistRunning(pauseRunningSession(running, now));
                    }}
                    className="gap-1.5 rounded-control"
                  >
                    <Pause className="size-4" aria-hidden />
                    Pause
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => persistRunning(incrementDistractions(running))}
                  className="gap-1.5 rounded-control"
                >
                  <Plus className="size-4" aria-hidden />
                  Distraction ({running.distractions})
                </Button>

                <Button
                  type="button"
                  onClick={openFinishForm}
                  className="rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  Finish & log
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    persistRunning(null);
                    toast.info("Discarded active timer.");
                  }}
                  className="gap-1.5 rounded-control text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Discard
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Session history */}
        <div className="space-y-3 lg:col-span-6">
          <h2 className="text-section font-medium text-foreground">Session history</h2>
          {sortedHistory.length === 0 ? (
            <EmptyState
              title="No focus sessions yet"
              description="Completed sessions appear here with planned versus actual time and learning method."
            />
          ) : (
            <ul className="space-y-2.5">
              {sortedHistory.slice(0, 20).map((entry) => {
                const methodLabel =
                  LEARNING_METHOD_OPTIONS.find((m) => m.value === entry.method)?.label ??
                  entry.method;
                return (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-caption text-cyan tabular-nums">
                          {entry.date}
                        </span>
                        <span className="text-body font-medium text-foreground">
                          {entry.subject}
                        </span>
                        <span className="rounded-chip border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {methodLabel}
                        </span>
                      </div>
                      <p className="font-mono text-caption text-muted-foreground tabular-nums">
                        {entry.durationMin}m (planned {entry.plannedMin}m) · Focus{" "}
                        {entry.focusRating}/5 · Difficulty {entry.difficulty}/5 · Distractions{" "}
                        {entry.distractions}
                      </p>
                      {entry.notes ? (
                        <p className="text-body text-foreground/90">{entry.notes}</p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete focus session ${entry.subject} on ${entry.date}`}
                      onClick={async () => {
                        await onDeleteSession(entry.id);
                        toast.success(`Removed focus session "${entry.subject}".`);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function FocusSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-36 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[420px] rounded-card lg:col-span-6" />
        <Skeleton className="h-[420px] rounded-card lg:col-span-6" />
      </div>
    </div>
  );
}
