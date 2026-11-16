"use client";

import { useCallback, useMemo, useState } from "react";
import { format, startOfDay, startOfWeek, subDays, subWeeks } from "date-fns";
import { toast } from "sonner";

import {
  InsightsSkeleton,
  InsightsWorkspace,
} from "@/features/insights/components/InsightsWorkspace";
import {
  useActivityLogs,
  useCheckins,
  useFocusSessions,
  useGratitudeEntries,
  useHabitLogs,
  useHabits,
  useInsightFeedback,
  useJournalEntries,
  useMindfulnessSessions,
  useMovementLogs,
  useNutritionLogs,
  useSettings,
  useSleepLogs,
} from "@/lib/db/hooks";
import { insightFeedbackRepository } from "@/lib/db/repositories";
import {
  buildWeeklyReport,
  computeInsights,
  partitionInsightsByFeedback,
} from "@/lib/insights";
import type { ISODate, Insight } from "@/types/domain";

export default function InsightsPage() {
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  const settings = useSettings();
  const sleep = useSleepLogs();
  const checkins = useCheckins();
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const nutrition = useNutritionLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const activities = useActivityLogs();
  const mindfulness = useMindfulnessSessions();
  const journal = useJournalEntries();
  const gratitude = useGratitudeEntries();
  const insightFeedback = useInsightFeedback();

  const settingsData = settings.data;
  const sleepData = sleep.data;
  const checkinsData = checkins.data;
  const focusData = focus.data;
  const movementData = movement.data;
  const nutritionData = nutrition.data;
  const habitsData = habits.data;
  const habitLogsData = habitLogs.data;
  const activitiesData = activities.data;
  const mindfulnessData = mindfulness.data;
  const journalData = journal.data;
  const gratitudeData = gratitude.data;
  const insightFeedbackData = insightFeedback.data;

  const isLoading =
    settings.isLoading ||
    sleep.isLoading ||
    checkins.isLoading ||
    focus.isLoading ||
    movement.isLoading ||
    nutrition.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading ||
    activities.isLoading ||
    mindfulness.isLoading ||
    journal.isLoading ||
    gratitude.isLoading ||
    insightFeedback.isLoading;

  const onDismissInsight = useCallback(async (insight: Insight) => {
    await insightFeedbackRepository.dismiss({
      id: insight.id,
      title: insight.title,
      pillar: insight.pillar,
    });
    toast.success("Insight moved to Dismissed.");
  }, []);

  const onSnoozeInsight = useCallback(async (insight: Insight) => {
    const todayISO = format(startOfDay(new Date()), "yyyy-MM-dd");
    await insightFeedbackRepository.snooze(
      { id: insight.id, title: insight.title, pillar: insight.pillar },
      todayISO,
    );
    toast.success("Insight snoozed for 14 days.");
  }, []);

  const onRestoreInsight = useCallback(async (insightId: string) => {
    await insightFeedbackRepository.restore(insightId);
    toast.success("Insight restored.");
  }, []);

  const computed = useMemo(() => {
    if (
      isLoading ||
      !settingsData ||
      !sleepData ||
      !checkinsData ||
      !focusData ||
      !movementData ||
      !nutritionData ||
      !habitsData ||
      !habitLogsData ||
      !activitiesData ||
      !mindfulnessData ||
      !journalData ||
      !gratitudeData ||
      !insightFeedbackData
    ) {
      return null;
    }

    const today = startOfDay(new Date());
    const todayISO: ISODate = format(today, "yyyy-MM-dd");
    const targetWeekStart = startOfWeek(subWeeks(today, weekOffset), { weekStartsOn: 1 });
    const weekStartISO: ISODate = format(targetWeekStart, "yyyy-MM-dd");

    const input = {
      settings: settingsData,
      sleep: sleepData,
      checkins: checkinsData,
      focus: focusData,
      movement: movementData,
      nutrition: nutritionData,
      habits: habitsData,
      habitLogs: habitLogsData,
      activities: activitiesData,
      mindfulness: mindfulnessData,
      journal: journalData,
      gratitude: gratitudeData,
    };

    const allInsights = computeInsights(input, todayISO);
    const {
      active: insights,
      dismissed: dismissedInsights,
      snoozed: snoozedInsights,
    } = partitionInsightsByFeedback(allInsights, insightFeedbackData, todayISO);
    const weeklyReport = buildWeeklyReport(input, weekStartISO);

    const dates7: ISODate[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      dates7.push(format(subDays(today, offset), "yyyy-MM-dd"));
    }

    const sleepByDate = new Map(sleepData.map((r) => [r.date, r]));
    const checkinByDate = new Map(checkinsData.map((r) => [r.date, r]));
    const focusMinByDate = new Map<ISODate, number>();
    for (const s of focusData) {
      focusMinByDate.set(s.date, (focusMinByDate.get(s.date) ?? 0) + s.durationMin);
    }

    return {
      insights,
      dismissedInsights,
      snoozedInsights,
      weeklyReport,
      sleepWeek: dates7.map((date) => {
        const log = sleepByDate.get(date);
        return { date, hours: log ? Number((log.durationMin / 60).toFixed(2)) : null };
      }),
      sleepTargetHours: Number((settingsData.sleepTargetMin / 60).toFixed(2)),
      focusWeek: dates7.map((date) => ({
        date,
        minutes: focusMinByDate.get(date) ?? 0,
      })),
      moodWeek: dates7.map((date) => {
        const c = checkinByDate.get(date);
        return { date, mood: c ? c.mood : null, concentration: c ? c.concentration : null };
      }),
    };
  }, [
    isLoading,
    weekOffset,
    settingsData,
    sleepData,
    checkinsData,
    focusData,
    movementData,
    nutritionData,
    habitsData,
    habitLogsData,
    activitiesData,
    mindfulnessData,
    journalData,
    gratitudeData,
    insightFeedbackData,
  ]);

  if (!computed) {
    return <InsightsSkeleton />;
  }

  return (
    <InsightsWorkspace
      {...computed}
      weekOffset={weekOffset}
      onChangeWeekOffset={setWeekOffset}
      onDismissInsight={onDismissInsight}
      onSnoozeInsight={onSnoozeInsight}
      onRestoreInsight={onRestoreInsight}
    />
  );
}
