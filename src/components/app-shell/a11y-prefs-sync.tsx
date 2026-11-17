"use client";

import { useEffect } from "react";

import {
  A11Y_PREFS_EVENT,
  HIGH_CONTRAST_ATTR,
  REDUCED_MOTION_ATTR,
  REDUCED_MOTION_EVENT,
  TEXT_SIZE_ATTR,
  resolveHighContrast,
  resolveReducedMotion,
} from "@/features/brain/useBrainQuality";
import { UI_A11Y_STORAGE_KEY, readUiA11yPrefs } from "@/lib/ui/a11yPrefs";

const RM_QUERY = "(prefers-reduced-motion: reduce)";
const HC_QUERY = "(prefers-contrast: more)";
const FC_QUERY = "(forced-colors: active)";

/**
 * Lightweight root accessibility attribute sync using OS media queries and versioned
 * localStorage (`ns:ui:v1:a11y`) so marketing routes do not load Dexie or motion/react.
 */
export function A11yPrefsSync() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const rmMq = window.matchMedia(RM_QUERY);
    const hcMq = window.matchMedia(HC_QUERY);
    const fcMq = window.matchMedia(FC_QUERY);

    const apply = () => {
      const cached = readUiA11yPrefs();
      const effectiveRM = resolveReducedMotion(rmMq.matches, cached.reducedMotion);
      const effectiveHC = resolveHighContrast(hcMq.matches, fcMq.matches, cached.highContrast);
      const root = document.documentElement;
      root.setAttribute(REDUCED_MOTION_ATTR, effectiveRM ? "true" : "false");
      root.setAttribute(HIGH_CONTRAST_ATTR, effectiveHC ? "true" : "false");
      root.setAttribute(TEXT_SIZE_ATTR, cached.textSize);
      window.dispatchEvent(new Event(REDUCED_MOTION_EVENT));
      window.dispatchEvent(new Event(A11Y_PREFS_EVENT));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === UI_A11Y_STORAGE_KEY) {
        apply();
      }
    };

    apply();
    rmMq.addEventListener("change", apply);
    hcMq.addEventListener("change", apply);
    fcMq.addEventListener("change", apply);
    window.addEventListener("storage", onStorage);
    return () => {
      rmMq.removeEventListener("change", apply);
      hcMq.removeEventListener("change", apply);
      fcMq.removeEventListener("change", apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
