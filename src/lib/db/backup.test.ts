import { beforeEach, describe, expect, it } from "vitest";

import { BackupError, buildBackup, exportAll, importAll } from "@/lib/db/backup";
import { getDb } from "@/lib/db/dexie";
import {
  checkinRepository,
  focusRepository,
  habitLogRepository,
  habitRepository,
  settingsRepository,
  sleepRepository,
} from "@/lib/db/repositories";

const DATE = "2026-03-02";

async function clearDatabase(): Promise<void> {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

async function seed(): Promise<void> {
  await settingsRepository.ensure();

  await sleepRepository.create({
    date: DATE,
    bedtime: `${DATE}T23:10:00.000Z`,
    wakeTime: `${DATE}T07:00:00.000Z`,
    durationMin: 470,
    quality: 4,
    rested: 3,
    interruptions: 1,
  });

  await checkinRepository.create({
    date: DATE,
    mood: 4,
    stress: 2,
    energy: 3,
    concentration: 3,
    motivation: 4,
    outdoorMin: 25,
  });

  await focusRepository.create({
    date: DATE,
    startedAt: `${DATE}T09:00:00.000Z`,
    durationMin: 25,
    plannedMin: 25,
    subject: "Neuroanatomy",
    method: "active_recall",
    focusRating: 4,
    difficulty: 3,
    distractions: 0,
  });

  const habit = await habitRepository.create({ name: "Evening walk", archived: false });

  await habitLogRepository.create({ date: DATE, habitId: habit.id, done: true });
}

describe("backup round-trip", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("exports every table, wipes the database, and restores identical records", async () => {
    await seed();

    const before = await buildBackup();
    const blob = await exportAll();
    const text = await blob.text();

    expect(text).toContain("schemaVersion");

    await clearDatabase();
    expect(await getDb().sleepLogs.count()).toBe(0);

    const summary = await importAll(text, "replace");
    const after = await buildBackup();

    expect(after.tables).toEqual(before.tables);
    expect(summary.schemaVersion).toBe(before.schemaVersion);
    expect(summary.mode).toBe("replace");
    expect(summary.imported.sleepLogs).toBe(1);
    expect(summary.imported.habitLogs).toBe(1);
  });

  it("merges without deleting existing records", async () => {
    await seed();
    const text = JSON.stringify(await buildBackup());

    const summary = await importAll(text, "merge");

    expect(summary.mode).toBe("merge");
    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().habits.count()).toBe(1);
  });

  it("rejects an unknown schema version and leaves the database untouched", async () => {
    await seed();
    const good = await buildBackup();
    const incompatible = JSON.stringify({ ...good, schemaVersion: good.schemaVersion + 1 });

    await expect(importAll(incompatible, "replace")).rejects.toBeInstanceOf(BackupError);
    expect(await getDb().sleepLogs.count()).toBe(1);
  });

  it("never partially imports an invalid file", async () => {
    await seed();
    const good = await buildBackup();
    const broken = JSON.parse(JSON.stringify(good)) as { tables: { sleepLogs: unknown[] } };
    broken.tables.sleepLogs.push({ id: "missing-required-fields" });

    await expect(importAll(JSON.stringify(broken), "replace")).rejects.toBeInstanceOf(BackupError);

    expect(await getDb().sleepLogs.count()).toBe(1);
    expect(await getDb().habits.count()).toBe(1);
  });
});
