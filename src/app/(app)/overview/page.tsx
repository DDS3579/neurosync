"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  buildOverviewViewData,
  clearDemoDataFromDb,
  loadDemoDataToDb,
} from "@/features/overview/demoData";
import { OverviewSkeleton, OverviewView } from "@/features/overview/OverviewView";
import {
  useCheckins,
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useMindfulnessSessions,
  useMovementLogs,
  useNutritionLogs,
  useSettings,
  useSleepLogs,
} from "@/lib/db/hooks";

export default function OverviewPage() {
  const router = useRouter();
  const settings = useSettings();
  const sleep = useSleepLogs();
  const checkins = useCheckins();
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const nutrition = useNutritionLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const mindfulness = useMindfulnessSessions();

  const onLogToday = useCallback(() => router.push("/habits"), [router]);
  const onOpenBrain = useCallback(() => router.push("/brain"), [router]);

  const onLoadDemo = useCallback(async () => {
    await loadDemoDataToDb();
    toast.success("Loaded 14 days of demo observatory data.");
  }, []);

  const onClearDemo = useCallback(async () => {
    await clearDemoDataFromDb();
    toast.success("Cleared demo data. Your own logs were kept.");
  }, []);

  const isLoading =
    settings.isLoading ||
    sleep.isLoading ||
    checkins.isLoading ||
    focus.isLoading ||
    movement.isLoading ||
    nutrition.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading ||
    mindfulness.isLoading;

  const aggregated = useMemo(() => {
    if (
      isLoading ||
      !settings.data ||
      !sleep.data ||
      !checkins.data ||
      !focus.data ||
      !movement.data ||
      !nutrition.data ||
      !habits.data ||
      !habitLogs.data ||
      !mindfulness.data
    ) {
      return null;
    }

    return buildOverviewViewData({
      settings: settings.data,
      sleep: sleep.data,
      checkins: checkins.data,
      focus: focus.data,
      movement: movement.data,
      nutrition: nutrition.data,
      habits: habits.data,
      habitLogs: habitLogs.data,
      mindfulness: mindfulness.data,
    });
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
    mindfulness.data,
  ]);

  if (!aggregated) {
    return <OverviewSkeleton />;
  }

  return (
    <OverviewView
      {...aggregated}
      onLogToday={onLogToday}
      onLoadDemo={onLoadDemo}
      onClearDemo={onClearDemo}
      onOpenBrain={onOpenBrain}
    />
  );
}
