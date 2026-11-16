import { beforeEach, describe, expect, it } from "vitest";

import { BackupError, buildBackup, importAll } from "@/lib/db/backup";
import { getDb } from "@/lib/db/dexie";
import { checkinRepository, focusRepository, sleepRepository } from "@/lib/db/repositories";

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
  });
});
