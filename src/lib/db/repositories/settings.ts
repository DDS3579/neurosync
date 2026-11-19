import { DEFAULT_REMINDER_SETTINGS } from "@/features/reminders/reminderUtils";
import { isIndexedDbAvailable, SCHEMA_VERSION, SETTINGS_ID, getDb } from "@/lib/db/dexie";
import type { UserSettings } from "@/types/domain";

import { createRepository, type UpdateInput } from "./base";

export const DEFAULT_SLEEP_TARGET_MIN = 480;
export const DEFAULT_FOCUS_MIN = 25;
export const DEFAULT_BREAK_MIN = 5;
export const DEFAULT_BLOCK_MIN = 50;
export const DEFAULT_DEEP_WORK_CAP_MIN = 240;
export const DEFAULT_SNAP_MIN = 15;

export type SettingsInput = Omit<UserSettings, "id" | "createdAt" | "updatedAt">;

export const DEFAULT_SETTINGS_INPUT: SettingsInput = {
  sleepTargetMin: DEFAULT_SLEEP_TARGET_MIN,
  focusDefaultMin: DEFAULT_FOCUS_MIN,
  breakDefaultMin: DEFAULT_BREAK_MIN,
  onboarded: false,
  reducedMotion: false,
  highContrast: false,
  textSize: "md",
  reminders: DEFAULT_REMINDER_SETTINGS,
  defaultBlockMin: DEFAULT_BLOCK_MIN,
  deepWorkCapMin: DEFAULT_DEEP_WORK_CAP_MIN,
  snapMin: DEFAULT_SNAP_MIN,
  schemaVersion: SCHEMA_VERSION,
};

const base = createRepository<UserSettings>({
  label: "UserSettings",
  table: () => getDb().settings,
});

async function ensureSettings(): Promise<UserSettings> {
  const existing = await base.getById(SETTINGS_ID);
  if (existing) return existing;

  return base.create({ ...DEFAULT_SETTINGS_INPUT, id: SETTINGS_ID });
}

export const settingsRepository = {
  create: base.create,
  update: base.update,
  remove: base.remove,
  getById: base.getById,
  listByDateRange: base.listByDateRange,
  listAll: base.listAll,
  /** Returns the single settings row, creating it with defaults on first use. */
  ensure: ensureSettings,
  /** Merges a patch into the settings row and returns the stored result. */
  async save(patch: UpdateInput<UserSettings>): Promise<UserSettings> {
    if (!isIndexedDbAvailable()) {
      throw new Error("Settings can only be saved in the browser.");
    }
    const existing = await ensureSettings();
    return base.update(existing.id, patch);
  },
};
