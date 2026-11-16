"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ChartCard, EmptyState, InsightCard, PageHeader, StatCard } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FocusChart,
  MoodChart,
  SleepChart,
  type FocusChartPoint,
  type MoodChartPoint,
  type SleepChartPoint,
} from "@/features/overview/overview-charts";
import type { WeeklyReport } from "@/lib/insights";
import type { Insight, Pillar } from "@/types/domain";

const PILLAR_LABELS: Record<Pillar, string> = {
  sleep: "Sleep",
  focus: "Focus",
  movement: "Movement",
  nutrition: "Nutrition",
  wellbeing: "Wellbeing",
  learning: "Learning",
};

const PILLAR_ORDER: readonly Pillar[] = [
  "sleep",
  "focus",
  "movement",
  "learning",
  "nutrition",
  "wellbeing",
];

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : (WEEKDAY_SHORT[parsed.getDay()] ?? date);
}

export interface InsightsWorkspaceProps {
  insights: Insight[];
  weeklyReport: WeeklyReport;
  sleepWeek: { date: string; hours: number | null }[];
  sleepTargetHours: number;
  focusWeek: { date: string; minutes: number }[];
  moodWeek: { date: string; mood: number | null; concentration: number | null }[];
  weekOffset: 0 | 1;
  onChangeWeekOffset: (next: 0 | 1) => void;
}

export function InsightsWorkspace({
  insights,
  weeklyReport,
  sleepWeek,
  sleepTargetHours,
  focusWeek,
  moodWeek,
  weekOffset,
  onChangeWeekOffset,
}: InsightsWorkspaceProps) {
  const grouped = useMemo(() => {
    const map = new Map<Pillar, Insight[]>();
    for (const pillar of PILLAR_ORDER) map.set(pillar, []);
    for (const item of insights) {
      map.get(item.pillar)?.push(item);
    }
    return PILLAR_ORDER.filter((p) => (map.get(p)?.length ?? 0) > 0).map((p) => ({
      pillar: p,
      label: PILLAR_LABELS[p],
      items: map.get(p) ?? [],
    }));
  }, [insights]);

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

  const sleepEmpty = sleepSeries.every((p) => p.hours === null);
  const focusEmpty = focusSeries.every((p) => p.minutes === 0);
  const moodEmpty = moodSeries.every((p) => p.mood === null && p.concentration === null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Deterministic observations from your own logs, each paired with its evidence and a clear caveat."
      />

      <Tabs defaultValue="observations" className="space-y-6">
        <TabsList className="h-auto w-fit rounded-control border border-border bg-surface p-1">
          <TabsTrigger value="observations">Observations & Charts</TabsTrigger>
          <TabsTrigger value="weekly">Weekly report</TabsTrigger>
        </TabsList>

        <TabsContent value="observations" className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            <ChartCard
              title="Sleep vs target"
              description={`Target ${sleepTargetHours.toFixed(1)}h per night`}
              empty={sleepEmpty}
              emptyMessage="No nights logged in the last 7 days."
            >
              <SleepChart data={sleepSeries} targetHours={sleepTargetHours} />
            </ChartCard>

            <ChartCard
              title="Focus minutes"
              description="Minutes per day"
              empty={focusEmpty}
              emptyMessage="No focus sessions logged in the last 7 days."
            >
              <FocusChart data={focusSeries} />
            </ChartCard>

            <ChartCard
              title="Mood & concentration"
              description="Rated 1 to 5 on check-in days"
              empty={moodEmpty}
              emptyMessage="No check-ins logged in the last 7 days."
            >
              <MoodChart data={moodSeries} />
            </ChartCard>
          </div>

          {grouped.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title="Below minimum sample for observations"
              description="Patterns appear once several days of sleep, check-ins, focus, or movement are logged. Observations always describe associations in your logs, never causes."
              action={
                <Button asChild className="rounded-control bg-violet text-white hover:bg-violet/90">
                  <Link href="/habits">Log today&apos;s entries</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.pillar} aria-labelledby={`pillar-${group.pillar}`} className="space-y-3">
                  <h2
                    id={`pillar-${group.pillar}`}
                    className="font-mono text-caption uppercase tracking-[0.16em] text-cyan"
                  >
                    {group.label}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((insight) => (
                      <InsightCard key={insight.id} insight={insight} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-caption text-muted-foreground tabular-nums">
              {weeklyReport.weekStart} → {weeklyReport.weekEnd}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={weekOffset === 0 ? "default" : "outline"}
                onClick={() => onChangeWeekOffset(0)}
                className="rounded-control"
              >
                This week
              </Button>
              <Button
                type="button"
                size="sm"
                variant={weekOffset === 1 ? "default" : "outline"}
                onClick={() => onChangeWeekOffset(1)}
                className="rounded-control"
              >
                Last week
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sleep average"
              value={
                weeklyReport.sleep.avgMin !== null
                  ? (weeklyReport.sleep.avgMin / 60).toFixed(1)
                  : "—"
              }
              unit={weeklyReport.sleep.avgMin !== null ? "hrs" : undefined}
              hint={`${weeklyReport.sleep.nightsLogged} nights logged · ${weeklyReport.sleep.nightsBelowTarget} under target`}
              accent="cyan"
            />
            <StatCard
              label="Focus total"
              value={weeklyReport.focus.totalMin}
              unit="min"
              hint={`${weeklyReport.focus.sessions} sessions${
                weeklyReport.focus.avgFocusRating !== null
                  ? ` · avg ${weeklyReport.focus.avgFocusRating}/5`
                  : ""
              }`}
              accent="violet"
            />
            <StatCard
              label="Movement"
              value={weeklyReport.movement.daysActive}
              unit={weeklyReport.movement.daysActive === 1 ? "day" : "days"}
              hint={`${weeklyReport.movement.totalMin} total minutes`}
            />
            <StatCard
              label="Check-ins"
              value={weeklyReport.wellbeing.checkins}
              hint={
                weeklyReport.wellbeing.avgConcentration !== null
                  ? `Avg mood ${weeklyReport.wellbeing.avgMood ?? "—"} · focus ${weeklyReport.wellbeing.avgConcentration}`
                  : "No check-ins this week"
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
              <h2 className="text-section font-medium text-foreground">Week highlights</h2>
              <ul className="mt-3 space-y-2 text-body text-muted-foreground">
                {weeklyReport.highlights.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-cyan">
                      ·
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
              <h2 className="text-section font-medium text-foreground">Reflection prompts</h2>
              <ul className="mt-3 space-y-2 text-body text-muted-foreground">
                {weeklyReport.reflectionPrompts.map((prompt, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-violet">
                      ?
                    </span>
                    <span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <Skeleton className="h-10 w-64 rounded-control" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-[244px] rounded-card" />
        <Skeleton className="h-[244px] rounded-card" />
        <Skeleton className="h-[244px] rounded-card" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-48 rounded-card" />
      </div>
    </div>
  );
}
