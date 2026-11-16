"use client";

import { useCallback, useSyncExternalStore } from "react";

import { PageHeader } from "@/components/nx";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HABIT_HASH_EVENT,
  parseHabitTabHash,
  type HabitTab,
} from "@/features/habits/habitUtils";
import type {
  ActivityLog,
  DailyCheckin,
  GratitudeEntry,
  Habit,
  HabitLog,
  ISODate,
  JournalEntry,
  MindfulnessSession,
  MovementLog,
  NutritionLog,
  SleepLog,
} from "@/types/domain";

import { ActivitiesTab } from "@/features/activities/components/ActivitiesTab";
import { CheckinTab } from "./CheckinTab";
import { HabitsTab } from "./HabitsTab";
import { MovementTab } from "./MovementTab";
import { NutritionTab } from "./NutritionTab";
import { SleepTab } from "./SleepTab";
import { MindTab } from "@/features/mind/components/MindTab";

export interface HabitsWorkspaceProps {
  sleepTargetMin: number;
  checkins: DailyCheckin[];
  sleepLogs: SleepLog[];
  movementLogs: MovementLog[];
  nutritionLogs: NutritionLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  onSaveCheckin: (
    values: Omit<DailyCheckin, "id" | "createdAt" | "updatedAt">,
  ) => Promise<"created" | "updated">;
  onDeleteCheckin: (id: string) => Promise<void>;
  onCreateSleep: (values: Omit<SleepLog, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateSleep: (
    id: string,
    values: Omit<SleepLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteSleep: (id: string) => Promise<void>;
  onCreateMovement: (
    values: Omit<MovementLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateMovement: (
    id: string,
    values: Omit<MovementLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteMovement: (id: string) => Promise<void>;
  onCreateNutrition: (
    values: Omit<NutritionLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateNutrition: (
    id: string,
    values: Omit<NutritionLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteNutrition: (id: string) => Promise<void>;
  onToggleHabit: (habitId: string, date: ISODate, nextDone: boolean) => Promise<void>;
  onAddHabit: (name: string) => Promise<void>;
  onRenameHabit: (id: string, name: string) => Promise<void>;
  onArchiveHabit: (id: string, archived: boolean) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
  mindfulnessSessions: MindfulnessSession[];
  journalEntries: JournalEntry[];
  gratitudeEntries: GratitudeEntry[];
  onCreateMindfulness: (
    values: Omit<MindfulnessSession, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteMindfulness: (id: string) => Promise<void>;
  onCreateJournal: (
    values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateJournal: (
    id: string,
    values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteJournal: (id: string) => Promise<void>;
  onSaveGratitude: (
    values: Omit<GratitudeEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<"created" | "updated">;
  onDeleteGratitude: (id: string) => Promise<void>;
  activityLogs: ActivityLog[];
  onCreateActivity: (
    values: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateActivity: (
    id: string,
    values: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
}

function subscribeHabitHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(HABIT_HASH_EVENT, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(HABIT_HASH_EVENT, callback);
  };
}

function getHabitHashSnapshot(): HabitTab {
  return parseHabitTabHash(window.location.hash);
}

export function HabitsWorkspace(props: HabitsWorkspaceProps) {
  const activeTab = useSyncExternalStore(
    subscribeHabitHash,
    getHabitHashSnapshot,
    () => "checkin",
  );

  const handleTabChange = useCallback((next: string) => {
    const tab = parseHabitTabHash(next);
    if (typeof window !== "undefined") {
      const nextUrl = `${window.location.pathname}${window.location.search}#${tab}`;
      window.history.replaceState(null, "", nextUrl);
      window.dispatchEvent(new Event(HABIT_HASH_EVENT));
    }
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Habits"
        description="Log today's check-in, sleep, movement, nutrition, habits, and mind notes locally with zero streak pressure."
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-control border border-border bg-surface p-1 sm:w-fit">
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
          <TabsTrigger value="movement">Movement</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="mind">Mind</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
          <CheckinTab
            checkins={props.checkins}
            onSaveCheckin={props.onSaveCheckin}
            onDeleteCheckin={props.onDeleteCheckin}
          />
        </TabsContent>

        <TabsContent value="sleep">
          <SleepTab
            sleepLogs={props.sleepLogs}
            sleepTargetMin={props.sleepTargetMin}
            onCreateSleep={props.onCreateSleep}
            onUpdateSleep={props.onUpdateSleep}
            onDeleteSleep={props.onDeleteSleep}
          />
        </TabsContent>

        <TabsContent value="movement">
          <MovementTab
            movementLogs={props.movementLogs}
            onCreateMovement={props.onCreateMovement}
            onUpdateMovement={props.onUpdateMovement}
            onDeleteMovement={props.onDeleteMovement}
          />
        </TabsContent>

        <TabsContent value="nutrition">
          <NutritionTab
            nutritionLogs={props.nutritionLogs}
            onCreateNutrition={props.onCreateNutrition}
            onUpdateNutrition={props.onUpdateNutrition}
            onDeleteNutrition={props.onDeleteNutrition}
          />
        </TabsContent>

        <TabsContent value="habits">
          <HabitsTab
            habits={props.habits}
            habitLogs={props.habitLogs}
            onToggleHabit={props.onToggleHabit}
            onAddHabit={props.onAddHabit}
            onRenameHabit={props.onRenameHabit}
            onArchiveHabit={props.onArchiveHabit}
            onDeleteHabit={props.onDeleteHabit}
          />
        </TabsContent>

        <TabsContent value="mind">
          <MindTab
            mindfulnessSessions={props.mindfulnessSessions}
            journalEntries={props.journalEntries}
            gratitudeEntries={props.gratitudeEntries}
            onCreateMindfulness={props.onCreateMindfulness}
            onDeleteMindfulness={props.onDeleteMindfulness}
            onCreateJournal={props.onCreateJournal}
            onUpdateJournal={props.onUpdateJournal}
            onDeleteJournal={props.onDeleteJournal}
            onSaveGratitude={props.onSaveGratitude}
            onDeleteGratitude={props.onDeleteGratitude}
          />
        </TabsContent>

        <TabsContent value="activities">
          <ActivitiesTab
            activityLogs={props.activityLogs}
            onCreateActivity={props.onCreateActivity}
            onUpdateActivity={props.onUpdateActivity}
            onDeleteActivity={props.onDeleteActivity}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function HabitsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <Skeleton className="h-10 w-80 max-w-full rounded-control" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[460px] rounded-card lg:col-span-7" />
        <Skeleton className="h-[340px] rounded-card lg:col-span-5" />
      </div>
    </div>
  );
}
