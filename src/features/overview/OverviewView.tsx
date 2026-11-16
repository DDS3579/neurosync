"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, Check, CircleDashed, Plus, Sparkles, Telescope } from "lucide-react";
import { motion } from "motion/react";

import {
  ChartCard,
  EmptyState,
  InsightCard,
  PageHeader,
  StatCard,
} from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { cn } from "@/lib/utils";
import type { Insight, RegionId } from "@/types/domain";

import {
  FocusChart,
  MoodChart,
  SleepChart,
  type FocusChartPoint,
  type MoodChartPoint,
  type SleepChartPoint,
} from "./overview-charts";

export interface OverviewViewProps {
  greetingName?: string;
  today: {
    checkinDone: boolean;
    sleepLogged: boolean;
    focusMinutes: number;
    movementMinutes: number;
  };
  movementWeekDays?: number;
  sleepWeek: { date: string; hours: number | null }[];
  sleepTargetHours: number;
  focusWeek: { date: string; minutes: number }[];
  moodWeek: { date: string; mood: number | null; concentration: number | null }[];
  insights: Insight[];
  brainActivity: Partial<Record<RegionId, number>>;
  isEmpty: boolean;
  hasDemoData?: boolean;
  onLogToday(): void;
  onLoadDemo?(): void;
  onClearDemo?(): void;
  onOpenBrain(): void;
  onDismissInsight?(insight: Insight): void;
  onSnoozeInsight?(insight: Insight): void;
}

/** Same wording as the brain feature's ACTIVITY_DISCLAIMER, kept local so the
 *  3D bundle is not pulled in by a static import from that barrel. */
const ACTIVITY_NOTE = "Educational association, not a measurement of your brain activity.";

const LAYOUT = "grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BrainPreview = dynamic(
  () => import("@/features/brain").then((mod) => mod.BrainExplorer),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none bg-surface-2" />,
  },
);

const noopSelectRegion = () => {};

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : (WEEKDAY_SHORT[parsed.getDay()] ?? date);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

const emptySubscribe = () => () => {};

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Staggered fade; `lift` adds the 8px rise for cells whose content does not
 *  animate itself (the nx cards handle their own translate). */
function Entrance({
  index,
  lift = false,
  className,
  children,
}: {
  index: number;
  lift?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduce = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : lift ? { opacity: 0, y: 8 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut", delay: index * 0.04 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatusTile({
  label,
  done,
  onLogToday,
}: {
  label: string;
  done: boolean;
  onLogToday: () => void;
}) {
  if (done) {
    return (
      <div className="flex flex-col gap-2 rounded-control border border-border bg-surface-2 px-3 py-3">
        <span className="text-caption text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5 text-body text-foreground">
          <Check className="size-4 text-cyan" aria-hidden />
          Logged
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogToday}
      className="flex flex-col items-start gap-2 rounded-control border border-dashed border-border bg-transparent px-3 py-3 text-left transition-colors duration-[180ms] ease-out hover:border-border-strong"
    >
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-body text-muted-foreground">
        <CircleDashed className="size-4" aria-hidden />
        Not logged yet
      </span>
    </button>
  );
}

export function OverviewView({
  greetingName,
  today,
  movementWeekDays,
  sleepWeek,
  sleepTargetHours,
  focusWeek,
  moodWeek,
  insights,
  brainActivity,
  isEmpty,
  hasDemoData,
  onLogToday,
  onLoadDemo,
  onClearDemo,
  onOpenBrain,
  onDismissInsight,
  onSnoozeInsight,
}: OverviewViewProps) {
  // Derived on the client only: the server has no reliable local hour.
  const greeting = useSyncExternalStore(
    emptySubscribe,
    () => greetingFor(new Date().getHours()),
    () => null,
  );

  const title = greeting
    ? greetingName
      ? `${greeting}, ${greetingName}`
      : greeting
    : greetingName
      ? `Hello, ${greetingName}`
      : "Hello";

  const sleepSeries = useMemo<SleepChartPoint[]>(
    () => sleepWeek.map((entry) => ({ day: dayLabel(entry.date), hours: entry.hours })),
    [sleepWeek],
  );

  const focusSeries = useMemo<FocusChartPoint[]>(
    () => focusWeek.map((entry) => ({ day: dayLabel(entry.date), minutes: entry.minutes })),
    [focusWeek],
  );

  const moodSeries = useMemo<MoodChartPoint[]>(
    () =>
      moodWeek.map((entry) => ({
        day: dayLabel(entry.date),
        mood: entry.mood,
        concentration: entry.concentration,
      })),
    [moodWeek],
  );

  const sleepValues = useMemo(
    () => sleepWeek.flatMap((entry) => (entry.hours === null ? [] : [entry.hours])),
    [sleepWeek],
  );
  const focusTotal = focusWeek.reduce((total, entry) => total + entry.minutes, 0);
  const moodValues = moodWeek.flatMap((entry) => (entry.mood === null ? [] : [entry.mood]));
  const concentrationValues = moodWeek.flatMap((entry) =>
    entry.concentration === null ? [] : [entry.concentration],
  );

  const sleepAverage = average(sleepValues);
  const moodAverage = average(moodValues);
  const concentrationAverage = average(concentrationValues);

  const sleepEmpty = sleepValues.length === 0;
  const focusEmpty = focusTotal === 0;
  const moodEmpty = moodValues.length === 0 && concentrationValues.length === 0;

  const sleepSummary = sleepEmpty
    ? "No sleep logged this week yet."
    : `Average sleep this week: ${oneDecimal(sleepAverage ?? 0)} hours across ${
        sleepValues.length
      } ${sleepValues.length === 1 ? "night" : "nights"}.`;

  const focusSummary = focusEmpty
    ? "No focus minutes logged this week yet."
    : `Focus this week: ${focusTotal} minutes in total.`;

  const moodSummary =
    moodAverage === null && concentrationAverage === null
      ? "No check-ins logged this week yet."
      : `Average mood this week: ${
          moodAverage === null ? "no entries" : `${oneDecimal(moodAverage)} out of 5`
        }. Average concentration: ${
          concentrationAverage === null
            ? "no entries"
            : `${oneDecimal(concentrationAverage)} out of 5`
        }.`;

  const visibleInsights = insights.slice(0, 3);

  const header = (
    <PageHeader
      title={title}
      description="Here's how your week looks."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {hasDemoData && onClearDemo ? (
            <Button onClick={onClearDemo} variant="ghost" className="rounded-control">
              Clear demo data
            </Button>
          ) : null}
          <Button asChild variant="outline" className="gap-1.5 rounded-control">
            <Link href="/insights/weekly">
              Your week
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button onClick={onLogToday} variant="outline" className="gap-1.5 rounded-control">
            <Plus className="size-4" aria-hidden />
            Log today
          </Button>
        </div>
      }
    />
  );

  if (isEmpty) {
    return (
      <div className={LAYOUT}>
        <Entrance index={0} className="md:col-span-6 xl:col-span-12">
          {header}
        </Entrance>

        <Entrance index={1} lift className="md:col-span-6 xl:col-span-12">
          <EmptyState
            icon={<Telescope />}
            title="Your observatory is empty"
            description="Nothing is logged yet. A single day is enough to start — this page fills in as you go, and it never grades you."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={onLogToday}
                  className="rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  Log your first day
                </Button>
                {onLoadDemo ? (
                  <Button onClick={onLoadDemo} variant="outline" className="rounded-control">
                    Load demo data
                  </Button>
                ) : null}
              </div>
            }
          />
        </Entrance>
      </div>
    );
  }

  return (
    <div className={LAYOUT}>
      <Entrance index={0} className="md:col-span-6 xl:col-span-12">
        {header}
      </Entrance>

      <Entrance index={1} lift className="md:col-span-6 xl:col-span-8">
        <Card className="h-full gap-0 rounded-card border border-border bg-surface py-0 ring-0 shadow-none transition-colors duration-[180ms] ease-out hover:border-border-strong">
          <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-section font-medium text-foreground">Today</p>
            <p className="text-caption text-muted-foreground">Small entries count</p>
          </div>

          <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2">
            <StatusTile
              label="Check-in"
              done={today.checkinDone}
              onLogToday={onLogToday}
            />
            <StatusTile label="Sleep" done={today.sleepLogged} onLogToday={onLogToday} />
            <StatCard label="Focus" value={today.focusMinutes} unit="min" hint="Today" />
            <StatCard
              label="Movement"
              value={today.movementMinutes}
              unit="min"
              hint={
                movementWeekDays !== undefined
                  ? `Today · ${movementWeekDays} ${movementWeekDays === 1 ? "day" : "days"} this week`
                  : "Today"
              }
            />
          </div>
        </Card>
      </Entrance>

      <Entrance index={2} lift className="md:col-span-6 xl:col-span-4 xl:row-span-2">
        <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-card border border-border bg-surface py-0 ring-0 shadow-none transition-colors duration-[180ms] ease-out hover:border-border-strong">
          <div
            className="pointer-events-none relative h-[240px] w-full overflow-hidden border-b border-border bg-background"
            inert
          >
            <BrainPreview
              mode="activity"
              selectedRegion={null}
              activity={brainActivity}
              onSelectRegion={noopSelectRegion}
              quality="low"
              className="h-full w-full rounded-none border-0"
            />
          </div>

          <div className="flex flex-1 flex-col gap-2 p-4">
            <p className="text-section font-medium text-foreground">Brain preview</p>
            <p className="text-caption text-muted-foreground">{ACTIVITY_NOTE}</p>
            <Button
              variant="outline"
              onClick={onOpenBrain}
              className="mt-auto w-fit rounded-control"
            >
              Open Brain Explorer
            </Button>
          </div>
        </Card>
      </Entrance>

      <div className={cn("flex flex-wrap gap-4 md:col-span-6 xl:col-span-8")}>
        <Entrance index={3} className="min-w-[min(220px,100%)] flex-1">
          <ChartCard
            title="Sleep"
            description={`Target ${oneDecimal(sleepTargetHours)} hours a night`}
            summary={sleepSummary}
            tableData={{
              caption: "Logged sleep hours across the last 7 days",
              columns: ["Day", "Sleep (hours)"],
              rows: sleepSeries.map((row) => [
                row.day,
                row.hours === null ? "—" : row.hours.toFixed(1),
              ]),
            }}
            empty={sleepEmpty}
            emptyMessage="No nights logged this week yet."
          >
            <SleepChart data={sleepSeries} targetHours={sleepTargetHours} />
          </ChartCard>
        </Entrance>

        <Entrance index={4} className="min-w-[min(220px,100%)] flex-1">
          <ChartCard
            title="Focus"
            description="Minutes per day"
            summary={focusSummary}
            tableData={{
              caption: "Focus minutes across the last 7 days",
              columns: ["Day", "Minutes"],
              rows: focusSeries.map((row) => [row.day, row.minutes]),
            }}
            empty={focusEmpty}
            emptyMessage="No focus sessions logged this week yet."
          >
            <FocusChart data={focusSeries} />
          </ChartCard>
        </Entrance>

        <Entrance index={5} className="min-w-[min(220px,100%)] flex-1">
          <ChartCard
            title="Mood & concentration"
            description="Rated 1 to 5 on check-in days"
            summary={moodSummary}
            tableData={{
              caption: "Daily mood and concentration ratings across the last 7 days",
              columns: ["Day", "Mood", "Concentration"],
              rows: moodSeries.map((row) => [
                row.day,
                row.mood === null ? "—" : `${row.mood}/5`,
                row.concentration === null ? "—" : `${row.concentration}/5`,
              ]),
            }}
            empty={moodEmpty}
            emptyMessage="No check-ins logged this week yet."
          >
            <MoodChart data={moodSeries} />
          </ChartCard>
        </Entrance>
      </div>

      <Entrance index={6} className="md:col-span-6 xl:col-span-12">
        <section aria-labelledby="overview-patterns">
          <h2
            id="overview-patterns"
            className="mb-3 text-section font-medium text-foreground"
          >
            Patterns worth noticing
          </h2>

          {visibleInsights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onDismiss={onDismissInsight}
                  onSnooze={onSnoozeInsight}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles />}
              title="No patterns yet"
              description="Patterns appear once a few days have data. Two or three logged days is usually enough for something worth keeping."
            />
          )}
        </section>
      </Entrance>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className={LAYOUT} aria-hidden>
      <div className="space-y-2 md:col-span-6 xl:col-span-12">
        <Skeleton className="h-8 w-64 rounded-[6px]" />
        <Skeleton className="h-4 w-80 rounded-[4px]" />
      </div>

      <Skeleton className="h-[184px] rounded-card md:col-span-6 xl:col-span-8" />
      <Skeleton className="h-[404px] rounded-card md:col-span-6 xl:col-span-4 xl:row-span-2" />

      <div className="flex flex-wrap gap-4 md:col-span-6 xl:col-span-8">
        <Skeleton className="h-[244px] min-w-[220px] flex-1 rounded-card" />
        <Skeleton className="h-[244px] min-w-[220px] flex-1 rounded-card" />
        <Skeleton className="h-[244px] min-w-[220px] flex-1 rounded-card" />
      </div>

      <div className="space-y-3 md:col-span-6 xl:col-span-12">
        <Skeleton className="h-5 w-48 rounded-[4px]" />
        <Skeleton className="h-[196px] rounded-card" />
      </div>
    </div>
  );
}
