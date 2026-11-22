"use client";

import { useSyncExternalStore } from "react";
import { toISODate } from "@/features/planner/dayContext";
import type { ISODate } from "@/types/domain";

function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(250, next.getTime() - now.getTime());
}

function subscribeDay(callback: () => void): () => void {
  let timer: number | undefined;
  const arm = () => {
    timer = window.setTimeout(() => {
      callback();
      arm();
    }, msUntilNextLocalMidnight() + 250);
  };
  arm();
  const onWake = () => {
    if (document.visibilityState === "visible") callback();
  };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", onWake);
  };
}

/** Live local calendar date: a tab left open overnight follows the calendar. */
export function useTodayISO(): ISODate {
  return useSyncExternalStore(subscribeDay, () => toISODate(new Date()), () => toISODate(new Date()));
}
