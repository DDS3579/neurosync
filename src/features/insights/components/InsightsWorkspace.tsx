"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, EyeOff, RotateCcw, Sparkles } from "lucide-react";

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
import type { SuppressedInsightEntry, WeeklyReport } from "@/lib/insights";
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
  dismissedInsights?: SuppressedInsightEntry[];
  snoozedInsights?: SuppressedInsightEntry[];
  weeklyReport: WeeklyReport;
  sleepWeek: { date: string; hours: number | null }[];
  sleepTargetHours: number;
  focusWeek: { date: string; minutes: number }[];
  moodWeek: { date: string; mood: number | null; concentration: number | null }[];
  weekOffset: 0 | 1;
  onChangeWeekOffset: (next: 0 | 1) => void;
  onDismissInsight?: (insight: Insight) => void;
  onSnoozeInsight?: (insight: Insight) => void;
  onRestoreInsight?: (insightId: string) => void;
}

export function InsightsWorkspace({
  insights,
  dismissedInsights = [],
  snoozedInsights = [],
  weeklyReport,
  sleepWeek,
  sleepTargetHours,
  focusWeek,
  moodWeek,
  weekOffset,
  onChangeWeekOffset,
  onDismissInsight,
  onSnoozeInsight,
  onRestoreInsight,
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

  const sleepLoggedHours = sleepSeries.flatMap((p) => (p.hours === null ? [] : [p.hours]));
  const sleepSummary = sleepEmpty
    ? "No nights logged in the last 7 days."
    : `Average ${(sleepLoggedHours.reduce((a, b) => a + b, 0) / sleepLoggedHours.length).toFixed(1)}h across ${sleepLoggedHours.length} logged night(s).`;
  const focusTotalMin = focusSeries.reduce((sum, p) => sum + p.minutes, 0);
  const focusSummary = focusEmpty
    ? "No focus minutes logged in the last 7 days."
    : `${focusTotalMin} minutes focused over the last 7 days.`;
  const moodRatings = moodSeries.flatMap((p) => (p.mood === null ? [] : [p.mood]));
  const concRatings = moodSeries.flatMap((p) =>
    p.concentration === null ? [] : [p.concentration],
  );
  const moodSummary = moodEmpty
    ? "No check-ins logged in the last 7 days."
    : `Mean mood ${moodRatings.length ? (moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length).toFixed(1) : "—"}/5 · concentration ${concRatings.length ? (concRatings.reduce((a, b) => a + b, 0) / concRatings.length).toFixed(1) : "—"}/5.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Deterministic observations from your own logs, each paired with its evidence and a clear caveat."
        actions={
          <Button asChild variant="outline" className="gap-1.5 rounded-control">
            <Link href="/insights/weekly">
              Your week report
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="observations" className="space-y-6">
        <TabsList className="h-auto w-fit flex-wrap rounded-control border border-border bg-surface p-1">
          <TabsTrigger value="observations">Observations & Charts</TabsTrigger>
          <TabsTrigger value="weekly">Weekly report</TabsTrigger>
          <TabsTrigger value="dismissed">
            Dismissed ({dismissedInsights.length + snoozedInsights.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="observations" className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            <ChartCard
              title="Sleep vs target"
              description={`Target ${sleepTargetHours.toFixed(1)}h per night`}
              summary={sleepSummary}
              tableData={{
                caption: "Sleep hours compared with target across the last 7 days",
                columns: ["Day", "Sleep (hours)"],
                rows: sleepSeries.map((row) => [
                  row.day,
                  row.hours === null ? "—" : row.hours.toFixed(1),
                ]),
              }}
              empty={sleepEmpty}
              emptyMessage="No nights logged in the last 7 days."
            >
              <SleepChart data={sleepSeries} targetHours={sleepTargetHours} />
            </ChartCard>

            <ChartCard
              title="Focus minutes"
              description="Minutes per day"
              summary={focusSummary}
              tableData={{
                caption: "Daily focus minutes across the last 7 days",
                columns: ["Day", "Minutes"],
                rows: focusSeries.map((row) => [row.day, row.minutes]),
              }}
              empty={focusEmpty}
              emptyMessage="No focus sessions logged in the last 7 days."
            >
              <FocusChart data={focusSeries} />
            </ChartCard>

            <ChartCard
              title="Mood & concentration"
              description="Rated 1 to 5 on check-in days"
              summary={moodSummary}
              tableData={{
                caption: "Mood and concentration ratings across the last 7 days",
                columns: ["Day", "Mood", "Concentration"],
                rows: moodSeries.map((row) => [
                  row.day,
                  row.mood === null ? "—" : `${row.mood}/5`,
                  row.concentration === null ? "—" : `${row.concentration}/5`,
                ]),
              }}
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
                      <InsightCard
                        key={insight.id}
                        insight={insight}
                        onDismiss={onDismissInsight}
                        onSnooze={onSnoozeInsight}
                      />
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
            <div className="flex flex-wrap items-center gap-2">
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
              <Button asChild variant="outline" size="sm" className="gap-1 rounded-control">
                <Link href="/insights/weekly">
                  Full report &amp; export
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
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
                    <span aria-hidden className="text-violet-text">
                      ?
                    </span>
                    <span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dismissed" className="space-y-6">
          {dismissedInsights.length === 0 && snoozedInsights.length === 0 ? (
            <EmptyState
              icon={<EyeOff />}
              title="No dismissed or snoozed insights"
              description="Insights you mark as not useful or snooze for 14 days appear here so you can restore them anytime."
            />
          ) : (
            <div className="space-y-6">
              {dismissedInsights.length > 0 ? (
                <section aria-labelledby="dismissed-heading" className="space-y-3">
                  <h2
                    id="dismissed-heading"
                    className="font-mono text-caption uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Dismissed insights
                  </h2>
                  <div className="space-y-3">
                    {dismissedInsights.map((entry) => (
                      <Card
                        key={entry.insightId}
                        className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-none sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.pillar ? (
                              <span className="rounded-chip border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-cyan">
                                {PILLAR_LABELS[entry.pillar]}
                              </span>
                            ) : null}
                            <span className="font-mono text-caption text-muted-foreground">
                              {entry.insightId}
                            </span>
                          </div>
                          <p className="text-section font-medium text-foreground">{entry.title}</p>
                          {entry.liveInsight ? (
                            <p className="text-caption text-muted-foreground">
                              {entry.liveInsight.body}
                            </p>
                          ) : null}
                        </div>
                        {onRestoreInsight ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onRestoreInsight(entry.insightId)}
                            className="shrink-0 gap-1.5 rounded-control"
                          >
                            <RotateCcw className="size-3.5" aria-hidden />
                            Restore
                          </Button>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                </section>
              ) : null}

              {snoozedInsights.length > 0 ? (
                <section aria-labelledby="snoozed-heading" className="space-y-3">
                  <h2
                    id="snoozed-heading"
                    className="font-mono text-caption uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Snoozed insights (14 days)
                  </h2>
                  <div className="space-y-3">
                    {snoozedInsights.map((entry) => (
                      <Card
                        key={entry.insightId}
                        className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-none sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.pillar ? (
                              <span className="rounded-chip border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-cyan">
                                {PILLAR_LABELS[entry.pillar]}
                              </span>
                            ) : null}
                            {entry.feedback.snoozeUntil ? (
                              <span className="inline-flex items-center gap-1 font-mono text-caption text-muted-foreground">
                                <Clock className="size-3" aria-hidden />
                                Hidden until {entry.feedback.snoozeUntil}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-section font-medium text-foreground">{entry.title}</p>
                        </div>
                        {onRestoreInsight ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onRestoreInsight(entry.insightId)}
                            className="shrink-0 gap-1.5 rounded-control"
                          >
                            <RotateCcw className="size-3.5" aria-hidden />
                            Restore now
                          </Button>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
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
