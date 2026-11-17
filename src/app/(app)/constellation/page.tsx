"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import {
  deriveConstellation,
  type ConstellationWindowDays,
} from "@/features/constellation/constellation";
import {
  ConstellationSkeleton,
  ConstellationWorkspace,
} from "@/features/constellation/components/ConstellationWorkspace";
import { loadDemoDataToDb } from "@/features/overview/demoData";
import {
  useActivityLogs,
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useMindfulnessSessions,
  useMovementLogs,
  useSettings,
} from "@/lib/db/hooks";

export default function ConstellationPage() {
  const [windowDays, setWindowDays] = useState<ConstellationWindowDays>(30);

  const settings = useSettings();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const activities = useActivityLogs();
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const mindfulness = useMindfulnessSessions();
  const prefersReducedMotion = usePrefersReducedMotion();

  const reducedMotion = Boolean(settings.data?.reducedMotion) || prefersReducedMotion;

  const isLoading =
    habits.isLoading ||
    habitLogs.isLoading ||
    activities.isLoading ||
    focus.isLoading ||
    movement.isLoading ||
    mindfulness.isLoading;

  const data = useMemo(() => {
    if (isLoading) return null;
    return deriveConstellation({
      habits: habits.data ?? [],
      habitLogs: habitLogs.data ?? [],
      activities: activities.data ?? [],
      focus: focus.data ?? [],
      movement: movement.data ?? [],
      mindfulness: mindfulness.data ?? [],
      windowDays,
    });
  }, [
    isLoading,
    habits.data,
    habitLogs.data,
    activities.data,
    focus.data,
    movement.data,
    mindfulness.data,
    windowDays,
  ]);

  const handleLoadDemo = useCallback(async () => {
    await loadDemoDataToDb();
    toast.success("Loaded 14 days of demo data.");
  }, []);

  if (!data) {
    return <ConstellationSkeleton />;
  }

  return (
    <ConstellationWorkspace
      data={data}
      windowDays={windowDays}
      onChangeWindowDays={setWindowDays}
      reducedMotion={reducedMotion}
      onLoadDemo={handleLoadDemo}
    />
  );
}
