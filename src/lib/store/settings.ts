import { create } from "zustand";

import { isIndexedDbAvailable } from "@/lib/db/dexie";
import { settingsRepository } from "@/lib/db/repositories";
import type { UserSettings } from "@/types/domain";

export {
  DEFAULT_BREAK_MIN,
  DEFAULT_FOCUS_MIN,
  DEFAULT_SETTINGS_INPUT,
  DEFAULT_SLEEP_TARGET_MIN,
} from "@/lib/db/repositories";

export type SettingsPatch = Partial<Omit<UserSettings, "id" | "createdAt" | "updatedAt">>;

export type SettingsStatus = "idle" | "loading" | "ready" | "error";

export interface SettingsState {
  settings: UserSettings | null;
  status: SettingsStatus;
  error: string | null;
  load: () => Promise<void>;
  save: (patch: SettingsPatch) => Promise<void>;
  reset: () => void;
}

/**
 * Runtime copy of the settings row. The database stays the source of truth;
 * this store exists so components can read settings without prop drilling.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  status: "idle",
  error: null,

  async load() {
    if (!isIndexedDbAvailable() || get().status === "loading") return;

    set({ status: "loading", error: null });

    try {
      const settings = await settingsRepository.ensure();
      set({ settings, status: "ready" });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Could not load settings.",
      });
    }
  },

  async save(patch) {
    if (!isIndexedDbAvailable()) return;

    try {
      const settings = await settingsRepository.save(patch);
      set({ settings, status: "ready", error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Could not save settings.",
      });
    }
  },

  reset() {
    set({ settings: null, status: "idle", error: null });
  },
}));

export const selectSettings = (state: SettingsState): UserSettings | null => state.settings;
