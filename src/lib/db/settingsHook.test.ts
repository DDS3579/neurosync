import { Dexie } from "dexie";
import { beforeEach, describe, expect, it } from "vitest";

import { SETTINGS_ID, getDb } from "@/lib/db/dexie";
import { settingsRepository } from "@/lib/db/repositories";

describe("settings liveQuery + ensure separation", () => {
  beforeEach(async () => {
    await getDb().settings.clear();
  });

  it("emits ensured settings via read-only liveQuery without ReadOnlyError", async () => {
    const emissions: Array<string | undefined> = [];

    const observable = Dexie.liveQuery(() => settingsRepository.getById(SETTINGS_ID));
    const sub = observable.subscribe({
      next: (row) => {
        emissions.push(row?.id);
      },
    });

    await settingsRepository.ensure();
    await new Promise((resolve) => setTimeout(resolve, 30));

    sub.unsubscribe();

    expect(emissions).toContain(SETTINGS_ID);
  });
});
