"use client";

import { useCallback } from "react";

import {
  PlannerSkeleton,
  PlannerWorkspace,
} from "@/features/planner/components/PlannerWorkspace";
import { useDayPlans, useFocusSessions, useSettings } from "@/lib/db/hooks";
import { dayPlanRepository, getDayPlanByDate } from "@/lib/db/repositories";
import type { DayPlan } from "@/types/domain";

export default function PlannerPage() {
  const settings = useSettings();
  const focus = useFocusSessions();
  const plans = useDayPlans();

  const onSavePlan = useCallback(
    async (
      plan: Omit<DayPlan, "id" | "createdAt" | "updatedAt">,
    ): Promise<"created" | "updated"> => {
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

  if (
    settings.isLoading ||
    focus.isLoading ||
    plans.isLoading ||
    !settings.data ||
    !focus.data ||
    !plans.data
  ) {
    return <PlannerSkeleton />;
  }

  return (
    <PlannerWorkspace
      defaultSleepTargetMin={settings.data.sleepTargetMin}
      defaultBreakMin={settings.data.breakDefaultMin}
      focusSessions={focus.data}
      savedPlans={plans.data}
      onSavePlan={onSavePlan}
    />
  );
}
