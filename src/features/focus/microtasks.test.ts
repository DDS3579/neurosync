import { describe, expect, it } from "vitest";

import {
  advanceSpanState,
  buildMicrotaskTrend,
  classifyReactionAttempt,
  createInitialSpanState,
  createSeededRng,
  detectTimeOfDayBucket,
  evaluateSpanAttempt,
  FLASHING_STIMULI_NOTE,
  generateGoNoGoTrials,
  generateSpanSequence,
  PRACTICE_EFFECT_CAVEAT,
  sampleReactionDelayMs,
  scoreGoNoGoTrials,
  summarizeReactionTrials,
  toMemorySpanMetrics,
} from "./microtasks";
import type { MicrotaskResult } from "@/types/domain";

const BANNED_TREND_PATTERNS = [
  /\bgood\b/i,
  /\bbad\b/i,
  /\bdiagnos/i,
  /\bbrain score\b/i,
  /\bscore\b/i,
];

describe("Microtasks pure logic & statistics", () => {
  it("handles reaction time false starts (<100ms) and computes median and best over valid trials", () => {
    expect(classifyReactionAttempt(99)).toBe("false_start");
    expect(classifyReactionAttempt(0)).toBe("false_start");
    expect(classifyReactionAttempt(Number.NaN)).toBe("false_start");
    expect(classifyReactionAttempt(100)).toBe("valid");

    // Odd count sorted: [215, 240, 260, 290, 340] -> median 260, best 215
    // Value 80 (<100ms) inside raw list is filtered cleanly
    const metrics = summarizeReactionTrials([290, 80, 215, 340, 240, 260], 2);
    expect(metrics.trialsMs).toEqual([290, 215, 340, 240, 260]);
    expect(metrics.medianMs).toBe(260);
    expect(metrics.bestMs).toBe(215);
    expect(metrics.falseStarts).toBe(2);

    const rng = createSeededRng(123);
    for (let i = 0; i < 20; i += 1) {
      const delay = sampleReactionDelayMs(rng);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(4000);
    }
  });

  it("generates deterministic memory span sequences with seeded RNG and stops after two failures at same length", () => {
    const seq1 = generateSpanSequence(5, createSeededRng(42));
    const seq2 = generateSpanSequence(5, createSeededRng(42));
    expect(seq1).toEqual(seq2);
    expect(seq1).toHaveLength(5);
    for (const cell of seq1) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(9);
    }
    for (let i = 1; i < seq1.length; i += 1) {
      expect(seq1[i]).not.toBe(seq1[i - 1]);
    }

    expect(evaluateSpanAttempt([1, 4, 7], [1, 4, 7])).toBe(true);
    expect(evaluateSpanAttempt([1, 4, 7], [1, 7, 4])).toBe(false);

    // Run simulation: start 3 -> pass 3 -> fail 4 once -> pass 4 -> fail 5 twice (task ends)
    let state = createInitialSpanState(3);
    state = advanceSpanState(state, true); // 3 passed -> longest 3, next 4
    expect(state.longestSpan).toBe(3);
    expect(state.currentLength).toBe(4);
    expect(state.done).toBe(false);

    state = advanceSpanState(state, false); // first fail at 4
    expect(state.currentLength).toBe(4);
    expect(state.failuresAtLength).toBe(1);
    expect(state.done).toBe(false);

    state = advanceSpanState(state, true); // second chance at 4 passes -> longest 4, next 5
    expect(state.longestSpan).toBe(4);
    expect(state.currentLength).toBe(5);
    expect(state.failuresAtLength).toBe(0);

    state = advanceSpanState(state, false); // fail 1 at 5
    expect(state.done).toBe(false);
    state = advanceSpanState(state, false); // fail 2 at 5 -> done!
    expect(state.done).toBe(true);

    const metrics = toMemorySpanMetrics(state);
    expect(metrics).toEqual({
      longestSpan: 4,
      startingLength: 3,
      totalRounds: 5,
      failures: 3,
    });
  });

  it("generates ~75% go/no-go trials deterministically and scores hits, misses, commissions, and mean Go RT", () => {
    const trials1 = generateGoNoGoTrials(40, 0.75, createSeededRng(99));
    const trials2 = generateGoNoGoTrials(40, 0.75, createSeededRng(99));
    expect(trials1).toEqual(trials2);
    expect(trials1).toHaveLength(40);
    expect(trials1.filter((t) => t.cue === "go")).toHaveLength(30);
    expect(trials1.filter((t) => t.cue === "nogo")).toHaveLength(10);
    for (const t of trials1) {
      expect(t.gapMs).toBeGreaterThanOrEqual(1000);
      expect(t.gapMs).toBeLessThanOrEqual(1500);
    }

    const scored = scoreGoNoGoTrials([
      { cue: "go", responded: true, reactionMs: 310 },
      { cue: "go", responded: true, reactionMs: 350 },
      { cue: "go", responded: false },
      { cue: "nogo", responded: true, reactionMs: 280 }, // commission error; RT excluded from Go mean
      { cue: "nogo", responded: false },
    ]);

    expect(scored).toEqual({
      totalTrials: 5,
      goTrials: 3,
      noGoTrials: 2,
      hits: 2,
      misses: 1,
      commissionErrors: 1,
      meanReactionMs: 330,
    });
  });

  it("aggregates trends cleanly with sample sizes, median, and neutral non-judgmental copy", () => {
    expect(detectTimeOfDayBucket(new Date("2026-11-18T08:00:00"))).toBe("morning");
    expect(detectTimeOfDayBucket(new Date("2026-11-18T14:00:00"))).toBe("afternoon");
    expect(detectTimeOfDayBucket(new Date("2026-11-18T19:00:00"))).toBe("evening");
    expect(detectTimeOfDayBucket(new Date("2026-11-18T23:30:00"))).toBe("night");

    const rows: MicrotaskResult[] = [
      {
        id: "r1",
        date: "2026-11-15",
        createdAt: "2026-11-15T08:00:00.000Z",
        updatedAt: "2026-11-15T08:00:00.000Z",
        task: "reaction_time",
        timeOfDay: "morning",
        inputType: "keyboard",
        metrics: { trialsMs: [300, 310], medianMs: 305, bestMs: 300, falseStarts: 0 },
      },
      {
        id: "r2",
        date: "2026-11-16",
        createdAt: "2026-11-16T08:00:00.000Z",
        updatedAt: "2026-11-16T08:00:00.000Z",
        task: "reaction_time",
        timeOfDay: "morning",
        inputType: "keyboard",
        metrics: { trialsMs: [280, 290], medianMs: 285, bestMs: 280, falseStarts: 0 },
      },
      {
        id: "r3",
        date: "2026-11-17",
        createdAt: "2026-11-17T08:00:00.000Z",
        updatedAt: "2026-11-17T08:00:00.000Z",
        task: "reaction_time",
        timeOfDay: "morning",
        inputType: "mouse",
        metrics: { trialsMs: [265, 275], medianMs: 270, bestMs: 265, falseStarts: 1 },
      },
    ];

    const trend = buildMicrotaskTrend(rows, "reaction_time");
    expect(trend.sampleSize).toBe(3);
    expect(trend.medianValue).toBe(285);
    expect(trend.unit).toBe("ms");
    expect(trend.points.map((p) => p.value)).toEqual([305, 285, 270]);

    for (const copy of [
      trend.metricLabel,
      ...trend.points.map((p) => p.secondaryLabel),
      PRACTICE_EFFECT_CAVEAT,
      FLASHING_STIMULI_NOTE,
    ]) {
      for (const pattern of BANNED_TREND_PATTERNS) {
        expect(copy).not.toMatch(pattern);
      }
    }
  });
});
