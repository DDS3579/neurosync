import { clampBrainSize } from "@/features/brain/brainControls";

export const UI_BRAIN_IMMERSIVE_KEY = "ns:ui:v1:brain-immersive";
export const UI_BRAIN_SIZE_KEY = "ns:ui:v1:brain-size";
export const BRAIN_UI_PREFS_EVENT = "ns:ui:brain-prefs-change";

export const DEFAULT_BRAIN_IMMERSIVE = true;
export const DEFAULT_BRAIN_SIZE = 1.0;

/**
 * Reads the persisted immersive Brain Explorer preference (`ns:ui:v1:brain-immersive`).
 * Defaults to `true` when unset, unavailable, or invalid.
 */
export function readBrainImmersivePref(): boolean {
  if (typeof window === "undefined") return DEFAULT_BRAIN_IMMERSIVE;
  try {
    const raw = window.localStorage.getItem(UI_BRAIN_IMMERSIVE_KEY);
    if (raw === null) return DEFAULT_BRAIN_IMMERSIVE;
    if (raw === "true") return true;
    if (raw === "false") return false;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : DEFAULT_BRAIN_IMMERSIVE;
  } catch {
    return DEFAULT_BRAIN_IMMERSIVE;
  }
}

/**
 * Writes the immersive Brain Explorer preference (`ns:ui:v1:brain-immersive`).
 */
export function writeBrainImmersivePref(immersive: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_BRAIN_IMMERSIVE_KEY, JSON.stringify(Boolean(immersive)));
    window.dispatchEvent(new Event(BRAIN_UI_PREFS_EVENT));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

/**
 * Reads the persisted brain scale factor (`ns:ui:v1:brain-size`), clamped to [0.5, 2.0].
 */
export function readBrainSizePref(): number {
  if (typeof window === "undefined") return DEFAULT_BRAIN_SIZE;
  try {
    const raw = window.localStorage.getItem(UI_BRAIN_SIZE_KEY);
    if (raw === null) return DEFAULT_BRAIN_SIZE;
    const num = Number(raw);
    return clampBrainSize(num);
  } catch {
    return DEFAULT_BRAIN_SIZE;
  }
}

/**
 * Writes the brain scale factor (`ns:ui:v1:brain-size`), clamped to [0.5, 2.0].
 */
export function writeBrainSizePref(size: number): number {
  const clamped = clampBrainSize(size);
  if (typeof window === "undefined") return clamped;
  try {
    window.localStorage.setItem(UI_BRAIN_SIZE_KEY, String(clamped));
    window.dispatchEvent(new Event(BRAIN_UI_PREFS_EVENT));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
  return clamped;
}
