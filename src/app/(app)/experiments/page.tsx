"use client";

import { useCallback, useMemo } from "react";
import { format, startOfDay } from "date-fns";

import {
  ExperimentsSkeleton,
  ExperimentsWorkspace,
} from "@/features/experiments/components/ExperimentsWorkspace";
import {
  useCheckins,
  useExperiments,
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useMovementLogs,
  useNutritionLogs,
  useSettings,
  useSleepLogs,
} from "@/lib/db/hooks";
import { experimentRepository } from "@/lib/db/repositories";
import type { Experiment } from "@/types/domain";

export default function ExperimentsPage() {
  const experiments = useExperiments();
  const settings = useSettings();
  const sleep = useSleepLogs();
  const checkins = useCheckins();
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const nutrition = useNutritionLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();

  const onCreateExperiment = useCallback(
    async (values: Omit<Experiment, "id" | "createdAt" | "updatedAt">) => {
      await experimentRepository.create(values);
    },
    [],
  );

  const onUpdateExperiment = useCallback(
    async (
      id: string,
      patch: Partial<Omit<Experiment, "id" | "createdAt" | "updatedAt">>,
    ) => {
      await experimentRepository.update(id, patch);
    },
    [],
  );

  const onDeleteExperiment = useCallback((id: string) => experimentRepository.remove(id), []);

  const isLoading =
    experiments.isLoading ||
    settings.isLoading ||
    sleep.isLoading ||
    checkins.isLoading ||
    focus.isLoading ||
    movement.isLoading ||
    nutrition.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading;

  const insightInput = useMemo(() => {
    if (
      isLoading ||
      !settings.data ||
      !sleep.data ||
      !checkins.data ||
      !focus.data ||
      !movement.data ||
      !nutrition.data ||
      !habits.data ||
      !habitLogs.data
    ) {
      return null;
    }
    return {
      settings: settings.data,
      sleep: sleep.data,
      checkins: checkins.data,
      focus: focus.data,
      movement: movement.data,
      nutrition: nutrition.data,
      habits: habits.data,
      habitLogs: habitLogs.data,
    };
  }, [
    isLoading,
    settings.data,
    sleep.data,
    checkins.data,
    focus.data,
    movement.data,
    nutrition.data,
    habits.data,
    habitLogs.data,
  ]);

  if (!insightInput || !experiments.data) {
    return <ExperimentsSkeleton />;
  }

  const todayISO = format(startOfDay(new Date()), "yyyy-MM-dd");

  return (
    <ExperimentsWorkspace
      experiments={experiments.data}
      insightInput={insightInput}
      todayISO={todayISO}
      onCreateExperiment={onCreateExperiment}
      onUpdateExperiment={onUpdateExperiment}
      onDeleteExperiment={onDeleteExperiment}
    />
  );
}
