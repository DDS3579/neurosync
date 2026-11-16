"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { partitionReviewQueue } from "@/features/focus/reviewScheduler";
import {
  evaluateDueReminders,
  formatLocalDate,
  normalizeReminderSettings,
  readFiredSlotKeys,
  writeFiredSlotKeys,
} from "@/features/reminders/reminderUtils";
import { useReviewItems, useSettings } from "@/lib/db/hooks";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Checks opt-in local reminders on mount, visibilitychange, focus, and a
 * lightweight 30s interval. Never requests Notification permission automatically.
 */
export function ReminderRunner() {
  const router = useRouter();
  const { data: settings } = useSettings();
  const { data: reviewItems } = useReviewItems();

  useEffect(() => {
    if (!settings?.reminders || typeof window === "undefined") return;

    const reminders = normalizeReminderSettings(settings.reminders);
    const anyEnabled =
      reminders.windDown.enabled ||
      reminders.checkin.enabled ||
      reminders.reviewDue.enabled;
    if (!anyEnabled) return;

    const check = () => {
      const now = new Date();
      const todayISO = formatLocalDate(now);
      const dueReviewCount = reviewItems
        ? partitionReviewQueue(reviewItems, todayISO).due.length
        : 0;

      const fired = readFiredSlotKeys();
      const due = evaluateDueReminders({
        reminders,
        now,
        firedSlotKeys: fired,
        dueReviewCount,
      });

      if (due.length === 0) return;

      for (const item of due) {
        fired.add(item.slotKey);

        toast(item.title, {
          description: item.body,
          action: {
            label: "Open",
            onClick: () => router.push(item.href),
          },
        });

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const note = new Notification(item.title, { body: item.body });
            note.onclick = () => {
              window.focus();
              router.push(item.href);
              note.close();
            };
          } catch {
            // Ignore browser environments where Notification constructor fails.
          }
        }
      }

      writeFiredSlotKeys(fired);
    };

    check();

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const onFocus = () => check();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(intervalId);
    };
  }, [reviewItems, router, settings?.reminders]);

  return null;
}
