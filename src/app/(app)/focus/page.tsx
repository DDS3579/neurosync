"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { FocusSkeleton, FocusWorkspace } from "@/features/focus/components/FocusWorkspace";
import type { NewMicrotaskResultInput } from "@/features/focus/components/microtasks/MicrotasksTab";
import { createInitialReviewSchedule, scheduleNextReview } from "@/features/focus/reviewScheduler";
import { LEARNING_METHOD_OPTIONS } from "@/features/focus/timerUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import {
  useFocusSessions,
  useMicrotaskResults,
  useReviewItems,
  useSettings,
} from "@/lib/db/hooks";
import { focusRepository, microtaskRepository, reviewRepository } from "@/lib/db/repositories";
import { completeBlock } from "@/features/planner/services/blockActions";
import { useBlocks, useTasks } from "@/lib/db/hooks";
import { toast } from "sonner";
import type { FocusSession, LearningMethod, ReviewDifficulty } from "@/types/domain";

function FocusPageContent() {
  const searchParams = useSearchParams();
  const settings = useSettings();
  const focus = useFocusSessions();
  const reviews = useReviewItems();
  const microtasks = useMicrotaskResults();
  const prefersReducedMotion = usePrefersReducedMotion();

  const blocks = useBlocks();
  const tasks = useTasks();
  const rawBlockId = searchParams.get("blockId")?.trim() || undefined;
  const linkedBlock = rawBlockId ? blocks.data?.find((b) => b.id === rawBlockId) : undefined;
  const linkedTask = linkedBlock ? tasks.data?.find((t) => t.id === linkedBlock.taskId) : undefined;
  const linkable = useMemo(
    () =>
      linkedBlock && linkedTask && linkedBlock.status !== "done" && linkedBlock.status !== "skipped"
        ? { block: linkedBlock, task: linkedTask }
        : null,
    [linkedBlock, linkedTask],
  );

  const prefillSubject = linkable?.task.title ?? (searchParams.get("subject")?.trim() || undefined);
  const rawPlanned = Number(searchParams.get("plannedMin"));
  const prefillPlannedMin = linkable
    ? Math.max(1, Math.min(240, Math.round(linkable.block.plannedMin)))
    : Number.isFinite(rawPlanned) && rawPlanned >= 1 && rawPlanned <= 240
      ? Math.round(rawPlanned)
      : undefined;
  const rawMethod = searchParams.get("method");
  const prefillMethod: LearningMethod | undefined =
    rawMethod && LEARNING_METHOD_OPTIONS.some((option) => option.value === rawMethod)
      ? (rawMethod as LearningMethod)
      : undefined;

  const blockFinish = useMemo(() => {
    if (!linkable) return null;
    const { block, task } = linkable;
    return {
      blockId: block.id,
      title: task.title,
      onFinish: async (session: Omit<FocusSession, "id" | "createdAt" | "updatedAt">) => {
        const result = await completeBlock(block.id, { session });
        toast.success(
          result.alreadyDone
            ? `"${task.title}" was already finished — no second session was created.`
            : `Logged ${session.durationMin}m and marked "${task.title}" done.`,
        );
      },
    };
  }, [linkable]);

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

  const onCreateMicrotaskResult = useCallback(async (values: NewMicrotaskResultInput) => {
    await microtaskRepository.create(values);
  }, []);

  const onDeleteMicrotaskResult = useCallback(
    (id: string) => microtaskRepository.remove(id),
    [],
  );

  if (
    settings.isLoading ||
    focus.isLoading ||
    reviews.isLoading ||
    microtasks.isLoading ||
    blocks.isLoading ||
    tasks.isLoading ||
    !settings.data ||
    !focus.data ||
    !reviews.data ||
    !microtasks.data ||
    !blocks.data ||
    !tasks.data
  ) {
    return <FocusSkeleton />;
  }

  return (
    <FocusWorkspace
      defaultFocusMin={settings.data.focusDefaultMin}
      initialSubject={prefillSubject}
      initialPlannedMin={prefillPlannedMin}
      initialMethod={prefillMethod}
      blockFinish={blockFinish}
      sessions={focus.data}
      reviewItems={reviews.data}
      microtaskResults={microtasks.data}
      reducedMotion={Boolean(settings.data.reducedMotion) || prefersReducedMotion}
      onCreateSession={onCreateSession}
      onDeleteSession={onDeleteSession}
      onAddReviewItem={onAddReviewItem}
      onRateReviewItem={onRateReviewItem}
      onDeleteReviewItem={onDeleteReviewItem}
      onCreateMicrotaskResult={onCreateMicrotaskResult}
      onDeleteMicrotaskResult={onDeleteMicrotaskResult}
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
