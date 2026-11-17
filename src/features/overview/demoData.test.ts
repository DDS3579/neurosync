import { format, parseISO } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";

import { compareActivities } from "@/features/brain/brainCompare";
import { deriveWeeklyBrainActivity } from "@/features/brain/brainActivity";
import { scheduleNextReview } from "@/features/focus/reviewScheduler";
import { WEEKLY_EXPORT_FOOTER } from "@/features/insights/weeklyExport";
import { buildOverviewViewData, clearDemoDataFromDb, loadDemoDataToDb } from "@/features/overview/demoData";
import { generateDayPlan } from "@/features/planner/plannerEngine";
import { buildRemindersIcs } from "@/features/reminders/reminderUtils";
import { getDb } from "@/lib/db/dexie";
import {
  activityRepository,
  checkinRepository,
  focusRepository,
  gratitudeRepository,
  habitLogRepository,
  habitRepository,
  insightFeedbackRepository,
  journalRepository,
  mindfulnessRepository,
  movementRepository,
  nutritionRepository,
  reviewRepository,
  settingsRepository,
  sleepRepository,
} from "@/lib/db/repositories";
import { buildWeeklyReport, computeInsights } from "@/lib/insights";

const TODAY_ISO = "2026-11-17";
const TODAY_DATE = parseISO(TODAY_ISO);

describe("v0.2 end-to-end demo pipeline", () => {
  beforeEach(async () => {
    const db = getDb();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("populates v0.1 + v0.2 demo data, drives all features cleanly, and clears without leftovers", async () => {
    await loadDemoDataToDb(TODAY_DATE);

    const [
      settingsList,
      sleep,
      checkins,
      focus,
      movement,
      nutrition,
      habits,
      habitLogs,
      mindfulness,
      journal,
      gratitude,
      activities,
      reviews,
    ] = await Promise.all([
      settingsRepository.listAll(),
      sleepRepository.listAll(),
      checkinRepository.listAll(),
      focusRepository.listAll(),
      movementRepository.listAll(),
      nutritionRepository.listAll(),
      habitRepository.listAll(),
      habitLogRepository.listAll(),
      mindfulnessRepository.listAll(),
      journalRepository.listAll(),
      gratitudeRepository.listAll(),
      activityRepository.listAll(),
      reviewRepository.listAll(),
    ]);

    const settings = settingsList[0]!;
    expect(settings).toBeDefined();
    expect(sleep.length).toBeGreaterThan(0);
    expect(mindfulness.length).toBeGreaterThanOrEqual(4);
    expect(journal.length).toBeGreaterThanOrEqual(2);
    expect(gratitude.length).toBeGreaterThanOrEqual(1);
    expect(activities.length).toBeGreaterThanOrEqual(4);
    expect(reviews.length).toBeGreaterThanOrEqual(2);

    // 1. Overview & Brain activity preview
    const overview = buildOverviewViewData({
      settings,
      sleep,
      checkins,
      focus,
      movement,
      nutrition,
      habits,
      habitLogs,
      mindfulness,
      activities,
      today: TODAY_DATE,
    });
    expect(overview.isEmpty).toBe(false);
    expect(overview.hasDemoData).toBe(true);
    expect(overview.insights.length).toBeGreaterThan(0);
    expect(overview.insights.length).toBeLessThanOrEqual(3);

    // 2. Spaced-repetition review queue (due today + easy/okay/hard step transitions)
    const dueToday = reviews.filter((r) => r.nextReviewDate <= format(TODAY_DATE, "yyyy-MM-dd"));
    expect(dueToday.length).toBeGreaterThanOrEqual(1);
    const ratedEasy = scheduleNextReview(dueToday[0]!, "easy", TODAY_ISO);
    expect(ratedEasy.intervalStep).toBeGreaterThan(dueToday[0]!.intervalStep);

    // 3. Weekly report + export disclaimer
    const report = buildWeeklyReport(
      {
        settings,
        sleep,
        checkins,
        focus,
        movement,
        nutrition,
        habits,
        habitLogs,
        mindfulness,
        journal,
        gratitude,
        activities,
      },
      "2026-11-11",
    );
    expect(report.mind.mindfulnessSessions).toBeGreaterThan(0);
    expect(report.activities.totalLogs).toBeGreaterThan(0);
    expect(report.focus.methodBreakdown.length).toBeGreaterThan(0);
    expect(WEEKLY_EXPORT_FOOTER).toBe("Self-reported data from NeuroSync. Not a medical assessment.");

    // 4. Reminders .ics export
    const ics = buildRemindersIcs(
      {
        windDown: { enabled: true, time: "22:00" },
        checkin: { enabled: true, time: "20:00" },
        reviewDue: { enabled: false, time: "18:00" },
        quietHours: { enabled: true, start: "23:00", end: "07:00" },
      },
      TODAY_DATE,
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:NeuroSync: Wind-down reminder");
    expect(ics).toContain("SUMMARY:NeuroSync: Daily check-in");
    expect(ics).not.toContain("NeuroSync: Review queue check");

    // 5. Rule-based Schedule Planner protecting sleep & wind-down
    const plan = generateDayPlan({
      date: TODAY_ISO,
      wakeTime: "07:00",
      sleepTargetMin: 480,
      windDownMin: 45,
      maxStudyBlockMin: 50,
      breakMin: 10,
      bufferMin: 10,
      movementGoalMin: 30,
      preferRecoverySpacing: true,
      commitments: [{ id: "c1", title: "Seminar", startTime: "10:00", endTime: "11:00" }],
      studyGoals: [{ id: "g1", subject: "Neuroscience", minutes: 60, difficulty: 4 }],
      focusHistory: focus,
    });
    expect(plan.blocks.some((b) => b.kind === "study")).toBe(true);
    expect(plan.blocks.some((b) => b.kind === "wind_down")).toBe(true);
    expect(plan.blocks.some((b) => b.kind === "sleep")).toBe(true);

    // 6. Brain Explorer weekly activity + compare
    const weeklyBrain = deriveWeeklyBrainActivity({
      focus,
      movement,
      sleep,
      habits,
      habitLogs,
      mindfulness,
      activities,
      today: TODAY_DATE,
    });
    expect(Object.keys(weeklyBrain.activity).length).toBeGreaterThan(0);
    const cmp = compareActivities("reading", "music");
    expect(cmp.sharedRegions.length + cmp.onlyARegions.length + cmp.onlyBRegions.length).toBeGreaterThan(0);

    // 7. Insight dismiss, snooze (14 days), and restore
    const baselineInsights = computeInsights(
      {
        settings,
        sleep,
        checkins,
        focus,
        movement,
        nutrition,
        habits,
        habitLogs,
        mindfulness,
        activities,
      },
      TODAY_ISO,
    );
    expect(baselineInsights.length).toBeGreaterThan(0);
    const first = baselineInsights[0]!;
    await insightFeedbackRepository.dismiss(first);
    const feedbackAfterDismiss = await insightFeedbackRepository.listAll();
    const afterDismiss = computeInsights(
      { settings, sleep, checkins, focus, movement, nutrition, habits, habitLogs, mindfulness, activities },
      TODAY_ISO,
      { feedback: feedbackAfterDismiss },
    );
    expect(afterDismiss.some((i) => i.id === first.id)).toBe(false);

    await insightFeedbackRepository.snooze(first, TODAY_ISO);
    const feedbackAfterSnooze = await insightFeedbackRepository.listAll();
    expect(feedbackAfterSnooze[0]?.status).toBe("snoozed");

    await insightFeedbackRepository.restore(first.id);
    expect((await insightFeedbackRepository.listAll()).length).toBe(0);

    // 8. Clear demo data removes v0.1 + v0.2 demo rows cleanly
    await clearDemoDataFromDb();
    expect((await sleepRepository.listAll()).length).toBe(0);
    expect((await mindfulnessRepository.listAll()).length).toBe(0);
    expect((await journalRepository.listAll()).length).toBe(0);
    expect((await gratitudeRepository.listAll()).length).toBe(0);
    expect((await activityRepository.listAll()).length).toBe(0);
    expect((await reviewRepository.listAll()).length).toBe(0);
  });
});
