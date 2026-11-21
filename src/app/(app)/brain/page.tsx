"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import {
  deriveBrainTimeline,
  deriveWeeklyBrainActivity,
  hasAnyBrainActivityData,
} from "@/features/brain/brainActivity";
import {
  BrainExplorerSkeleton,
  BrainExplorerWorkspace,
} from "@/features/brain/components/BrainExplorerWorkspace";
import { upsertCheckin } from "@/features/checkin/checkinUtils";
import { loadDemoDataToDb } from "@/features/overview/demoData";
import {
  useActivityLogs,
  useBlocks,
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useMindfulnessSessions,
  useMovementLogs,
  useSleepLogs,
  useTasks,
} from "@/lib/db/hooks";
import {
  activityRepository,
  focusRepository,
  getCheckinByDate,
} from "@/lib/db/repositories";
import type { PersonalActivityType, Rating } from "@/types/domain";

export default function BrainPage() {
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const sleep = useSleepLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const mindfulness = useMindfulnessSessions();
  const activities = useActivityLogs();
  const blocks = useBlocks();
  const tasks = useTasks();

  const isLoading =
    focus.isLoading ||
    movement.isLoading ||
    sleep.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading ||
    mindfulness.isLoading ||
    activities.isLoading ||
    blocks.isLoading ||
    tasks.isLoading;

  const derived = useMemo(() => {
    if (
      isLoading ||
      !focus.data ||
      !movement.data ||
      !sleep.data ||
      !habits.data ||
      !habitLogs.data ||
      !mindfulness.data ||
      !activities.data ||
      !blocks.data ||
      !tasks.data
    ) {
      return null;
    }

    const sources = {
      focus: focus.data,
      movement: movement.data,
      sleep: sleep.data,
      habits: habits.data,
      habitLogs: habitLogs.data,
      mindfulness: mindfulness.data,
      activities: activities.data,
      blocks: blocks.data,
      tasks: tasks.data,
    };

    const weekly = deriveWeeklyBrainActivity(sources);
    const timeline7 = deriveBrainTimeline({ ...sources, windowDays: 7 });
    const timeline30 = deriveBrainTimeline({ ...sources, windowDays: 30 });
    const hasAnyData = hasAnyBrainActivityData(sources);

    return { weekly, timeline7, timeline30, hasAnyData };
  }, [
    isLoading,
    focus.data,
    movement.data,
    sleep.data,
    habits.data,
    habitLogs.data,
    mindfulness.data,
    activities.data,
    blocks.data,
    tasks.data,
  ]);

  const handleLoadDemo = useCallback(async () => {
    await loadDemoDataToDb();
    toast.success("Loaded demo data into your browser.");
  }, []);

  const handleCreateActivity = useCallback(
    async (input: {
      date: string;
      type: PersonalActivityType;
      durationMin: number;
      enjoyment: Rating;
    }) => {
      await activityRepository.create({
        date: input.date,
        type: input.type,
        durationMin: input.durationMin,
        enjoyment: input.enjoyment,
      });
    },
    [],
  );

  const handleQuickMoodCheckin = useCallback(async (mood: Rating, date: string) => {
    const existing = await getCheckinByDate(date);
    const res = await upsertCheckin({
      date,
      mood,
      stress: existing?.stress ?? 3,
      energy: existing?.energy ?? 3,
      concentration: existing?.concentration ?? 3,
      motivation: existing?.motivation ?? 3,
      outdoorMin: existing?.outdoorMin,
      note: existing?.note,
    });
    return res.mode;
  }, []);

  const handleQuickFocusLog = useCallback(
    async (input: { date: string; subject: string; durationMin: number }) => {
      await focusRepository.create({
        date: input.date,
        startedAt: new Date().toISOString(),
        durationMin: input.durationMin,
        plannedMin: input.durationMin,
        subject: input.subject,
        method: "active_recall",
        focusRating: 4,
        difficulty: 3,
        distractions: 0,
      });
    },
    [],
  );

  if (!derived) {
    return <BrainExplorerSkeleton />;
  }

  return (
    <BrainExplorerWorkspace
      activity={derived.weekly.activity}
      loggedItems={derived.weekly.items}
      windowStart={derived.weekly.windowStart}
      windowEnd={derived.weekly.windowEnd}
      timeline7={derived.timeline7}
      timeline30={derived.timeline30}
      hasAnyData={derived.hasAnyData}
      onLoadDemo={handleLoadDemo}
      onCreateActivity={handleCreateActivity}
      onQuickMoodCheckin={handleQuickMoodCheckin}
      onQuickFocusLog={handleQuickFocusLog}
    />
  );
}
