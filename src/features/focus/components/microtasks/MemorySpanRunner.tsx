"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FLASHING_STIMULI_NOTE,
  MEMORY_SPAN_PRACTICE_LENGTH,
  MEMORY_SPAN_START_LENGTH,
  MICROTASKS_FRAMING_POINTS,
  advanceSpanState,
  createInitialSpanState,
  evaluateSpanAttempt,
  generateSpanSequence,
  toMemorySpanMetrics,
  type SpanSessionState,
} from "@/features/focus/microtasks";
import { cn } from "@/lib/utils";
import type { MemorySpanMetrics, MicrotaskInputType } from "@/types/domain";

export interface MemorySpanRunnerProps {
  practiceMode: boolean;
  reducedMotion: boolean;
  onComplete: (metrics: MemorySpanMetrics, inputType: MicrotaskInputType) => void;
  onCancel: () => void;
}

type Phase = "intro" | "showing" | "recall" | "feedback" | "done";

const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

export function MemorySpanRunner({
  practiceMode,
  reducedMotion,
  onComplete,
  onCancel,
}: MemorySpanRunnerProps) {
  const startLen = practiceMode ? MEMORY_SPAN_PRACTICE_LENGTH : MEMORY_SPAN_START_LENGTH;

  const [phase, setPhase] = useState<Phase>("intro");
  const [spanState, setSpanState] = useState<SpanSessionState>(() =>
    createInitialSpanState(startLen),
  );
  const [sequence, setSequence] = useState<number[]>([]);
  const [litCell, setLitCell] = useState<number | null>(null);
  const [entered, setEntered] = useState<number[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string>("");

  const timersRef = useRef<number[]>([]);
  const lastInputRef = useRef<MicrotaskInputType>("mouse");
  const completedRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const presentRound = useCallback(
    (length: number) => {
      clearTimers();
      const nextSeq = generateSpanSequence(length);
      setSequence(nextSeq);
      setEntered([]);
      setLitCell(null);
      setFeedbackMsg(`Watch ${length} cells in order…`);
      setPhase("showing");

      const stepOnMs = 520;
      const stepOffMs = 220;
      const initialLeadMs = 350;

      nextSeq.forEach((cell, idx) => {
        const startAt = initialLeadMs + idx * (stepOnMs + stepOffMs);
        scheduleTimeout(() => setLitCell(cell), startAt);
        scheduleTimeout(() => setLitCell(null), startAt + stepOnMs);
      });

      const totalShowMs = initialLeadMs + nextSeq.length * (stepOnMs + stepOffMs) + 120;
      scheduleTimeout(() => {
        setLitCell(null);
        setFeedbackMsg(`Repeat the ${length}-cell sequence (click, tap, or press keys 1–9).`);
        setPhase("recall");
      }, totalShowMs);
    },
    [clearTimers, scheduleTimeout],
  );

  const handleStart = useCallback(() => {
    completedRef.current = false;
    const init = createInitialSpanState(startLen);
    setSpanState(init);
    presentRound(init.currentLength);
  }, [presentRound, startLen]);

  const handleCellPick = useCallback(
    (cell: number, inputType: MicrotaskInputType) => {
      if (phase !== "recall") return;
      lastInputRef.current = inputType;
      const nextEntered = [...entered, cell];
      setEntered(nextEntered);
      setLitCell(cell);
      scheduleTimeout(() => {
        setLitCell((curr) => (curr === cell ? null : curr));
      }, 140);

      if (nextEntered.length < sequence.length) return;

      const matched = evaluateSpanAttempt(sequence, nextEntered);
      if (practiceMode) {
        setFeedbackMsg(
          matched
            ? `Practice matched (${sequence.length} cells).`
            : "Practice round finished — watch the sequence and repeat in order.",
        );
        const nextState = advanceSpanState(spanState, matched);
        setSpanState(nextState);
        setPhase("done");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete(toMemorySpanMetrics(nextState), inputType);
        }
        return;
      }

      const nextState = advanceSpanState(spanState, matched);
      setSpanState(nextState);

      if (nextState.done) {
        setFeedbackMsg(
          matched
            ? `Reached maximum length (${nextState.longestSpan} items).`
            : `Task complete after two tries at length ${spanState.currentLength}.`,
        );
        setPhase("done");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete(toMemorySpanMetrics(nextState), inputType);
        }
        return;
      }

      setFeedbackMsg(
        matched
          ? `Matched length ${spanState.currentLength}. Moving to length ${nextState.currentLength}…`
          : `Did not match — one more round at length ${nextState.currentLength}…`,
      );
      setPhase("feedback");
      scheduleTimeout(() => {
        presentRound(nextState.currentLength);
      }, 950);
    },
    [entered, onComplete, phase, practiceMode, presentRound, scheduleTimeout, sequence, spanState],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clearTimers();
        onCancel();
        return;
      }
      if (phase === "recall" && event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        handleCellPick(Number(event.key) - 1, "keyboard");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearTimers, handleCellPick, onCancel, phase]);

  const metrics = toMemorySpanMetrics(spanState);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={practiceMode ? "Memory span practice round" : "Memory span microtask"}
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-card border border-border-strong bg-surface p-6 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
            {practiceMode ? "Practice round" : "Memory span (3×3)"}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {phase === "intro"
              ? `Starts at length ${startLen}`
              : phase === "done"
                ? `Longest sequence: ${metrics.longestSpan}`
                : `Current length: ${spanState.currentLength} · Tries used at length: ${spanState.failuresAtLength}/2`}
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
            Watch the cells light up one by one, then repeat the exact sequence by clicking,
            tapping, or pressing keys <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-caption">1–9</kbd>.
            {practiceMode
              ? " Practice runs one short 2-item round."
              : " Sequence grows by 1 when matched; the task ends after two misses at the same length."}
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
              {practiceMode ? "Start practice round" : "Start memory span"}
            </Button>
          </div>
        </div>
      ) : phase === "done" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Longest span</p>
              <p className="mt-1 font-mono text-title font-semibold text-cyan tabular-nums">
                {metrics.longestSpan} items
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Rounds completed</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {metrics.totalRounds}
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="font-mono text-[11px] text-muted-foreground">Missed rounds</p>
              <p className="mt-1 font-mono text-title font-semibold text-foreground tabular-nums">
                {metrics.failures}
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
        <div className="space-y-4">
          <p aria-live="polite" className="text-center text-caption text-foreground">
            {feedbackMsg}
          </p>

          <div
            role="group"
            aria-label="3 by 3 memory grid"
            className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-2.5"
          >
            {CELLS.map((cell) => {
              const active = litCell === cell;
              return (
                <button
                  key={cell}
                  type="button"
                  disabled={phase !== "recall"}
                  aria-label={`Grid cell ${cell + 1}`}
                  onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
                    const detected: MicrotaskInputType =
                      e.pointerType === "touch" || e.pointerType === "pen"
                        ? "touch"
                        : "mouse";
                    handleCellPick(cell, detected);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCellPick(cell, "keyboard");
                    }
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-card border-2 font-mono text-sm font-medium select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    reducedMotion ? "" : "transition-colors duration-100",
                    active
                      ? "border-cyan bg-cyan/35 text-foreground shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                      : phase === "recall"
                        ? "border-border-strong bg-surface-2 text-muted-foreground hover:border-cyan/50 hover:text-foreground"
                        : "border-border bg-[#060913] text-muted-foreground/40",
                  )}
                >
                  {cell + 1}
                </button>
              );
            })}
          </div>

          <p className="text-center font-mono text-caption text-muted-foreground tabular-nums">
            {phase === "recall" ? `${entered.length} / ${sequence.length} entered` : "Observe"}
          </p>
        </div>
      )}
    </div>
  );
}
