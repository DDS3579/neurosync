"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { playSoftChime } from "@/features/mind/chimeAudio";
import {
  BREATHING_PATTERNS,
  BREATHING_PRESETS_MIN,
  MEDITATION_PRESETS_MIN,
  MINDFULNESS_TYPE_LABELS,
  computeBreathingPhase,
  formatMindClock,
  type BreathingPatternId,
} from "@/features/mind/mindUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { cn } from "@/lib/utils";
import type { MindfulnessSession, MindfulnessType } from "@/types/domain";

export interface BreathingMeditationCardProps {
  sessions: MindfulnessSession[];
  onCreateSession: (
    values: Omit<MindfulnessSession, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
}

type MindMode = "breathing" | "meditation";

interface TimerRunState {
  status: "idle" | "running" | "paused";
  accumulatedMs: number;
  segmentStartMs: number | null;
}

const IDLE_RUN: TimerRunState = {
  status: "idle",
  accumulatedMs: 0,
  segmentStartMs: null,
};

export function BreathingMeditationCard({
  sessions,
  onCreateSession,
  onDeleteSession,
}: BreathingMeditationCardProps) {
  const reducedMotion = usePrefersReducedMotion();

  const [mode, setMode] = useState<MindMode>("breathing");
  const [pattern, setPattern] = useState<BreathingPatternId>("box_breathing");
  const [breathingMin, setBreathingMin] = useState<number>(2);
  const [meditationMin, setMeditationMin] = useState<number>(10);
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(false);
  const [run, setRun] = useState<TimerRunState>(IDLE_RUN);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [saving, setSaving] = useState<boolean>(false);

  const completedGuardRef = useRef<boolean>(false);

  const activeDurationMin = mode === "breathing" ? breathingMin : meditationMin;
  const totalMs = activeDurationMin * 60_000;
  const activeType: MindfulnessType = mode === "breathing" ? pattern : "meditation";

  const elapsedMs =
    run.status === "running" && run.segmentStartMs !== null
      ? run.accumulatedMs + Math.max(0, nowMs - run.segmentStartMs)
      : run.accumulatedMs;

  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const progress = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0;

  useEffect(() => {
    if (run.status !== "running") return;
    const intervalMs = mode === "breathing" && !reducedMotion ? 50 : 250;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);

      const currentElapsed =
        run.segmentStartMs !== null
          ? run.accumulatedMs + Math.max(0, current - run.segmentStartMs)
          : run.accumulatedMs;

      if (currentElapsed >= totalMs && !completedGuardRef.current) {
        completedGuardRef.current = true;
        setRun(IDLE_RUN);
        if (chimeEnabled) {
          playSoftChime();
        }
        setSaving(true);
        void onCreateSession({
          date: toLocalISODate(),
          type: activeType,
          durationMin: activeDurationMin,
        })
          .then(() => {
            toast.success(
              `Saved ${activeDurationMin} min of ${MINDFULNESS_TYPE_LABELS[activeType].toLowerCase()}.`,
            );
          })
          .finally(() => {
            setSaving(false);
          });
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [
    activeDurationMin,
    activeType,
    chimeEnabled,
    mode,
    onCreateSession,
    reducedMotion,
    run.accumulatedMs,
    run.segmentStartMs,
    run.status,
    totalMs,
  ]);

  const startOrResume = () => {
    completedGuardRef.current = false;
    const now = Date.now();
    setNowMs(now);
    setRun((prev) => ({
      status: "running",
      accumulatedMs: prev.status === "paused" ? prev.accumulatedMs : 0,
      segmentStartMs: now,
    }));
  };

  const pauseTimer = () => {
    const now = Date.now();
    setNowMs(now);
    setRun((prev) => {
      if (prev.status !== "running" || prev.segmentStartMs === null) return prev;
      return {
        status: "paused",
        accumulatedMs: prev.accumulatedMs + Math.max(0, now - prev.segmentStartMs),
        segmentStartMs: null,
      };
    });
  };

  const resetTimer = () => {
    completedGuardRef.current = false;
    setRun(IDLE_RUN);
  };

  const switchMode = (next: MindMode) => {
    if (next === mode) return;
    completedGuardRef.current = false;
    setRun(IDLE_RUN);
    setMode(next);
  };

  const finishEarlyAndSave = async () => {
    const completedMin = Math.max(1, Math.round(elapsedMs / 60_000));
    completedGuardRef.current = true;
    setRun(IDLE_RUN);
    setSaving(true);
    try {
      await onCreateSession({
        date: toLocalISODate(),
        type: activeType,
        durationMin: completedMin,
      });
      toast.success(
        `Saved ${completedMin} min of ${MINDFULNESS_TYPE_LABELS[activeType].toLowerCase()}.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const phase = useMemo(
    () => computeBreathingPhase(pattern, run.status === "idle" ? 0 : elapsedMs),
    [elapsedMs, pattern, run.status],
  );

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      }),
    [sessions],
  );

  const ringRadius = 74;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress);

  const isLocked = run.status !== "idle";

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-7">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-section font-medium text-foreground">
                Breathing &amp; meditation
              </h2>
              <p className="text-caption text-muted-foreground">
                Quiet pacing with optional Web Audio chime. Sessions feed the Brain Explorer&apos;s
                mindfulness view.
              </p>
            </div>

            <div
              role="group"
              aria-label="Practice mode"
              className="inline-flex rounded-control border border-border bg-surface-2 p-1"
            >
              {(["breathing", "meditation"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    "rounded-[7px] px-3 py-1.5 text-caption font-medium capitalize transition-colors",
                    mode === m
                      ? "bg-violet text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {mode === "breathing" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {(["box_breathing", "4_7_8_breathing"] as const).map((id) => {
                const spec = BREATHING_PATTERNS[id];
                const selected = pattern === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setPattern(id)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-control border p-3 text-left transition-colors disabled:opacity-60",
                      selected
                        ? "border-cyan/60 bg-surface-2 text-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body font-medium text-foreground">{spec.label}</span>
                      <span className="font-mono text-caption text-cyan tabular-nums">
                        {spec.cadenceLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-caption text-muted-foreground">{spec.description}</p>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Duration presets">
              <span className="mr-1 text-caption text-muted-foreground">Duration:</span>
              {(mode === "breathing" ? BREATHING_PRESETS_MIN : MEDITATION_PRESETS_MIN).map((min) => {
                const selected = activeDurationMin === min;
                return (
                  <button
                    key={min}
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      mode === "breathing" ? setBreathingMin(min) : setMeditationMin(min)
                    }
                    aria-pressed={selected}
                    className={cn(
                      "rounded-chip border px-3 py-1 font-mono text-caption tabular-nums transition-colors disabled:opacity-60",
                      selected
                        ? "border-cyan/60 bg-cyan/10 text-cyan"
                        : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {min}m
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {chimeEnabled ? (
                <Volume2 className="size-4 text-cyan" aria-hidden />
              ) : (
                <VolumeX className="size-4 text-muted-foreground" aria-hidden />
              )}
              <Label htmlFor="mind-chime-switch" className="text-caption text-muted-foreground">
                Soft chime
              </Label>
              <Switch
                id="mind-chime-switch"
                checked={chimeEnabled}
                onCheckedChange={setChimeEnabled}
              />
            </div>
          </div>

          {/* Visual Guide Stage */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-border bg-surface-2/60 px-4 py-7">
            <div className="relative flex size-44 items-center justify-center">
              <svg
                viewBox="0 0 176 176"
                className="size-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="88"
                  cy="88"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="4"
                />
                <circle
                  cx="88"
                  cy="88"
                  r={ringRadius}
                  fill="none"
                  stroke={mode === "breathing" ? "#22D3EE" : "#8B5CF6"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>

              {mode === "breathing" ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute size-32 rounded-full border border-cyan/35 bg-cyan/10",
                    reducedMotion ? "transition-none" : "transition-transform duration-75 ease-linear",
                  )}
                  style={{
                    transform: reducedMotion
                      ? "scale(1)"
                      : `scale(${run.status === "idle" ? 0.72 : phase.scale.toFixed(3)})`,
                  }}
                />
              ) : null}

              <div
                aria-live="off"
                className="relative z-10 flex flex-col items-center text-center"
              >
                {mode === "breathing" ? (
                  <>
                    <span className="text-section font-medium text-foreground">
                      {run.status === "idle" ? "Ready" : phase.label}
                    </span>
                    <span className="mt-0.5 font-mono text-2xl font-medium text-cyan tabular-nums">
                      {run.status === "idle"
                        ? formatMindClock(totalMs)
                        : `${phase.phaseRemainingSec}s`}
                    </span>
                    <span className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {run.status === "idle"
                        ? `${BREATHING_PATTERNS[pattern].cadenceLabel}`
                        : `${formatMindClock(remainingMs)} left · Cycle ${phase.cycleNumber}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-caption tracking-wide text-muted-foreground uppercase">
                      {run.status === "idle"
                        ? "Ready"
                        : run.status === "paused"
                          ? "Paused"
                          : "Quiet timer"}
                    </span>
                    <span className="mt-1 font-mono text-3xl font-medium text-foreground tabular-nums">
                      {formatMindClock(remainingMs)}
                    </span>
                    <span className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {meditationMin} min session
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Announces phase/status changes politely without announcing every second tick */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {run.status === "paused"
                ? "Session paused."
                : run.status === "running" && mode === "breathing"
                  ? `${phase.label} for ${phase.phaseDurationSec} seconds.`
                  : run.status === "running"
                    ? `${meditationMin} minute meditation timer running.`
                    : ""}
            </div>

            {mode === "breathing" && run.status !== "idle" ? (
              <div className="w-full max-w-xs space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-cyan"
                    style={{ width: `${Math.round(phase.phaseProgress * 100)}%` }}
                  />
                </div>
                <p className="text-center font-mono text-[11px] text-muted-foreground tabular-nums">
                  {phase.label} ({phase.phaseDurationSec}s)
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {run.status === "running" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={pauseTimer}
                  className="gap-1.5 rounded-control"
                >
                  <Pause className="size-4" aria-hidden />
                  Pause
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={startOrResume}
                  className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  <Play className="size-4" aria-hidden />
                  {run.status === "paused" ? "Resume" : "Start"}
                </Button>
              )}

              {run.status !== "idle" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetTimer}
                    className="gap-1.5 rounded-control"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Reset
                  </Button>
                  {elapsedMs >= 30_000 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void finishEarlyAndSave()}
                      className="rounded-control"
                    >
                      Finish &amp; log
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Past mindfulness sessions */}
      <div className="space-y-3 lg:col-span-5">
        <h2 className="text-section font-medium text-foreground">Past mindfulness sessions</h2>
        {sortedSessions.length === 0 ? (
          <EmptyState
            title="No mindfulness sessions yet"
            description="Completed breathing and meditation sessions appear here and feed Brain Explorer."
          />
        ) : (
          <ul className="space-y-2.5">
            {sortedSessions.slice(0, 10).map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-caption text-cyan tabular-nums">
                      {session.date}
                    </span>
                    <span className="text-body font-medium text-foreground">
                      {MINDFULNESS_TYPE_LABELS[session.type]}
                    </span>
                  </div>
                  <p className="font-mono text-caption text-muted-foreground tabular-nums">
                    {session.durationMin} min
                  </p>
                </div>

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${MINDFULNESS_TYPE_LABELS[session.type]} session on ${session.date}`}
                  onClick={async () => {
                    await onDeleteSession(session.id);
                    toast.success(`Removed mindfulness session for ${session.date}.`);
                  }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
