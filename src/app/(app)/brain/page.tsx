"use client";

import { useMemo } from "react";

import { deriveWeeklyBrainActivity } from "@/features/brain/brainActivity";
import {
  BrainExplorerSkeleton,
  BrainExplorerWorkspace,
} from "@/features/brain/components/BrainExplorerWorkspace";
import {
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useMovementLogs,
  useSleepLogs,
} from "@/lib/db/hooks";

export default function BrainPage() {
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const sleep = useSleepLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();

  const isLoading =
    focus.isLoading ||
    movement.isLoading ||
    sleep.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading;

  const derived = useMemo(() => {
    if (
      isLoading ||
      !focus.data ||
      !movement.data ||
      !sleep.data ||
      !habits.data ||
      !habitLogs.data
    ) {
      return null;
    }

    return deriveWeeklyBrainActivity({
      focus: focus.data,
      movement: movement.data,
      sleep: sleep.data,
      habits: habits.data,
      habitLogs: habitLogs.data,
    });
  }, [isLoading, focus.data, movement.data, sleep.data, habits.data, habitLogs.data]);

  if (!derived) {
    return <BrainExplorerSkeleton />;
  }

  return (
    <BrainExplorerWorkspace
      activity={derived.activity}
      loggedItems={derived.items}
      windowStart={derived.windowStart}
      windowEnd={derived.windowEnd}
    />
  );
}
