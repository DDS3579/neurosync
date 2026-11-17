"use client";

import { useCallback, useEffect, useRef } from "react";

import { upsertCheckin } from "@/features/checkin/checkinUtils";
import { HabitsSkeleton, HabitsWorkspace } from "@/features/habits/components/HabitsWorkspace";
import { DEFAULT_HABIT_NAMES, HABITS_SEEDED_KEY } from "@/features/habits/habitUtils";
import {
  useActivityLogs,
  useCheckins,
  useGratitudeEntries,
  useHabitLogs,
  useHabits,
  useJournalEntries,
  useMindfulnessSessions,
  useMovementLogs,
  useNutritionLogs,
  useSettings,
  useSleepLogs,
} from "@/lib/db/hooks";
import {
  activityRepository,
  checkinRepository,
  getGratitudeByDate,
  gratitudeRepository,
  habitLogRepository,
  habitRepository,
  journalRepository,
  mindfulnessRepository,
  movementRepository,
  nutritionRepository,
  sleepRepository,
} from "@/lib/db/repositories";
import type {
  ActivityLog,
  DailyCheckin,
  GratitudeEntry,
  ISODate,
  JournalEntry,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  SleepLog,
} from "@/types/domain";

export default function HabitsPage() {
  const settings = useSettings();
  const checkins = useCheckins();
  const sleep = useSleepLogs();
  const movement = useMovementLogs();
  const nutrition = useNutritionLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const mindfulness = useMindfulnessSessions();
  const journal = useJournalEntries();
  const gratitude = useGratitudeEntries();
  const activities = useActivityLogs();
  const seededAttemptRef = useRef(false);

  // Seed the 4 default habits exactly once on first use if no habits exist yet.
  useEffect(() => {
    if (seededAttemptRef.current || habits.isLoading || !habits.data) return;
    seededAttemptRef.current = true;

    if (typeof window === "undefined") return;
    if (habits.data.length > 0 || window.localStorage.getItem(HABITS_SEEDED_KEY) === "1") {
      window.localStorage.setItem(HABITS_SEEDED_KEY, "1");
      return;
    }

    window.localStorage.setItem(HABITS_SEEDED_KEY, "1");
    void Promise.all(
      DEFAULT_HABIT_NAMES.map((name) => habitRepository.create({ name, archived: false })),
    );
  }, [habits.isLoading, habits.data]);

  const onSaveCheckin = useCallback(
    async (values: Omit<DailyCheckin, "id" | "createdAt" | "updatedAt">) => {
      const result = await upsertCheckin(values);
      return result.mode;
    },
    [],
  );

  const onDeleteCheckin = useCallback((id: string) => checkinRepository.remove(id), []);

  const onCreateSleep = useCallback(
    async (values: Omit<SleepLog, "id" | "createdAt" | "updatedAt">) => {
      await sleepRepository.create(values);
    },
    [],
  );

  const onUpdateSleep = useCallback(
    async (id: string, values: Omit<SleepLog, "id" | "createdAt" | "updatedAt">) => {
      await sleepRepository.update(id, values);
    },
    [],
  );

  const onDeleteSleep = useCallback((id: string) => sleepRepository.remove(id), []);

  const onCreateMovement = useCallback(
    async (values: Omit<MovementLog, "id" | "createdAt" | "updatedAt">) => {
      await movementRepository.create(values);
    },
    [],
  );

  const onUpdateMovement = useCallback(
    async (id: string, values: Omit<MovementLog, "id" | "createdAt" | "updatedAt">) => {
      await movementRepository.update(id, values);
    },
    [],
  );

  const onDeleteMovement = useCallback((id: string) => movementRepository.remove(id), []);

  const onCreateNutrition = useCallback(
    async (values: Omit<NutritionLog, "id" | "createdAt" | "updatedAt">) => {
      await nutritionRepository.create(values);
    },
    [],
  );

  const onUpdateNutrition = useCallback(
    async (id: string, values: Omit<NutritionLog, "id" | "createdAt" | "updatedAt">) => {
      await nutritionRepository.update(id, values);
    },
    [],
  );

  const onDeleteNutrition = useCallback((id: string) => nutritionRepository.remove(id), []);

  const onToggleHabit = useCallback(
    async (habitId: string, date: ISODate, nextDone: boolean) => {
      const existing = habitLogs.data?.find((l) => l.habitId === habitId && l.date === date);
      if (existing) {
        await habitLogRepository.update(existing.id, { done: nextDone });
      } else if (nextDone) {
        await habitLogRepository.create({ habitId, date, done: true });
      }
    },
    [habitLogs.data],
  );

  const onAddHabit = useCallback(async (name: string) => {
    await habitRepository.create({ name, archived: false });
  }, []);

  const onRenameHabit = useCallback(async (id: string, name: string) => {
    await habitRepository.update(id, { name });
  }, []);

  const onArchiveHabit = useCallback(async (id: string, archived: boolean) => {
    await habitRepository.update(id, { archived });
  }, []);

  const onDeleteHabit = useCallback(async (id: string) => {
    await habitRepository.remove(id);
  }, []);

  const onCreateMindfulness = useCallback(
    async (values: Omit<MindfulnessSession, "id" | "createdAt" | "updatedAt">) => {
      await mindfulnessRepository.create(values);
    },
    [],
  );

  const onDeleteMindfulness = useCallback(
    (id: string) => mindfulnessRepository.remove(id),
    [],
  );

  const onCreateJournal = useCallback(
    async (values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">) => {
      await journalRepository.create(values);
    },
    [],
  );

  const onUpdateJournal = useCallback(
    async (id: string, values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">) => {
      await journalRepository.update(id, values);
    },
    [],
  );

  const onDeleteJournal = useCallback((id: string) => journalRepository.remove(id), []);

  const onSaveGratitude = useCallback(
    async (
      values: Omit<GratitudeEntry, "id" | "createdAt" | "updatedAt">,
    ): Promise<"created" | "updated"> => {
      const existing = await getGratitudeByDate(values.date);
      if (existing) {
        await gratitudeRepository.update(existing.id, { items: values.items });
        return "updated";
      }
      await gratitudeRepository.create(values);
      return "created";
    },
    [],
  );

  const onDeleteGratitude = useCallback((id: string) => gratitudeRepository.remove(id), []);

  const onCreateActivity = useCallback(
    async (values: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">) => {
      await activityRepository.create(values);
    },
    [],
  );

  const onUpdateActivity = useCallback(
    async (id: string, values: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">) => {
      await activityRepository.update(id, values);
    },
    [],
  );

  const onDeleteActivity = useCallback((id: string) => activityRepository.remove(id), []);

  const isLoading =
    settings.isLoading ||
    checkins.isLoading ||
    sleep.isLoading ||
    movement.isLoading ||
    nutrition.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading ||
    mindfulness.isLoading ||
    journal.isLoading ||
    gratitude.isLoading ||
    activities.isLoading;

  if (
    isLoading ||
    !settings.data ||
    !checkins.data ||
    !sleep.data ||
    !movement.data ||
    !nutrition.data ||
    !habits.data ||
    !habitLogs.data ||
    !mindfulness.data ||
    !journal.data ||
    !gratitude.data ||
    !activities.data
  ) {
    return <HabitsSkeleton />;
  }

  return (
    <HabitsWorkspace
      sleepTargetMin={settings.data.sleepTargetMin}
      checkins={checkins.data}
      sleepLogs={sleep.data}
      movementLogs={movement.data}
      nutritionLogs={nutrition.data}
      habits={habits.data}
      habitLogs={habitLogs.data}
      mindfulnessSessions={mindfulness.data}
      journalEntries={journal.data}
      gratitudeEntries={gratitude.data}
      activityLogs={activities.data}
      onSaveCheckin={onSaveCheckin}
      onDeleteCheckin={onDeleteCheckin}
      onCreateSleep={onCreateSleep}
      onUpdateSleep={onUpdateSleep}
      onDeleteSleep={onDeleteSleep}
      onCreateMovement={onCreateMovement}
      onUpdateMovement={onUpdateMovement}
      onDeleteMovement={onDeleteMovement}
      onCreateNutrition={onCreateNutrition}
      onUpdateNutrition={onUpdateNutrition}
      onDeleteNutrition={onDeleteNutrition}
      onToggleHabit={onToggleHabit}
      onAddHabit={onAddHabit}
      onRenameHabit={onRenameHabit}
      onArchiveHabit={onArchiveHabit}
      onDeleteHabit={onDeleteHabit}
      onCreateMindfulness={onCreateMindfulness}
      onDeleteMindfulness={onDeleteMindfulness}
      onCreateJournal={onCreateJournal}
      onUpdateJournal={onUpdateJournal}
      onDeleteJournal={onDeleteJournal}
      onSaveGratitude={onSaveGratitude}
      onDeleteGratitude={onDeleteGratitude}
      onCreateActivity={onCreateActivity}
      onUpdateActivity={onUpdateActivity}
      onDeleteActivity={onDeleteActivity}
    />
  );
}
