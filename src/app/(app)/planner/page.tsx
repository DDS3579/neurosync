"use client";

import { useCallback, useMemo } from "react";
import {
  PlannerConnectionsShell,
  PlannerConnectionsSkeleton,
} from "@/features/planner/components/PlannerConnectionsShell";
import {
  useBlocks,
  useDayPlanMeta,
  useDayPlans,
  useFocusSessions,
  useProjects,
  useSettings,
  useTasks,
} from "@/lib/db/hooks";
import { dayPlanRepository, getDayPlanByDate } from "@/lib/db/repositories";
import type { DayPlan, ISODate } from "@/types/domain";

export default function PlannerPage() {
  const settings = useSettings();
  const focus = useFocusSessions();
  const plans = useDayPlans();
  const projects = useProjects();
  const tasks = useTasks();
  const blocks = useBlocks();
  const meta = useDayPlanMeta();

  const onSavePlan = useCallback(
    async (plan: Omit<DayPlan, "id" | "createdAt" | "updatedAt">): Promise<"created" | "updated"> => {
      const existing = await getDayPlanByDate(plan.date);
      if (existing) {
        await dayPlanRepository.update(existing.id, plan);
        return "updated";
      }
      await dayPlanRepository.create(plan);
      return "created";
    },
    [],
  );

  const shutdownDates = useMemo(
    () => new Set<ISODate>((meta.data ?? []).filter((m) => m.shutdownDone).map((m) => m.date)),
    [meta.data],
  );
  const reflections = useMemo(
    () =>
      new Map<ISODate, string>(
        (meta.data ?? [])
          .filter((m) => Boolean(m.reflection))
          .map((m) => [m.date, m.reflection as string]),
      ),
    [meta.data],
  );

  if (
    settings.isLoading || focus.isLoading || plans.isLoading || projects.isLoading ||
    tasks.isLoading || blocks.isLoading || meta.isLoading ||
    !settings.data || !focus.data || !plans.data || !projects.data ||
    !tasks.data || !blocks.data || !meta.data
  ) {
    return <PlannerConnectionsSkeleton />;
  }

  return (
    <PlannerConnectionsShell
      settings={settings.data}
      projects={projects.data}
      tasks={tasks.data}
      blocks={blocks.data}
      focusSessions={focus.data}
      plans={plans.data}
      shutdownDates={shutdownDates}
      reflections={reflections}
      onSavePlan={onSavePlan}
    />
  );
}
