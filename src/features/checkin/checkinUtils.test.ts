import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/dexie";
import { upsertCheckin } from "./checkinUtils";

describe("upsertCheckin (one check-in per day)", () => {
  beforeEach(async () => {
    await getDb().checkins.clear();
  });

  it("creates a check-in on a fresh date and updates instead of duplicating on the same date", async () => {
    const first = await upsertCheckin({
      date: "2026-11-16",
      mood: 3,
      stress: 3,
      energy: 3,
      concentration: 3,
      motivation: 3,
      outdoorMin: 15,
      note: "Morning baseline",
    });

    expect(first.mode).toBe("created");
    expect(await getDb().checkins.count()).toBe(1);

    const second = await upsertCheckin({
      date: "2026-11-16",
      mood: 4,
      stress: 2,
      energy: 4,
      concentration: 5,
      motivation: 4,
      outdoorMin: 30,
      note: "Updated after walk",
    });

    expect(second.mode).toBe("updated");
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.mood).toBe(4);
    expect(second.record.concentration).toBe(5);
    expect(second.record.note).toBe("Updated after walk");
    expect(await getDb().checkins.count()).toBe(1);
  });

  it("creates separate rows for distinct dates", async () => {
    await upsertCheckin({
      date: "2026-11-15",
      mood: 3,
      stress: 2,
      energy: 4,
      concentration: 3,
      motivation: 4,
    });

    await upsertCheckin({
      date: "2026-11-16",
      mood: 4,
      stress: 2,
      energy: 4,
      concentration: 4,
      motivation: 4,
    });

    expect(await getDb().checkins.count()).toBe(2);
  });
});
