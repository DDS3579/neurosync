"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

import {
  REDUCED_MOTION_ATTR,
  REDUCED_MOTION_EVENT,
  resolveReducedMotion,
} from "@/features/brain/useBrainQuality";
import { useSettings } from "@/lib/db/hooks";

const RM_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Syncs `OS prefers-reduced-motion || settings.reducedMotion` onto
 * `<html data-reduced-motion="true|false">` and configures MotionConfig.
 */
export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const settingReduced = Boolean(settings?.reducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const mq = window.matchMedia(RM_QUERY);
    const apply = () => {
      const effective = resolveReducedMotion(mq.matches, settingReduced);
      document.documentElement.setAttribute(
        REDUCED_MOTION_ATTR,
        effective ? "true" : "false",
      );
      window.dispatchEvent(new Event(REDUCED_MOTION_EVENT));
    };

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settingReduced]);

  return (
    <MotionConfig reducedMotion={settingReduced ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
