"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

import {
  A11Y_PREFS_EVENT,
  HIGH_CONTRAST_ATTR,
  REDUCED_MOTION_ATTR,
  REDUCED_MOTION_EVENT,
  TEXT_SIZE_ATTR,
  normalizeTextSize,
  resolveHighContrast,
  resolveReducedMotion,
} from "@/features/brain/useBrainQuality";
import { useSettings } from "@/lib/db/hooks";
import { writeUiA11yPrefs } from "@/lib/ui/a11yPrefs";

const RM_QUERY = "(prefers-reduced-motion: reduce)";
const HC_QUERY = "(prefers-contrast: more)";
const FC_QUERY = "(forced-colors: active)";

/**
 * Syncs accessibility display preferences (`reducedMotion`, `highContrast`, `textSize`)
 * onto `<html>` data attributes and MotionConfig so landing, app shell, and 3D brain
 * canvases all respect them consistently.
 */
export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const settingReduced = Boolean(settings?.reducedMotion);
  const settingHighContrast = Boolean(settings?.highContrast);
  const textSize = normalizeTextSize(settings?.textSize);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const rmMq = window.matchMedia(RM_QUERY);
    const hcMq = window.matchMedia(HC_QUERY);
    const fcMq = window.matchMedia(FC_QUERY);

    const apply = () => {
      writeUiA11yPrefs({
        reducedMotion: settingReduced,
        highContrast: settingHighContrast,
        textSize,
      });
      const effectiveRM = resolveReducedMotion(rmMq.matches, settingReduced);
      const effectiveHC = resolveHighContrast(hcMq.matches, fcMq.matches, settingHighContrast);
      const root = document.documentElement;
      root.setAttribute(REDUCED_MOTION_ATTR, effectiveRM ? "true" : "false");
      root.setAttribute(HIGH_CONTRAST_ATTR, effectiveHC ? "true" : "false");
      root.setAttribute(TEXT_SIZE_ATTR, textSize);
      window.dispatchEvent(new Event(REDUCED_MOTION_EVENT));
      window.dispatchEvent(new Event(A11Y_PREFS_EVENT));
    };

    apply();
    rmMq.addEventListener("change", apply);
    hcMq.addEventListener("change", apply);
    fcMq.addEventListener("change", apply);
    return () => {
      rmMq.removeEventListener("change", apply);
      hcMq.removeEventListener("change", apply);
      fcMq.removeEventListener("change", apply);
    };
  }, [settingReduced, settingHighContrast, textSize]);

  return (
    <MotionConfig reducedMotion={settingReduced ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
