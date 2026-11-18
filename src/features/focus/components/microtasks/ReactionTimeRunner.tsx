"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MICROTASKS_FRAMING_POINTS,
  REACTION_PRACTICE_COUNT,
  REACTION_TRIAL_COUNT,
  classifyReactionAttempt,
  sampleReactionDelayMs,
  summarizeReactionTrials,
} from "@/features/focus/microtasks";
import { cn } from "@/lib/utils";
import type { MicrotaskInputType, ReactionTimeMetrics } from "@/types/domain";

export interface ReactionTimeRunnerProps {
  practiceMode: boolean;
  reducedMotion: boolean;
  onComplete: (metrics: ReactionTimeMetrics, inputType: MicrotaskInputType) => void;
  onCancel: () => void;
}

type Phase = "intro" | "waiting" | "cue" | "feedback" | "done";

export function ReactionTimeRunner({
  practiceMode,
  reducedMotion,
  onComplete,
  onCancel,
}: ReactionTimeRunnerProps) {
  const totalTrials = practiceMode ? REACTION_PRACTICE_COUNT : REACTION_TRIAL_COUNT;

  const [phase, setPhase] = useState<Phase>("intro");
  const [trialsMs, setTrialsMs] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isFalseStartNote, setIsFalseStartNote] = useState(false);

  const cuePaintedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastInputRef = useRef<MicrotaskInputType>("mouse");

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const startNextTrial = useCallback(() => {
    clearTimers();
    cuePaintedAtRef.current = null;
    setIsFalseStartNote(false);
    setPhase("waiting");
    const delayMs = sampleReactionDelayMs();
    timerRef.current = window.setTimeout(() => {
      setPhase("cue");
      rafRef.current = window.requestAnimationFrame(() => {
        cuePaintedAtRef.current = performance.now();
      });
    }, delayMs);
  }, [clearTimers]);

  const handleResetAndStart = useCallback(() => {
    completedRef.current = false;
    setTrialsMs([]);
    setFalseStarts(0);
    setLastMessage(null);
    startNextTrial();
  }, [startNextTrial]);

  const handleAction = useCallback(
    (inputType: MicrotaskInputType) => {
      if (phase !== "waiting" && phase !== "cue") return;
      lastInputRef.current = inputType;

      if (phase === "waiting") {
        clearTimers();
        setFalseStarts((n) => n + 1);
        setIsFalseStartNote(true);
        setLastMessage("Too soon — wait for the teal cue before tapping. Repeating this trial.");
        setPhase("feedback");
        timerRef.current = window.setTimeout(() => {
          startNextTrial();
        }, 1050);
        return;
      }

      // phase === "cue"
      const paintedAt = cuePaintedAtRef.current;
      const elapsed = paintedAt === null ? 0 : performance.now() - paintedAt;
      if (classifyReactionAttempt(elapsed) === "false_start") {
        clearTimers();
        setFalseStarts((n) => n + 1);
        setIsFalseStartNote(true);
        setLastMessage(
          "Response arrived under 100 ms (likely anticipated) — repeating this trial gently.",
        );
        setPhase("feedback");
        timerRef.current = window.setTimeout(() => {
          startNextTrial();
        }, 1050);
        return;
      }

      const rounded = Math.round(elapsed);
      const nextTrials = [...trialsMs, rounded];
      setTrialsMs(nextTrials);
      setIsFalseStartNote(false);
      setLastMessage(`${rounded} ms recorded.`);
      cuePaintedAtRef.current = null;

      if (nextTrials.length >= totalTrials) {
        setPhase("done");
        if (!completedRef.current) {
          completedRef.current = true;
          const summary = summarizeReactionTrials(nextTrials, falseStarts);
          onComplete(summary, inputType);
        }
        return;
      }

      setPhase("feedback");
      timerRef.current = window.setTimeout(() => {
        startNextTrial();
      }, 750);
    },
    [clearTimers, falseStarts, onComplete, phase, startNextTrial, totalTrials, trialsMs],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clearTimers();
        onCancel();
        return;
      }
      if (event.code === "Space" && (phase === "waiting" || phase === "cue")) {
        event.preventDefault();
        handleAction("keyboard");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearTimers, handleAction, onCancel, phase]);

  const handleStagePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const detected: MicrotaskInputType =
      e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse";
    handleAction(detected);
  };

  const summary = phase === "done" ? summarizeReactionTrials(trialsMs, falseStarts) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={practiceMode ? "Reaction time practice round" : "Reaction time microtask"}
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-card border border-border-strong bg-surface p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
            {practiceMode ? "Practice round" : "Reaction time"}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            Trial {Math.min(trialsMs.length + (phase === "done" ? 0 : 1), totalTrials)} of{" "}
            {totalTrials}
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
          <p className="text-body leading-relaxed text-foreground">
            Wait quietly for 1 to 4 seconds until the panel shifts to teal, then click, tap, or
            press <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-caption">Space</kbd>{" "}
            once. Responses under 100 ms count as false starts and repeat gently.
          </p>
          <ul className="space-y-1 rounded-control border border-border bg-surface-2/60 p-3 text-caption text-muted-foreground">
            {MICROTASKS_FRAMING_POINTS.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              onClick={handleResetAndStart}
              className="rounded-control bg-violet text-white hover:bg-violet/90"
            >
              {practiceMode ? "Start practice round" : "Start 5 trials"}
            </Button>
          </div>
        </div>
      ) : phase === "done" && summary ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Median</p>
              <p className="mt-1 font-mono text-title font-semibold text-cyan tabular-nums">
                {summary.medianMs} ms
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Fastest trial</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {summary.bestMs} ms
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">False starts</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {summary.falseStarts}
              </p>
            </div>
          </div>

          <p className="font-mono text-caption text-muted-foreground tabular-nums">
            Trials: {summary.trialsMs.map((t) => `${t} ms`).join(" · ")}
          </p>

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
                onClick={handleResetAndStart}
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
            onPointerDown={handleStagePointerDown}
            disabled={phase === "feedback"}
            aria-label={
              phase === "cue"
                ? "Respond now! Tap, click, or press Space"
                : phase === "waiting"
                  ? "Wait for teal color cue"
                  : "Preparing next trial"
            }
            className={cn(
              "flex min-h-[260px] w-full flex-col items-center justify-center gap-2 rounded-card border-2 px-6 text-center select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              reducedMotion ? "" : "transition-colors duration-75",
              phase === "cue"
                ? "border-cyan bg-cyan/20 text-foreground"
                : phase === "waiting"
                  ? "border-border-strong bg-[#060913] text-muted-foreground"
                  : "border-border bg-surface-2 text-foreground",
            )}
          >
            <span className="font-mono text-2xl font-semibold">
              {phase === "cue"
                ? "Tap now!"
                : phase === "waiting"
                  ? "Wait for teal…"
                  : isFalseStartNote
                    ? "Too soon"
                    : lastMessage}
            </span>
            <span className="text-caption text-muted-foreground">
              {phase === "cue"
                ? "Click, tap anywhere here, or press Space"
                : phase === "waiting"
                  ? "Keep hands steady until the cue changes"
                  : lastMessage}
            </span>
          </button>
          <p aria-live="polite" className="min-h-5 text-center text-caption text-muted-foreground">
            {phase === "feedback" ? lastMessage : ""}
          </p>
        </div>
      )}
    </div>
  );
}
