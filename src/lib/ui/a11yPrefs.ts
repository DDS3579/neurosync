import { normalizeTextSize } from "@/features/brain/useBrainQuality";
import type { TextSizePref } from "@/types/domain";

export const UI_A11Y_STORAGE_KEY = "ns:ui:v1:a11y";

export interface UiA11yPrefs {
  reducedMotion: boolean;
  highContrast: boolean;
  textSize: TextSizePref;
}

export const DEFAULT_UI_A11Y_PREFS: UiA11yPrefs = {
  reducedMotion: false,
  highContrast: false,
  textSize: "md",
};

/**
 * Reads cached accessibility display preferences from localStorage without touching Dexie.
 * Wrapped in try/catch with safe defaults for SSR, private browsing, or malformed JSON.
 */
export function readUiA11yPrefs(): UiA11yPrefs {
  if (typeof window === "undefined") return DEFAULT_UI_A11Y_PREFS;
  try {
    const raw = window.localStorage.getItem(UI_A11Y_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_A11Y_PREFS;
    const parsed = JSON.parse(raw) as Partial<UiA11Y_PREFS> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_UI_A11Y_PREFS;
    return {
      reducedMotion: Boolean(parsed.reducedMotion),
      highContrast: Boolean(parsed.highContrast),
      textSize: normalizeTextSize(parsed.textSize),
    };
  } catch {
    return DEFAULT_UI_A11Y_PREFS;
  }
}

/**
 * Mirrors accessibility display preferences to localStorage so routes outside the
 * Dexie app shell (e.g. `/`) stay in sync without loading IndexedDB code.
 */
export function writeUiA11yPrefs(prefs: UiA11yPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: UiA11yPrefs = {
      reducedMotion: Boolean(prefs.reducedMotion),
      highContrast: Boolean(prefs.highContrast),
      textSize: normalizeTextSize(prefs.textSize),
    };
    window.localStorage.setItem(UI_A11Y_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}
