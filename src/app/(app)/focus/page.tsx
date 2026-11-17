"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";

import { FocusSkeleton, FocusWorkspace } from "@/features/focus/components/FocusWorkspace";
import { createInitialReviewSchedule, scheduleNextReview } from "@/features/focus/reviewScheduler";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { useFocusSessions, useReviewItems, useSettings } from "@/lib/db/hooks";
import { focusRepository, reviewRepository } from "@/lib/db/repositories";
import type { FocusSession, ReviewDifficulty } from "@/types/domain";

function FocusPageContent() {
  const searchParams = useSearchParams();
  const settings = useSettings();
  const focus = useFocusSessions();
  const reviews = useReviewItems();

  const prefillSubject = searchParams.get("subject")?.trim() || undefined;
  const rawPlanned = Number(searchParams.get("plannedMin"));
  const prefillPlannedMin =
    Number.isFinite(rawPlanned) && rawPlanned >= 1 && rawPlanned <= 240
      ? Math.round(rawPlanned)
      : undefined;

  const onCreateSession = useCallback(
    async (values: Omit<FocusSession, "id" | "createdAt" | "updatedAt">) => {
      await focusRepository.create(values);
    },
    [],
  );

  const onDeleteSession = useCallback((id: string) => focusRepository.remove(id), []);

  const onAddReviewItem = useCallback(async (values: { topic: string; notes?: string }) => {
    const initial = createInitialReviewSchedule(toLocalISODate());
    await reviewRepository.create({
      topic: values.topic,
      notes: values.notes,
      ...initial,
    });
  }, []);

  const onRateReviewItem = useCallback(
    async (id: string, rating: ReviewDifficulty): Promise<number> => {
      const existing = reviews.data?.find((item) => item.id === id);
      if (!existing) return 1;
      const next = scheduleNextReview(existing, rating, toLocalISODate());
      await reviewRepository.update(id, {
        intervalStep: next.intervalStep,
        nextReviewDate: next.nextReviewDate,
        lastReviewedDate: next.lastReviewedDate,
        reviewCount: next.reviewCount,
      });
      return next.intervalDays;
    },
    [reviews.data],
  );

  const onDeleteReviewItem = useCallback((id: string) => reviewRepository.remove(id), []);

  if (
    settings.isLoading ||
    focus.isLoading ||
    reviews.isLoading ||
    !settings.data ||
    !focus.data ||
    !reviews.data
  ) {
    return <FocusSkeleton />;
  }

  return (
    <FocusWorkspace
      defaultFocusMin={settings.data.focusDefaultMin}
      initialSubject={prefillSubject}
      initialPlannedMin={prefillPlannedMin}
      sessions={focus.data}
      reviewItems={reviews.data}
      onCreateSession={onCreateSession}
      onDeleteSession={onDeleteSession}
      onAddReviewItem={onAddReviewItem}
      onRateReviewItem={onRateReviewItem}
      onDeleteReviewItem={onDeleteReviewItem}
    />
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={<FocusSkeleton />}>
      <FocusPageContent />
    </Suspense>
  );
}
