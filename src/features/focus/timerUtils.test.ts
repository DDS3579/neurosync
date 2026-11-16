import { describe, expect, it } from "vitest";

import {
  computeElapsedMs,
  computePausedMs,
  computeRemainingMs,
  deserializeRunningSession,
  incrementDistractions,
  isSessionPaused,
  pauseRunningSession,
  resumeRunningSession,
  serializeRunningSession,
  startRunningSession,
} from "./timerUtils";

describe("focus timer timestamp math", () => {
  it("computes elapsed and remaining time across multiple pause/resume intervals", () => {
    const t0 = 1_700_000_000_000;
    let session = startRunningSession({
      subject: "Neuroanatomy",
      method: "active_recall",
      plannedMin: 25,
      nowMs: t0,
    });

    // Run 5 minutes, pause for 3 minutes, run 10 minutes
    session = pauseRunningSession(session, t0 + 5 * 60_000);
    expect(isSessionPaused(session)).toBe(true);
    // While paused at +7m, elapsed stays frozen at 5m
    expect(computeElapsedMs(session, t0 + 7 * 60_000)).toBe(5 * 60_000);

    session = resumeRunningSession(session, t0 + 8 * 60_000);
    expect(isSessionPaused(session)).toBe(false);
    expect(computePausedMs(session.pausedIntervals, t0 + 18 * 60_000)).toBe(3 * 60_000);

    // At t0 + 18m (with 3m paused), active elapsed = 15m, remaining = 10m
    expect(computeElapsedMs(session, t0 + 18 * 60_000)).toBe(15 * 60_000);
    expect(computeRemainingMs(session, t0 + 18 * 60_000)).toBe(10 * 60_000);
  });

  it("resumes accurately after serialization and page reload", () => {
    const t0 = 1_700_000_000_000;
    let session = startRunningSession({
      subject: "Systems reading",
      method: "deep_reading",
      plannedMin: 50,
      nowMs: t0,
    });
    session = incrementDistractions(session);
    session = pauseRunningSession(session, t0 + 10 * 60_000);
    session = resumeRunningSession(session, t0 + 12 * 60_000);

    const raw = serializeRunningSession(session);
    const restored = deserializeRunningSession(raw);

    expect(restored).not.toBeNull();
    if (!restored) return;

    // 25 minutes after start with 2 minutes paused => 23m elapsed, 27m remaining
    const afterReloadMs = t0 + 25 * 60_000;
    expect(computeElapsedMs(restored, afterReloadMs)).toBe(23 * 60_000);
    expect(computeRemainingMs(restored, afterReloadMs)).toBe(27 * 60_000);
    expect(restored.distractions).toBe(1);
  });

  it("clamps remaining time at 0 when elapsed exceeds planned duration", () => {
    const t0 = 1_700_000_000_000;
    const session = startRunningSession({
      subject: "Practice",
      method: "problem_solving",
      plannedMin: 25,
      nowMs: t0,
    });

    expect(computeRemainingMs(session, t0 + 30 * 60_000)).toBe(0);
    expect(computeElapsedMs(session, t0 + 30 * 60_000)).toBe(30 * 60_000);
  });
});
