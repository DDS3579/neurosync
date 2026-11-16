"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { SETTINGS_ID, isIndexedDbAvailable } from "@/lib/db/dexie";
import {
  ALL_TIME,
  checkinRepository,
  experimentRepository,
  focusRepository,
  habitLogRepository,
  habitRepository,
  movementRepository,
  nutritionRepository,
  settingsRepository,
  sleepRepository,
  type DateRange,
} from "@/lib/db/repositories";
import type {
  DailyCheckin,
  Experiment,
  FocusSession,
  Habit,
  HabitLog,
  MovementLog,
  NutritionLog,
  SleepLog,
  UserSettings,
} from "@/types/domain";

/** `data` is undefined while the first query is still running. */
export interface LiveResult<T> {
  data: T[] | undefined;
  isLoading: boolean;
}

function useRows<T>(query: () => Promise<T[]>, deps: readonly string[]): LiveResult<T> {
  const data = useLiveQuery(
    () => (isIndexedDbAvailable() ? query() : Promise.resolve([] as T[])),
    [...deps],
  );

  return { data, isLoading: data === undefined };
}

function rangeDeps(range: DateRange): readonly string[] {
  return [range.start, range.end];
}

export function useSleepLogs(range: DateRange = ALL_TIME): LiveResult<SleepLog> {
  return useRows(() => sleepRepository.listByDateRange(range), rangeDeps(range));
}

export function useCheckins(range: DateRange = ALL_TIME): LiveResult<DailyCheckin> {
  return useRows(() => checkinRepository.listByDateRange(range), rangeDeps(range));
}

export function useFocusSessions(range: DateRange = ALL_TIME): LiveResult<FocusSession> {
  return useRows(() => focusRepository.listByDateRange(range), rangeDeps(range));
}

export function useMovementLogs(range: DateRange = ALL_TIME): LiveResult<MovementLog> {
  return useRows(() => movementRepository.listByDateRange(range), rangeDeps(range));
}

export function useNutritionLogs(range: DateRange = ALL_TIME): LiveResult<NutritionLog> {
  return useRows(() => nutritionRepository.listByDateRange(range), rangeDeps(range));
}

export function useHabitLogs(range: DateRange = ALL_TIME): LiveResult<HabitLog> {
  return useRows(() => habitLogRepository.listByDateRange(range), rangeDeps(range));
}

export function useHabits(): LiveResult<Habit> {
  return useRows(() => habitRepository.listAll(), ["habits"]);
}

export function useExperiments(): LiveResult<Experiment> {
  return useRows(() => experimentRepository.listAll(), ["experiments"]);
}

export function useSettings(): { data: UserSettings | undefined; isLoading: boolean } {
  useEffect(() => {
    if (!isIndexedDbAvailable()) return;
    void settingsRepository.ensure();
  }, []);

  const data = useLiveQuery(
    () =>
      isIndexedDbAvailable()
        ? settingsRepository.getById(SETTINGS_ID)
        : Promise.resolve(undefined),
    ["settings"],
  );

  return { data, isLoading: data === undefined };
}
