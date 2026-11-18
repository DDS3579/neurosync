"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, Grid3X3, Info, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FLASHING_STIMULI_NOTE,
  MICROTASKS_FRAMING_POINTS,
  TIME_OF_DAY_LABELS,
  detectTimeOfDayBucket,
  markPracticeCompleted,
  readPracticeCompleted,
} from "@/features/focus/microtasks";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { cn } from "@/lib/utils";
import type {
  GoNoGoMetrics,
  MemorySpanMetrics,
  MicrotaskInputType,
  MicrotaskKind,
  MicrotaskResult,
  Rating,
  ReactionTimeMetrics,
} from "@/types/domain";
import { GoNoGoRunner } from "./GoNoGoRunner";
import { MemorySpanRunner } from "./MemorySpanRunner";
import { MicrotaskTrendsCard } from "./MicrotaskTrendsCard";
import { ReactionTimeRunner } from "./ReactionTimeRunner";

export type NewMicrotaskResultInput =
  | {
      date: string;
      timeOfDay: MicrotaskResult["timeOfDay"];
      restedRating?: Rating;
      inputType: MicrotaskInputType;
      task: "reaction_time";
      metrics: ReactionTimeMetrics;
    }
  | {
      date: string;
      timeOfDay: MicrotaskResult["timeOfDay"];
      restedRating?: Rating;
      inputType: MicrotaskInputType;
      task: "memory_span";
      metrics: MemorySpanMetrics;
    }
  | {
      date: string;
      timeOfDay: MicrotaskResult["timeOfDay"];
      restedRating?: Rating;
      inputType: MicrotaskInputType;
      task: "go_no_go";
      metrics: GoNoGoMetrics;
    };

export interface MicrotasksTabProps {
  results: readonly MicrotaskResult[];
  reducedMotion: boolean;
  onCreateResult: (values: NewMicrotaskResultInput) => Promise<void>;
  onDeleteResult: (id: string) => Promise<void>;
}

const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];
const PRACTICE_CHANGE_EVENT = "ns:microtask-practice-change";
const EMPTY_PRACTICE: Record<MicrotaskKind, boolean> = {
  reaction_time: false,
  memory_span: false,
  go_no_go: false,
};

function subscribePracticeStore(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(PRACTICE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PRACTICE_CHANGE_EVENT, callback);
  };
}

let cachedPracticeRaw: string | null = null;
let cachedPracticeSnapshot: Record<MicrotaskKind, boolean> = EMPTY_PRACTICE;

function getPracticeSnapshot(): Record<MicrotaskKind, boolean> {
  if (typeof window === "undefined") return EMPTY_PRACTICE;
  try {
    const raw = window.localStorage.getItem(
      "ns:ui:v1:microtask-practice-done",
    );
    if (raw === cachedPracticeRaw) return cachedPracticeSnapshot;
    cachedPracticeRaw = raw;
    cachedPracticeSnapshot = {
      reaction_time: readPracticeCompleted("reaction_time"),
      memory_span: readPracticeCompleted("memory_span"),
      go_no_go: readPracticeCompleted("go_no_go"),
    };
    return cachedPracticeSnapshot;
  } catch {
    return EMPTY_PRACTICE;
  }
}

const TASK_CARDS: ReadonlyArray<{
  task: MicrotaskKind;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Zap;
  flashes: boolean;
}> = [
  {
    task: "reaction_time",
    title: "Reaction time",
    subtitle: "5 trials · ~30s",
    description:
      "Wait 1–4 s for the teal cue, then click, tap, or press Space. Measures display-to-input median and fastest trial.",
    icon: Zap,
    flashes: false,
  },
  {
    task: "memory_span",
    title: "Memory span",
    subtitle: "3×3 grid · ~60s",
    description:
      "Watch a growing sequence flash across 9 cells and repeat it in order (starts at 3; ends after two misses at the same length).",
    icon: Grid3X3,
    flashes: true,
  },
  {
    task: "go_no_go",
    title: "Attention (go/no-go)",
    subtitle: "40 trials · ~90s",
    description:
      "Respond to frequent teal Go circles (~75%) and withhold responses on violet No-Go diamonds.",
    icon: Eye,
    flashes: true,
  },
];

export function MicrotasksTab({
  results,
  reducedMotion,
  onCreateResult,
  onDeleteResult,
}: MicrotasksTabProps) {
  const [timeOfDay] = useState(() => detectTimeOfDayBucket());
  const [restedRating, setRestedRating] = useState<Rating | undefined>(undefined);
  const [activeRun, setActiveRun] = useState<{
    task: MicrotaskKind;
    practiceMode: boolean;
  } | null>(null);

  const storedPracticed = useSyncExternalStore(
    subscribePracticeStore,
    getPracticeSnapshot,
    () => EMPTY_PRACTICE,
  );

  const practicedMap = useMemo<Record<MicrotaskKind, boolean>>(
    () => ({
      reaction_time:
        storedPracticed.reaction_time ||
        results.some((r) => r.task === "reaction_time"),
      memory_span:
        storedPracticed.memory_span ||
        results.some((r) => r.task === "memory_span"),
      go_no_go:
        storedPracticed.go_no_go ||
        results.some((r) => r.task === "go_no_go"),
    }),
    [results, storedPracticed],
  );

  const handleLaunch = useCallback((task: MicrotaskKind, practiceMode: boolean) => {
    setActiveRun({ task, practiceMode });
  }, []);

  const handleReactionComplete = useCallback(
    async (metrics: ReactionTimeMetrics, inputType: MicrotaskInputType) => {
      if (!activeRun) return;
      if (activeRun.practiceMode) {
        markPracticeCompleted("reaction_time");
        window.dispatchEvent(new Event(PRACTICE_CHANGE_EVENT));
        return;
      }
      await onCreateResult({
        date: toLocalISODate(),
        timeOfDay,
        restedRating,
        inputType,
        task: "reaction_time",
        metrics,
      });
      toast.success(`Saved reaction time run (median ${metrics.medianMs} ms).`);
    },
    [activeRun, onCreateResult, restedRating, timeOfDay],
  );

  const handleMemorySpanComplete = useCallback(
    async (metrics: MemorySpanMetrics, inputType: MicrotaskInputType) => {
      if (!activeRun) return;
      if (activeRun.practiceMode) {
        markPracticeCompleted("memory_span");
        window.dispatchEvent(new Event(PRACTICE_CHANGE_EVENT));
        return;
      }
      await onCreateResult({
        date: toLocalISODate(),
        timeOfDay,
        restedRating,
        inputType,
        task: "memory_span",
        metrics,
      });
      toast.success(`Saved memory span run (${metrics.longestSpan} items).`);
    },
    [activeRun, onCreateResult, restedRating, timeOfDay],
  );

  const handleGoNoGoComplete = useCallback(
    async (metrics: GoNoGoMetrics, inputType: MicrotaskInputType) => {
      if (!activeRun) return;
      if (activeRun.practiceMode) {
        markPracticeCompleted("go_no_go");
        window.dispatchEvent(new Event(PRACTICE_CHANGE_EVENT));
        return;
      }
      await onCreateResult({
        date: toLocalISODate(),
        timeOfDay,
        restedRating,
        inputType,
        task: "go_no_go",
        metrics,
      });
      toast.success(`Saved attention run (${metrics.hits}/${metrics.goTrials} go hits).`);
    },
    [activeRun, onCreateResult, restedRating, timeOfDay],
  );

  return (
    <div className="space-y-6">
      {/* Required honest framing card */}
      <Card className="space-y-3 border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-cyan" aria-hidden />
            <div className="space-y-1">
              <h2 className="text-section font-semibold text-foreground">
                Honest framing &amp; context
              </h2>
              <ul className="space-y-0.5 text-caption text-muted-foreground">
                {MICROTASKS_FRAMING_POINTS.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-caption">
            <Link
              href="/library#reaction-time-variability"
              className="inline-flex items-center gap-1 text-cyan underline-offset-4 hover:underline"
            >
              About variability <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
            <Link
              href="/library#practice-effects"
              className="inline-flex items-center gap-1 text-cyan underline-offset-4 hover:underline"
            >
              Practice effects <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <p role="note" className="text-[11px] text-muted-foreground">
          {FLASHING_STIMULI_NOTE}
        </p>
      </Card>

      {/* Pre-run context selector */}
      <Card className="flex flex-wrap items-center justify-between gap-4 border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-caption">
          <span className="text-muted-foreground">Time of day:</span>
          <span className="rounded-chip border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 font-mono text-cyan">
            {TIME_OF_DAY_LABELS[timeOfDay]}
          </span>
          <span className="text-muted-foreground">Input method is detected automatically.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted-foreground">
            How rested do you feel? (optional)
          </span>
          <div role="group" aria-label="How rested do you feel 1 to 5" className="flex gap-1">
            {RATINGS.map((val) => {
              const selected = restedRating === val;
              return (
                <button
                  key={val}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRestedRating((prev) => (prev === val ? undefined : val))}
                  className={cn(
                    "size-7 rounded-control border font-mono text-caption transition-colors",
                    selected
                      ? "border-cyan bg-cyan/20 text-foreground"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Three microtask launch cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {TASK_CARDS.map((card) => {
          const Icon = card.icon;
          const hasPracticed = practicedMap[card.task];

          return (
            <Card
              key={card.task}
              className="flex flex-col justify-between gap-4 border-border bg-surface p-5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-surface-2 text-cyan">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {card.subtitle}
                  </span>
                </div>
                <h3 className="text-section font-semibold text-foreground">{card.title}</h3>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {card.description}
                </p>
              </div>

              <div className="space-y-2">
                {!hasPracticed ? (
                  <>
                    <Button
                      type="button"
                      aria-label={`Practice ${card.title.toLowerCase()}`}
                      onClick={() => handleLaunch(card.task, true)}
                      className="h-auto min-h-9 w-full whitespace-normal rounded-control bg-violet px-3 py-2 text-center text-white hover:bg-violet/90"
                    >
                      Practice round
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Skip practice and start ${card.title.toLowerCase()}`}
                      onClick={() => handleLaunch(card.task, false)}
                      className="h-auto min-h-8 w-full whitespace-normal rounded-control px-3 py-1.5 text-center text-caption text-muted-foreground hover:text-foreground"
                    >
                      Skip practice &amp; start
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      aria-label={`Start ${card.title.toLowerCase()}`}
                      onClick={() => handleLaunch(card.task, false)}
                      className="h-auto min-h-9 w-full whitespace-normal rounded-control bg-violet px-3 py-2 text-center text-white hover:bg-violet/90"
                    >
                      Start task
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Practice ${card.title.toLowerCase()} again`}
                      onClick={() => handleLaunch(card.task, true)}
                      className="h-auto min-h-8 w-full whitespace-normal rounded-control px-3 py-1.5 text-center text-caption"
                    >
                      Practice round
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trends view */}
      <MicrotaskTrendsCard results={results} onDeleteResult={onDeleteResult} />

      {/* Calm near-fullscreen stage */}
      {activeRun ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#060913]/95 p-4 backdrop-blur-sm">
          {activeRun.task === "reaction_time" ? (
            <ReactionTimeRunner
              practiceMode={activeRun.practiceMode}
              reducedMotion={reducedMotion}
              onComplete={handleReactionComplete}
              onCancel={() => setActiveRun(null)}
            />
          ) : activeRun.task === "memory_span" ? (
            <MemorySpanRunner
              practiceMode={activeRun.practiceMode}
              reducedMotion={reducedMotion}
              onComplete={handleMemorySpanComplete}
              onCancel={() => setActiveRun(null)}
            />
          ) : (
            <GoNoGoRunner
              practiceMode={activeRun.practiceMode}
              reducedMotion={reducedMotion}
              onComplete={handleGoNoGoComplete}
              onCancel={() => setActiveRun(null)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
