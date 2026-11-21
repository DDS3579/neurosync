"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { ChartCard, EmptyState, PageHeader, RegionBadge } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PERSONAL_ACTIVITY_LABELS } from "@/features/activities/activityUtils";
import { ACTIVITY_DISCLAIMER } from "@/features/brain/BrainExplorer";
import { LEARNING_METHOD_OPTIONS } from "@/features/focus/timerUtils";
import {
  WEEKLY_EXPORT_FOOTER,
  canSharePngFile,
  downloadWeeklyReportPng,
  formatDeltaBadge,
  formatMinutesLabel,
  shareWeeklyReportPng,
} from "@/features/insights/weeklyExport";
import {
  FocusChart,
  MoodChart,
  SleepChart,
  type FocusChartPoint,
  type MoodChartPoint,
  type SleepChartPoint,
} from "@/features/overview/overview-charts";
import type { WeeklyReport } from "@/lib/insights";
import type { LearningMethod } from "@/types/domain";

import {
  DailyMinutesBarChart,
  MethodBreakdownChart,
  type DailyMinutesPoint,
  type MethodBreakdownPoint,
} from "./WeeklyCharts";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const METHOD_LABEL: Record<LearningMethod, string> = Object.fromEntries(
  LEARNING_METHOD_OPTIONS.map((m) => [m.value, m.label]),
) as Record<LearningMethod, string>;

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : (WEEKDAY_SHORT[parsed.getDay()] ?? date);
}

function NeutralDelta({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span className="inline-flex items-center rounded-chip border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
      {text}
    </span>
  );
}

const emptySubscribe = () => () => {};

export interface WeeklyReportWorkspaceProps {
  report: WeeklyReport;
  sleepTargetHours: number;
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
}

export function WeeklyReportWorkspace({
  report,
  sleepTargetHours,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
}: WeeklyReportWorkspaceProps) {
  const [exporting, setExporting] = useState(false);

  const shareSupported = useSyncExternalStore(
    emptySubscribe,
    () => canSharePngFile(),
    () => false,
  );

  const sleepSeries = useMemo<SleepChartPoint[]>(
    () => report.daily.map((d) => ({ day: dayLabel(d.date), hours: d.sleepHours })),
    [report.daily],
  );
  const focusSeries = useMemo<FocusChartPoint[]>(
    () => report.daily.map((d) => ({ day: dayLabel(d.date), minutes: d.focusMin })),
    [report.daily],
  );
  const movementSeries = useMemo<DailyMinutesPoint[]>(
    () => report.daily.map((d) => ({ day: dayLabel(d.date), minutes: d.movementMin })),
    [report.daily],
  );
  const moodSeries = useMemo<MoodChartPoint[]>(
    () =>
      report.daily.map((d) => ({
        day: dayLabel(d.date),
        mood: d.mood,
        concentration: d.concentration,
      })),
    [report.daily],
  );
  const mindActivitySeries = useMemo<DailyMinutesPoint[]>(
    () => report.daily.map((d) => ({ day: dayLabel(d.date), minutes: d.mindAndActivityMin })),
    [report.daily],
  );
  const methodSeries = useMemo<MethodBreakdownPoint[]>(
    () =>
      report.focus.methodBreakdown.map((m) => ({
        method: METHOD_LABEL[m.method],
        minutes: m.totalMin,
      })),
    [report.focus.methodBreakdown],
  );

  const hasAnyData =
    report.sleep.nightsLogged > 0 ||
    report.focus.sessions > 0 ||
    report.movement.daysActive > 0 ||
    report.wellbeing.checkins > 0 ||
    report.nutrition.daysLogged > 0 ||
    report.mind.mindfulnessSessions > 0 ||
    report.mind.journalEntries > 0 ||
    report.mind.gratitudeDays > 0 ||
    report.activities.totalLogs > 0;

  const handleDownloadPng = async () => {
    setExporting(true);
    try {
      await downloadWeeklyReportPng(report, sleepTargetHours);
      toast.success("Downloaded weekly report image (PNG).");
    } catch {
      toast.error("Could not generate the PNG image in this browser.");
    } finally {
      setExporting(false);
    }
  };

  const handleSharePng = async () => {
    setExporting(true);
    try {
      const outcome = await shareWeeklyReportPng(report, sleepTargetHours);
      if (outcome === "unsupported") {
        await downloadWeeklyReportPng(report, sleepTargetHours);
        toast.info("Web Share is unavailable here; downloaded PNG instead.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Could not share the report image.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 nx-weekly-print-root">
      <div className="nx-print-hide space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to Insights
          </Link>
        </div>

        <PageHeader
          title="Your week"
          description={`Self-reported weekly summary for ${report.weekStart} → ${report.weekEnd}.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={() => void handleDownloadPng()}
                className="gap-1.5 rounded-control"
              >
                <Download className="size-3.5" aria-hidden />
                Download as image
              </Button>
              {shareSupported ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exporting}
                  onClick={() => void handleSharePng()}
                  className="gap-1.5 rounded-control"
                >
                  <Share2 className="size-3.5" aria-hidden />
                  Share
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 rounded-control"
              >
                <Printer className="size-3.5" aria-hidden />
                Print / save as PDF
              </Button>
            </div>
          }
        />

        {/* Week picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrevWeek}
              className="gap-1 rounded-control"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={weekOffset === 0}
              onClick={onNextWeek}
              className="gap-1 rounded-control"
            >
              Next week
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            {weekOffset > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCurrentWeek}
                className="rounded-control text-cyan"
              >
                This week
              </Button>
            ) : null}
          </div>

          <span className="font-mono text-caption text-cyan tabular-nums">
            {weekOffset === 0
              ? `Current week · ${report.weekStart} → ${report.weekEnd}`
              : `${report.weekStart} → ${report.weekEnd}`}
          </span>
        </div>
      </div>

      {/* Print-only header */}
      <div className="nx-print-only hidden border-b border-border pb-3">
        <h1 className="text-xl font-semibold">
          NeuroSync — Your week ({report.weekStart} → {report.weekEnd})
        </h1>
        <p className="text-xs text-muted-foreground">{WEEKLY_EXPORT_FOOTER}</p>
      </div>

      {/* Highlights & reflection prompts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="nx-print-card rounded-card border border-border bg-surface p-5 shadow-none">
          <h2 className="text-section font-medium text-foreground">Highlights</h2>
          <ul className="mt-3 space-y-2 text-body text-muted-foreground">
            {report.highlights.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span aria-hidden className="text-cyan">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="nx-print-card rounded-card border border-border bg-surface p-5 shadow-none">
          <h2 className="text-section font-medium text-foreground">Reflection prompts</h2>
          <ul className="mt-3 space-y-2 text-body text-muted-foreground">
            {report.reflectionPrompts.map((prompt, idx) => (
              <li key={idx} className="flex gap-2">
                <span aria-hidden className="text-violet-text">
                  ?
                </span>
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Brain-activity summary strip */}
      <Card className="nx-print-card space-y-3 rounded-card border border-border bg-surface p-5 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-section font-medium text-foreground">
              Brain-activity summary strip
            </h2>
            <p className="text-caption text-muted-foreground">{ACTIVITY_DISCLAIMER}</p>
          </div>
          <Link
            href="/brain"
            className="nx-print-hide text-caption font-medium text-cyan underline-offset-4 hover:underline"
          >
            Open Brain Explorer →
          </Link>
        </div>

        {report.brainActivity.topRegions.length === 0 ? (
          <p className="rounded-control border border-dashed border-border px-4 py-3 text-caption text-muted-foreground">
            No focus, movement, mindfulness, activity, or sleep logs were recorded this week, so no
            region associations are shown.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {report.brainActivity.topRegions.map((entry) => (
              <div
                key={entry.region}
                className="space-y-2 rounded-control border border-border bg-surface-2 px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <RegionBadge region={entry.region} />
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(entry.intensity * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full bg-cyan"
                    style={{ width: `${Math.max(8, Math.round(entry.intensity * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!hasAnyData ? (
        <EmptyState
          title="No entries logged for this week"
          description={`Nothing was recorded between ${report.weekStart} and ${report.weekEnd}. Pick another week above or log today's sleep, focus, check-in, mind, or activity entries.`}
          action={
            <Button asChild className="nx-print-hide rounded-control bg-violet text-white hover:bg-violet/90">
              <Link href="/habits">Log today&apos;s entries</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 1. Sleep */}
          <ChartCard
            title="Sleep"
            description={`Target ${sleepTargetHours.toFixed(1)}h per night`}
            summary={
              report.sleep.nightsLogged > 0 && report.sleep.avgMin !== null
                ? `Average ${formatMinutesLabel(report.sleep.avgMin)} across ${report.sleep.nightsLogged} of 7 nights (${report.sleep.nightsBelowTarget} under target).`
                : undefined
            }
            tableData={{
              caption: "Weekly sleep duration by day",
              columns: ["Day", "Sleep (hours)"],
              rows: sleepSeries.map((row) => [
                row.day,
                row.hours === null ? "—" : row.hours.toFixed(1),
              ]),
            }}
            empty={report.sleep.nightsLogged === 0}
            emptyMessage="No sleep logged this week. Add wake-up logs in Daily Habits → Sleep to see averages and bedtime spread."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-caption tabular-nums">
                  {report.sleep.nightsLogged > 0 && report.sleep.avgMin !== null
                    ? `Avg ${formatMinutesLabel(report.sleep.avgMin)} · ${report.sleep.nightsLogged}/7 nights · ${report.sleep.nightsBelowTarget} under target${report.sleep.bedtimeSpreadMin !== null ? ` · spread ±${Math.round(report.sleep.bedtimeSpreadMin)}m` : " (need 2+ nights for spread)"}`
                    : "Waiting for sleep logs"}
                </span>
                <NeutralDelta
                  text={formatDeltaBadge(report.vsPreviousWeek.sleepAvgMin, "m", {
                    formatValue: formatMinutesLabel,
                  })}
                />
              </div>
            }
          >
            <SleepChart data={sleepSeries} targetHours={sleepTargetHours} />
          </ChartCard>

          {/* 2. Focus */}
          <ChartCard
            title="Focus"
            description="Minutes per day"
            summary={
              report.focus.sessions > 0
                ? `${formatMinutesLabel(report.focus.totalMin)} logged across ${report.focus.sessions} session(s).`
                : undefined
            }
            tableData={{
              caption: "Weekly focus minutes by day",
              columns: ["Day", "Minutes"],
              rows: focusSeries.map((row) => [row.day, row.minutes]),
            }}
            empty={report.focus.sessions === 0}
            emptyMessage="No focus sessions logged this week. Use Focus Lab to record session minutes and focus ratings."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-caption tabular-nums">
                  {report.focus.sessions > 0
                    ? `${formatMinutesLabel(report.focus.totalMin)} across ${report.focus.sessions} ${report.focus.sessions === 1 ? "session" : "sessions"} · avg focus ${report.focus.avgFocusRating ?? "—"}/5`
                    : "Waiting for focus sessions"}
                </span>
                <NeutralDelta
                  text={formatDeltaBadge(report.vsPreviousWeek.focusTotalMin, "m", {
                    formatValue: formatMinutesLabel,
                  })}
                />
              </div>
            }
          >
            <FocusChart data={focusSeries} />
          </ChartCard>

          {/* 2b. Planned vs actual (v0.4 planner blocks) */}
          <ChartCard
            title="Planned vs logged blocks"
            description="Average minutes by block length, with sample sizes"
            summary={report.planner.summaryLine}
            tableData={{
              caption: "Average planned and logged minutes by block length",
              columns: ["Group", "Blocks (n)", "Avg planned", "Avg logged", "Difference"],
              rows: report.planner.byLength.map((row) => [
                row.label,
                row.n,
                `${row.avgPlannedMin}m`,
                `${row.avgActualMin}m`,
                `${row.deltaMin > 0 ? "+" : row.deltaMin < 0 ? "−" : ""}${Math.abs(row.deltaMin)}m`,
              ]),
            }}
            empty={report.planner.measuredBlocks === 0}
            emptyMessage="No planner blocks were completed with a logged duration this week. Start a block from the planner to build this comparison."
            footer={report.planner.caveats[0]}
          >
            <div className="space-y-2">
              {report.planner.byLength.map((row) => {
                const max = Math.max(row.avgPlannedMin, row.avgActualMin, 1);
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-caption">
                      <span className="text-foreground">{row.label}</span>
                      <span className="font-mono text-muted-foreground tabular-nums">
                        n = {row.n} · {row.avgPlannedMin}m → {row.avgActualMin}m
                      </span>
                    </div>
                    <div aria-hidden className="space-y-0.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.round((row.avgPlannedMin / max) * 100)}%` }} />
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full bg-violet" style={{ width: `${Math.round((row.avgActualMin / max) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Cyan = average planned · violet = average logged.{" "}
                {report.planner.byKind.map((row) => `${row.label} n=${row.n}`).join(" · ")}
              </p>
            </div>
          </ChartCard>

          {/* 3. Learning methods */}
          <ChartCard
            title="Learning methods"
            description="Minutes per method logged in Focus Lab"
            summary={
              methodSeries.length > 0
                ? `${methodSeries.length} method(s) used this week (${report.focus.retrievalSessions} with retrieval practice).`
                : undefined
            }
            tableData={{
              caption: "Minutes by learning method",
              columns: ["Method", "Minutes"],
              rows: methodSeries.map((row) => [row.method, row.minutes]),
            }}
            empty={methodSeries.length === 0}
            emptyMessage="No learning methods logged this week. Complete a Focus Lab session to see how your study methods distribute."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-caption tabular-nums">
                  {report.focus.methodsUsed.length > 0
                    ? `${report.focus.methodsUsed.length} ${report.focus.methodsUsed.length === 1 ? "method" : "methods"} · ${report.focus.retrievalSessions} retrieval · ${report.focus.reviewedPriorSessions} prior review`
                    : "Waiting for method logs"}
                </span>
                <NeutralDelta
                  text={formatDeltaBadge(report.vsPreviousWeek.focusSessions, " sessions")}
                />
              </div>
            }
          >
            <MethodBreakdownChart data={methodSeries} />
          </ChartCard>

          {/* 4. Movement */}
          <ChartCard
            title="Movement"
            description="Daily movement minutes"
            summary={
              report.movement.daysActive > 0
                ? `${formatMinutesLabel(report.movement.totalMin)} across ${report.movement.daysActive} active day(s).`
                : undefined
            }
            tableData={{
              caption: "Daily movement minutes",
              columns: ["Day", "Minutes"],
              rows: movementSeries.map((row) => [row.day, row.minutes]),
            }}
            empty={report.movement.daysActive === 0}
            emptyMessage="No movement logged this week. Walks, runs, stretches, or workouts logged in Daily Habits → Movement appear here."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-caption tabular-nums">
                  {report.movement.daysActive > 0
                    ? `${report.movement.daysActive}/7 active days · ${formatMinutesLabel(report.movement.totalMin)} total`
                    : "Waiting for movement logs"}
                </span>
                <NeutralDelta
                  text={formatDeltaBadge(report.vsPreviousWeek.movementTotalMin, "m", {
                    formatValue: formatMinutesLabel,
                  })}
                />
              </div>
            }
          >
            <DailyMinutesBarChart data={movementSeries} tone="movement" />
          </ChartCard>

          {/* 5. Wellbeing & nutrition */}
          <ChartCard
            title="Wellbeing & nutrition"
            description="Check-in ratings (1–5) and daily nutrition notes"
            summary={
              report.wellbeing.checkins > 0
                ? `${report.wellbeing.checkins} check-in(s): mean mood ${report.wellbeing.avgMood ?? "—"}/5, energy ${report.wellbeing.avgEnergy ?? "—"}/5.`
                : undefined
            }
            tableData={
              report.wellbeing.checkins > 0
                ? {
                    caption: "Daily mood and concentration ratings",
                    columns: ["Day", "Mood", "Concentration"],
                    rows: moodSeries.map((row) => [
                      row.day,
                      row.mood === null ? "—" : `${row.mood}/5`,
                      row.concentration === null ? "—" : `${row.concentration}/5`,
                    ]),
                  }
                : undefined
            }
            empty={report.wellbeing.checkins === 0 && report.nutrition.daysLogged === 0}
            emptyMessage="No check-ins or nutrition logs recorded this week. Log in Daily Habits → Check-in or Nutrition."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-caption tabular-nums">
                  {report.wellbeing.checkins > 0
                    ? `${report.wellbeing.checkins} check-ins · mood ${report.wellbeing.avgMood ?? "—"} · energy ${report.wellbeing.avgEnergy ?? "—"} · stress ${report.wellbeing.avgStress ?? "—"}`
                    : "No check-ins logged"}
                  {report.nutrition.daysLogged > 0
                    ? ` · ${report.nutrition.daysLogged} nutrition days (${report.nutrition.regularMealDays} regular, avg ${report.nutrition.avgWater ?? "—"} water)`
                    : " · no nutrition logs"}
                </span>
                <NeutralDelta text={formatDeltaBadge(report.vsPreviousWeek.avgMood, "/5")} />
              </div>
            }
          >
            {report.wellbeing.checkins > 0 ? (
              <MoodChart data={moodSeries} />
            ) : (
              <p className="py-10 text-center text-caption text-muted-foreground">
                Nutrition logged on {report.nutrition.daysLogged} day(s); no check-in ratings to
                chart this week.
              </p>
            )}
          </ChartCard>

          {/* 6. Activities & mind (v0.2) */}
          <ChartCard
            title="Activities & mind"
            description="Mindfulness sessions, journal, gratitude, and non-study activities"
            summary={`${report.mind.mindfulnessSessions} mindfulness session(s) and ${report.activities.totalLogs} non-study activity log(s) this week.`}
            tableData={{
              caption: "Daily mindfulness and non-study activity minutes",
              columns: ["Day", "Minutes"],
              rows: mindActivitySeries.map((row) => [row.day, row.minutes]),
            }}
            empty={
              report.mind.mindfulnessSessions === 0 &&
              report.mind.journalEntries === 0 &&
              report.mind.gratitudeDays === 0 &&
              report.activities.totalLogs === 0
            }
            emptyMessage="No mindfulness, journal, gratitude, or non-study activities logged this week. Visit Daily Habits → Mind or Activities."
            footer={
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-caption tabular-nums">
                    {report.mind.mindfulnessSessions} mindfulness (
                    {formatMinutesLabel(report.mind.mindfulnessMin)}) · {report.activities.totalLogs}{" "}
                    activities ({formatMinutesLabel(report.activities.totalMin)}) ·{" "}
                    {report.mind.journalEntries} journal · {report.mind.gratitudeDays} gratitude
                  </span>
                  <NeutralDelta
                    text={formatDeltaBadge(report.vsPreviousWeek.activitiesMin, "m", {
                      formatValue: formatMinutesLabel,
                    })}
                  />
                </div>
                {report.activities.byType.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {report.activities.byType.map((item) => (
                      <Badge
                        key={item.type}
                        variant="outline"
                        className="rounded-chip border-border bg-surface-2 font-normal text-muted-foreground"
                      >
                        {PERSONAL_ACTIVITY_LABELS[item.type]} ({item.totalMin}m)
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          >
            <DailyMinutesBarChart data={mindActivitySeries} tone="mind" />
          </ChartCard>
        </div>
      )}

      <footer className="border-t border-border pt-4 text-center font-mono text-caption text-muted-foreground">
        {WEEKLY_EXPORT_FOOTER}
      </footer>
    </div>
  );
}

export function WeeklyReportSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-[6px]" />
        <Skeleton className="h-4 w-80 max-w-full rounded-[4px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-44 rounded-card" />
      </div>
      <Skeleton className="h-28 rounded-card" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}
