"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FLASHING_STIMULI_NOTE,
  GO_NO_GO_PRACTICE_COUNT,
  GO_NO_GO_RATIO,
  GO_NO_GO_STIMULUS_MS,
  GO_NO_GO_TRIAL_COUNT,
  MICROTASKS_FRAMING_POINTS,
  generateGoNoGoTrials,
  scoreGoNoGoTrials,
  type GoNoGoPlannedTrial,
  type GoNoGoTrialOutcome,
} from "@/features/focus/microtasks";
import { cn } from "@/lib/utils";
import type { GoNoGoMetrics, MicrotaskInputType } from "@/types/domain";

export interface GoNoGoRunnerProps {
  practiceMode: boolean;
  reducedMotion: boolean;
  onComplete: (metrics: GoNoGoMetrics, inputType: MicrotaskInputType) => void;
  onCancel: () => void;
}

type Phase = "intro" | "running" | "done";

export function GoNoGoRunner({
  practiceMode,
  reducedMotion,
  onComplete,
  onCancel,
}: GoNoGoRunnerProps) {
  const totalTrials = practiceMode ? GO_NO_GO_PRACTICE_COUNT : GO_NO_GO_TRIAL_COUNT;

  const [phase, setPhase] = useState<Phase>("intro");
  const [trialIndex, setTrialIndex] = useState(0);
  const [visibleCue, setVisibleCue] = useState<"go" | "nogo" | null>(null);
  const [acceptingResponse, setAcceptingResponse] = useState(false);
  const [statusNote, setStatusNote] = useState<string>("");
  const [finalMetrics, setFinalMetrics] = useState<GoNoGoMetrics | null>(null);

  const planRef = useRef<GoNoGoPlannedTrial[]>([]);
  const outcomesRef = useRef<GoNoGoTrialOutcome[]>([]);
  const trialIndexRef = useRef(0);
  const respondedThisTrialRef = useRef(false);
  const cuePaintedAtRef = useRef<number | null>(null);
  const inputTypeRef = useRef<MicrotaskInputType>("mouse");
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const runTrialAtRef = useRef<(idx: number) => void>(() => {});

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const runTrialAt = useCallback(
    (idx: number) => {
      const plan = planRef.current;
      if (idx >= plan.length) {
        const metrics = scoreGoNoGoTrials(outcomesRef.current);
        setFinalMetrics(metrics);
        setVisibleCue(null);
        setAcceptingResponse(false);
        setPhase("done");
        onComplete(metrics, inputTypeRef.current);
        return;
      }

      const trial = plan[idx]!;
      trialIndexRef.current = idx;
      respondedThisTrialRef.current = false;
      cuePaintedAtRef.current = null;
      outcomesRef.current[idx] = { cue: trial.cue, responded: false, reactionMs: null };

      setTrialIndex(idx);
      setVisibleCue(trial.cue);
      setAcceptingResponse(true);
      setStatusNote(trial.cue === "go" ? "Go cue" : "Hold still");

      rafRef.current = window.requestAnimationFrame(() => {
        cuePaintedAtRef.current = performance.now();
      });

      // Cue stays visible for ~500 ms, then inter-trial gap (1000-1500 ms)
      schedule(() => {
        setVisibleCue(null);
      }, GO_NO_GO_STIMULUS_MS);

      // Response window closes cleanly 350 ms into the gap
      schedule(() => {
        setAcceptingResponse(false);
      }, GO_NO_GO_STIMULUS_MS + 350);

      // Next trial after stimulus + random gap
      schedule(() => {
        runTrialAtRef.current(idx + 1);
      }, GO_NO_GO_STIMULUS_MS + trial.gapMs);
    },
    [onComplete, schedule],
  );

  useEffect(() => {
    runTrialAtRef.current = runTrialAt;
  }, [runTrialAt]);

  const handleStart = useCallback(() => {
    clearTimers();
    planRef.current = generateGoNoGoTrials(totalTrials, GO_NO_GO_RATIO);
    outcomesRef.current = [];
    setFinalMetrics(null);
    setVisibleCue(null);
    setPhase("running");
    schedule(() => {
      runTrialAt(0);
    }, 650);
  }, [clearTimers, runTrialAt, schedule, totalTrials]);

  const registerResponse = useCallback(
    (inputType: MicrotaskInputType) => {
      if (phase !== "running" || !acceptingResponse || respondedThisTrialRef.current) return;
      respondedThisTrialRef.current = true;
      inputTypeRef.current = inputType;
      const idx = trialIndexRef.current;
      const current = outcomesRef.current[idx];
      if (!current) return;

      const rt =
        cuePaintedAtRef.current !== null
          ? Math.max(0, Math.round(performance.now() - cuePaintedAtRef.current))
          : null;

      outcomesRef.current[idx] = {
        cue: current.cue,
        responded: true,
        reactionMs: current.cue === "go" ? rt : null,
      };
    },
    [acceptingResponse, phase],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clearTimers();
        onCancel();
        return;
      }
      if (event.code === "Space" && phase === "running") {
        event.preventDefault();
        registerResponse("keyboard");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearTimers, onCancel, phase, registerResponse]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={practiceMode ? "Go/No-Go practice round" : "Attention Go/No-Go microtask"}
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-card border border-border-strong bg-surface p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
            {practiceMode ? "Practice round" : "Attention (Go / No-Go)"}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            Trial {Math.min(trialIndex + 1, totalTrials)} of {totalTrials}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            clearTimers();
            onCancel();
          }}
          className="gap-1.5 rounded-control text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
          Cancel
        </Button>
      </div>

      {phase === "intro" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-control border border-cyan/40 bg-cyan/10 p-3">
              <span className="size-8 shrink-0 rounded-full bg-cyan" aria-hidden />
              <div>
                <p className="text-caption font-medium text-foreground">GO cue (Circle)</p>
                <p className="text-[11px] text-muted-foreground">
                  Tap, click, or press Space quickly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-control border border-violet/40 bg-violet/10 p-3">
              <span className="size-7 shrink-0 rotate-45 rounded-[4px] bg-violet" aria-hidden />
              <div>
                <p className="text-caption font-medium text-foreground">NO-GO cue (Diamond)</p>
                <p className="text-[11px] text-muted-foreground">Hold still — do not respond</p>
              </div>
            </div>
          </div>

          <p className="text-caption leading-relaxed text-muted-foreground">
            {totalTrials} brief cues (~500 ms each) separated by 1.0–1.5 s pauses.
          </p>
          <p role="note" className="rounded-control border border-cyan/30 bg-cyan/10 p-3 text-caption text-foreground">
            {FLASHING_STIMULI_NOTE}
          </p>
          <ul className="space-y-1 rounded-control border border-border bg-surface-2/60 p-3 text-caption text-muted-foreground">
            {MICROTASKS_FRAMING_POINTS.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleStart}
              className="rounded-control bg-violet text-white hover:bg-violet/90"
            >
              {practiceMode ? "Start practice round" : `Start ${totalTrials} trials`}
            </Button>
          </div>
        </div>
      ) : phase === "done" && finalMetrics ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Go hits</p>
              <p className="mt-1 font-mono text-title font-semibold text-cyan tabular-nums">
                {finalMetrics.hits} / {finalMetrics.goTrials}
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Go misses</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {finalMetrics.misses}
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">No-go commissions</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {finalMetrics.commissionErrors} / {finalMetrics.noGoTrials}
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Mean go RT</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {finalMetrics.meanReactionMs !== null ? `${finalMetrics.meanReactionMs} ms` : "—"}
              </p>
            </div>
          </div>

          <ul className="space-y-1 rounded-control border border-border bg-surface-2/60 p-3 text-caption text-muted-foreground">
            {MICROTASKS_FRAMING_POINTS.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption text-muted-foreground">
              {practiceMode
                ? "Practice finished — nothing saved yet."
                : "Saved to your Focus Lab trends."}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleStart}
                className="gap-1.5 rounded-control"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {practiceMode ? "Repeat practice" : "Run again"}
              </Button>
              <Button
                type="button"
                onClick={onCancel}
                className="rounded-control bg-violet text-white hover:bg-violet/90"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
              const detected: MicrotaskInputType =
                e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse";
              registerResponse(detected);
            }}
            aria-label={visibleCue === "go" ? "Go cue shown — tap or Space" : "Stimulus area"}
            className={cn(
              "flex min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-border-strong bg-[#060913] px-6 select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              reducedMotion ? "" : "transition-colors duration-75",
            )}
          >
            {visibleCue === "go" ? (
              <div className="flex flex-col items-center gap-2">
                <span className="size-20 rounded-full bg-cyan shadow-[0_0_28px_rgba(34,211,238,0.4)]" />
                <span className="font-mono text-caption text-cyan">GO — Tap / Space</span>
              </div>
            ) : visibleCue === "nogo" ? (
              <div className="flex flex-col items-center gap-2">
                <span className="size-16 rotate-45 rounded-[6px] bg-violet shadow-[0_0_24px_rgba(139,92,246,0.4)]" />
                <span className="font-mono text-caption text-violet-text">NO-GO — Hold still</span>
              </div>
            ) : (
              <span className="font-mono text-2xl text-muted-foreground/50" aria-hidden>
                +
              </span>
            )}
          </button>
          <p className="sr-only" aria-live="polite">
            {statusNote}
          </p>
        </div>
      )}
    </div>
  );
}
