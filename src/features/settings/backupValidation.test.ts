import { beforeEach, describe, expect, it } from "vitest";

import { BackupError, buildBackup, importAll } from "@/lib/db/backup";
import { getDb } from "@/lib/db/dexie";
import {
  activityRepository,
  checkinRepository,
  focusRepository,
  gratitudeRepository,
  journalRepository,
  mindfulnessRepository,
  reviewRepository,
  sleepRepository,
} from "@/lib/db/repositories";

describe("backup import validation", () => {
  beforeEach(async () => {
    const db = getDb();
    await Promise.all(db.tables.map((t) => t.clear()));

    await sleepRepository.create({
      date: "2026-11-15",
      bedtime: "2026-11-14T23:15:00",
      wakeTime: "2026-11-15T07:15:00",
      durationMin: 480,
      quality: 4,
      rested: 4,
      interruptions: 0,
    });
    await checkinRepository.create({
      date: "2026-11-15",
      mood: 4,
      stress: 2,
      energy: 4,
      concentration: 4,
      motivation: 4,
    });
    await focusRepository.create({
      date: "2026-11-15",
      startedAt: "2026-11-15T09:00:00",
      durationMin: 30,
      plannedMin: 30,
      subject: "Biology",
      method: "active_recall",
      focusRating: 4,
      difficulty: 3,
      distractions: 1,
    });
    await mindfulnessRepository.create({
      date: "2026-11-15",
      type: "4_7_8_breathing",
      durationMin: 2,
    });
    await journalRepository.create({
      date: "2026-11-15",
      text: "Noticed calm focus after lunch.",
    });
    await gratitudeRepository.create({
      date: "2026-11-15",
      items: ["Afternoon sun", "Good conversation"],
    });
    await activityRepository.create({
      date: "2026-11-15",
      type: "novelty",
      durationMin: 35,
      enjoyment: 5,
      note: "Tried a new walking trail",
    });
    await reviewRepository.create({
      topic: "Synaptic pruning overview",
      intervalStep: 0,
      nextReviewDate: "2026-11-16",
      reviewCount: 0,
    });
  });

  it("rejects malformed JSON and leaves all tables untouched even in replace mode", async () => {
    await expect(importAll("{not valid json", "replace")).rejects.toBeInstanceOf(BackupError);
    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().checkins.count()).toBe(1);
    expect(await getDb().focusSessions.count()).toBe(1);
  });

  it("rejects schema validation failures inside rows without wiping existing data", async () => {
    const snapshot = await buildBackup();
    const invalid = structuredClone(snapshot);
    // Inject invalid rating (>5) and bad date into checkins
    invalid.tables.checkins.push({
      ...invalid.tables.checkins[0]!,
      id: "bad-checkin",
      date: "invalid-date",
      mood: 9 as 5,
    });

    await expect(importAll(JSON.stringify(invalid), "replace")).rejects.toBeInstanceOf(BackupError);

    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().checkins.count()).toBe(1);
    expect(await getDb().focusSessions.count()).toBe(1);
  });

  it("wipes all tables cleanly when replace-importing an empty backup (delete-all path)", async () => {
    await importAll(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        tables: {
          settings: [],
          sleepLogs: [],
          checkins: [],
          focusSessions: [],
          movementLogs: [],
          nutritionLogs: [],
          habits: [],
          habitLogs: [],
          experiments: [],
        },
      }),
      "replace",
    );

    expect(await getDb().sleepLogs.count()).toBe(0);
    expect(await getDb().checkins.count()).toBe(0);
    expect(await getDb().focusSessions.count()).toBe(0);
    expect(await getDb().mindfulnessSessions.count()).toBe(0);
    expect(await getDb().journalEntries.count()).toBe(0);
    expect(await getDb().gratitudeEntries.count()).toBe(0);
    expect(await getDb().activityLogs.count()).toBe(0);
    expect(await getDb().reviewItems.count()).toBe(0);
  });

  it("rejects invalid mindfulness, journal, gratitude, activity, or review rows without wiping existing data", async () => {
    const snapshot = await buildBackup();

    const badGratitude = structuredClone(snapshot);
    badGratitude.tables.gratitudeEntries.push({
      ...badGratitude.tables.gratitudeEntries[0]!,
      id: "too-many-lines",
      items: ["one", "two", "three", "four"],
    });
    await expect(importAll(JSON.stringify(badGratitude), "replace")).rejects.toBeInstanceOf(
      BackupError,
    );

    const badJournal = structuredClone(snapshot);
    badJournal.tables.journalEntries.push({
      ...badJournal.tables.journalEntries[0]!,
      id: "empty-journal",
      text: "   ",
    });
    await expect(importAll(JSON.stringify(badJournal), "replace")).rejects.toBeInstanceOf(
      BackupError,
    );

    const badMindfulness = structuredClone(snapshot);
    badMindfulness.tables.mindfulnessSessions.push({
      ...badMindfulness.tables.mindfulnessSessions[0]!,
      id: "bad-duration",
      durationMin: 0,
    });
    await expect(importAll(JSON.stringify(badMindfulness), "replace")).rejects.toBeInstanceOf(
      BackupError,
    );

    const badActivity = structuredClone(snapshot);
    badActivity.tables.activityLogs.push({
      ...badActivity.tables.activityLogs[0]!,
      id: "bad-enjoyment",
      enjoyment: 7 as 5,
    });
    await expect(importAll(JSON.stringify(badActivity), "replace")).rejects.toBeInstanceOf(
      BackupError,
    );

    const badReview = structuredClone(snapshot);
    badReview.tables.reviewItems.push({
      ...badReview.tables.reviewItems[0]!,
      id: "bad-step",
      intervalStep: 99,
    });
    await expect(importAll(JSON.stringify(badReview), "replace")).rejects.toBeInstanceOf(
      BackupError,
    );

    expect(await getDb().mindfulnessSessions.count()).toBe(1);
    expect(await getDb().journalEntries.count()).toBe(1);
    expect(await getDb().gratitudeEntries.count()).toBe(1);
    expect(await getDb().activityLogs.count()).toBe(1);
    expect(await getDb().reviewItems.count()).toBe(1);
  });
});
