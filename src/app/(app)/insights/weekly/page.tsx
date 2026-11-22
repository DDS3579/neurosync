"use client";

import { useMemo, useState } from "react";
import { format, startOfDay, startOfWeek, subWeeks } from "date-fns";

import {
  WeeklyReportSkeleton,
  WeeklyReportWorkspace,
} from "@/features/insights/components/WeeklyReportWorkspace";
import {
  useActivityLogs,
  useBlocks,
  useCheckins,
  useDayPlanMeta,
  useDayPlans,
  useFocusSessions,
  useGratitudeEntries,
  useHabitLogs,
  useHabits,
  useJournalEntries,
  useMindfulnessSessions,
  useMovementLogs,
  useNutritionLogs,
  useProjects,
  useSettings,
  useSleepLogs,
  useTasks,
} from "@/lib/db/hooks";
import { buildWeeklyReport } from "@/lib/insights";
import type { ISODate } from "@/types/domain";

export default function WeeklyReportPage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const settings = useSettings();
  const sleep = useSleepLogs();
  const checkins = useCheckins();
  const focus = useFocusSessions();
  const movement = useMovementLogs();
  const nutrition = useNutritionLogs();
  const habits = useHabits();
  const habitLogs = useHabitLogs();
  const mindfulness = useMindfulnessSessions();
  const journal = useJournalEntries();
  const gratitude = useGratitudeEntries();
  const activities = useActivityLogs();
  const blocks = useBlocks();
  const tasks = useTasks();
  const projects = useProjects();
  const dayPlans = useDayPlans();
  const dayPlanMeta = useDayPlanMeta();

  const isLoading =
    settings.isLoading ||
    sleep.isLoading ||
    checkins.isLoading ||
    focus.isLoading ||
    movement.isLoading ||
    nutrition.isLoading ||
    habits.isLoading ||
    habitLogs.isLoading ||
    mindfulness.isLoading ||
    journal.isLoading ||
    gratitude.isLoading ||
    activities.isLoading ||
    blocks.isLoading ||
    tasks.isLoading ||
    projects.isLoading ||
    dayPlans.isLoading ||
    dayPlanMeta.isLoading;

  const computed = useMemo(() => {
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
      !mindfulness.data ||
      !journal.data ||
      !gratitude.data ||
      !activities.data ||
      !blocks.data ||
      !tasks.data ||
      !projects.data ||
      !dayPlans.data ||
      !dayPlanMeta.data
    ) {
      return null;
    }

    const today = startOfDay(new Date());
    const targetWeekStart = startOfWeek(subWeeks(today, weekOffset), { weekStartsOn: 1 });
    const weekStartISO: ISODate = format(targetWeekStart, "yyyy-MM-dd");

    const report = buildWeeklyReport(
      {
        settings: settings.data,
        sleep: sleep.data,
        checkins: checkins.data,
        focus: focus.data,
        movement: movement.data,
        nutrition: nutrition.data,
        habits: habits.data,
        habitLogs: habitLogs.data,
        mindfulness: mindfulness.data,
        journal: journal.data,
        gratitude: gratitude.data,
        activities: activities.data,
        blocks: blocks.data,
        tasks: tasks.data,
        projects: projects.data,
        dayPlans: dayPlans.data,
      },
      weekStartISO,
    );

    return {
      report,
      sleepTargetHours: Number((settings.data.sleepTargetMin / 60).toFixed(2)),
    };
  }, [
    isLoading,
    weekOffset,
    settings.data,
    sleep.data,
    checkins.data,
    focus.data,
    movement.data,
    nutrition.data,
    habits.data,
    habitLogs.data,
    mindfulness.data,
    journal.data,
    gratitude.data,
    activities.data,
    blocks.data,
    tasks.data,
    projects.data,
    dayPlans.data,
    dayPlanMeta.data,
  ]);

  if (!computed) {
    return <WeeklyReportSkeleton />;
  }

  return (
    <WeeklyReportWorkspace
      report={computed.report}
      sleepTargetHours={computed.sleepTargetHours}
      weekOffset={weekOffset}
      onPrevWeek={() => setWeekOffset((w) => w + 1)}
      onNextWeek={() => setWeekOffset((w) => Math.max(0, w - 1))}
      onCurrentWeek={() => setWeekOffset(0)}
    />
  );
}
