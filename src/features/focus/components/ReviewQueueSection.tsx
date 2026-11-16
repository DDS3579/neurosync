"use client";

import { useMemo } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Play, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  intervalDaysForStep,
  partitionReviewQueue,
  reviewItemFormSchema,
  type ReviewItemFormValues,
} from "@/features/focus/reviewScheduler";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import type { ReviewDifficulty, ReviewItem } from "@/types/domain";

export interface ReviewQueueSectionProps {
  items: ReviewItem[];
  onAddItem: (values: { topic: string; notes?: string }) => Promise<void>;
  onRateItem: (id: string, rating: ReviewDifficulty) => Promise<number>;
  onDeleteItem: (id: string) => Promise<void>;
  onStartReviewSession: (item: ReviewItem) => void;
}

export function ReviewQueueSection({
  items,
  onAddItem,
  onRateItem,
  onDeleteItem,
  onStartReviewSession,
}: ReviewQueueSectionProps) {
  const todayISO = toLocalISODate();

  const form = useForm<ReviewItemFormValues>({
    resolver: zodResolver(reviewItemFormSchema),
    defaultValues: { topic: "", notes: "" },
  });

  const { due, upcoming } = useMemo(
    () => partitionReviewQueue(items, todayISO),
    [items, todayISO],
  );

  const handleAdd = form.handleSubmit(async (values) => {
    const parsed = reviewItemFormSchema.parse(values);
    await onAddItem({
      topic: parsed.topic,
      notes: parsed.notes ? parsed.notes : undefined,
    });
    toast.success(`Added "${parsed.topic}" to review queue (due tomorrow).`);
    form.reset({ topic: "", notes: "" });
  });

  const handleRate = async (item: ReviewItem, rating: ReviewDifficulty) => {
    const nextDays = await onRateItem(item.id, rating);
    toast.success(
      `Marked "${item.topic}" as ${rating} — next review in ${nextDays} ${nextDays === 1 ? "day" : "days"}.`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Manual add card */}
        <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-5">
          <form onSubmit={handleAdd} className="space-y-4" noValidate>
            <div className="space-y-1">
              <h2 className="text-section font-medium text-foreground">Add topic to review</h2>
              <p className="text-caption text-muted-foreground">
                Fixed spaced-repetition intervals (1, 3, 7, 14, 30 days). Easy advances, okay
                repeats, hard steps back.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-topic">Topic</Label>
              <Input
                id="review-topic"
                placeholder="e.g. Action potentials, French irregular verbs"
                {...form.register("topic")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.topic ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.topic.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-notes">Cue or prompt (optional)</Label>
              <Input
                id="review-notes"
                placeholder="What to recall first"
                {...form.register("notes")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.notes ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.notes.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Link
                href="/library#spaced-repetition"
                className="inline-flex items-center gap-1 text-caption text-cyan underline-offset-4 hover:underline"
              >
                How spaced repetition works
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
              >
                <Plus className="size-4" aria-hidden />
                Add to queue
              </Button>
            </div>
          </form>
        </Card>

        {/* Due today list */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-section font-medium text-foreground">
              Due today ({due.length})
            </h2>
            <span className="font-mono text-caption text-cyan tabular-nums">{todayISO}</span>
          </div>

          {due.length === 0 ? (
            <EmptyState
              title="Nothing due today"
              description="Add a topic manually or check the toggle at the end of a focus session to build your review queue."
            />
          ) : (
            <ul className="space-y-3">
              {due.map((item) => (
                <li
                  key={item.id}
                  className="space-y-3 rounded-card border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body font-medium text-foreground">{item.topic}</span>
                        <Badge
                          variant="outline"
                          className="rounded-chip border-cyan/40 bg-cyan/10 font-mono text-[11px] text-cyan tabular-nums"
                        >
                          {intervalDaysForStep(item.intervalStep)}d step
                        </Badge>
                      </div>
                      <p className="font-mono text-caption text-muted-foreground tabular-nums">
                        Due {item.nextReviewDate} · {item.reviewCount}{" "}
                        {item.reviewCount === 1 ? "review" : "reviews"}
                      </p>
                      {item.notes ? (
                        <p className="text-caption text-muted-foreground">{item.notes}</p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete review topic ${item.topic}`}
                      onClick={async () => {
                        await onDeleteItem(item.id);
                        toast.success(`Removed "${item.topic}" from review queue.`);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onStartReviewSession(item)}
                      className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
                    >
                      <Play className="size-3.5" aria-hidden />
                      Start review session
                    </Button>

                    <div className="flex items-center gap-1.5" role="group" aria-label={`Rate review for ${item.topic}`}>
                      <span className="mr-1 text-caption text-muted-foreground">Log recall:</span>
                      {(["easy", "okay", "hard"] as const).map((rating) => (
                        <Button
                          key={rating}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRate(item, rating)}
                          className="h-7 rounded-chip px-2.5 text-caption capitalize"
                        >
                          {rating}
                        </Button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming items */}
      {upcoming.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-section font-medium text-foreground">
            Upcoming reviews ({upcoming.length})
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {upcoming.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-caption text-cyan tabular-nums">
                      {item.nextReviewDate}
                    </span>
                    <span className="text-body font-medium text-foreground">{item.topic}</span>
                  </div>
                  <p className="font-mono text-caption text-muted-foreground tabular-nums">
                    {intervalDaysForStep(item.intervalStep)}d interval · {item.reviewCount}{" "}
                    {item.reviewCount === 1 ? "review" : "reviews"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onStartReviewSession(item)}
                    className="h-8 gap-1 rounded-control text-caption"
                  >
                    <Play className="size-3" aria-hidden />
                    Review early
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete review topic ${item.topic}`}
                    onClick={async () => {
                      await onDeleteItem(item.id);
                      toast.success(`Removed "${item.topic}" from review queue.`);
                    }}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
