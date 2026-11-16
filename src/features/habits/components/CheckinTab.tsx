"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState, RatingInput } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkinFormSchema, type CheckinFormValues } from "@/features/checkin/checkinUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import type { DailyCheckin, ISODate } from "@/types/domain";

export interface CheckinTabProps {
  checkins: DailyCheckin[];
  onSaveCheckin: (values: Omit<DailyCheckin, "id" | "createdAt" | "updatedAt">) => Promise<"created" | "updated">;
  onDeleteCheckin: (id: string) => Promise<void>;
}

function defaultForDate(date: ISODate, existing?: DailyCheckin): CheckinFormValues {
  if (existing) {
    return {
      date: existing.date,
      mood: existing.mood,
      stress: existing.stress,
      energy: existing.energy,
      concentration: existing.concentration,
      motivation: existing.motivation,
      outdoorMin: existing.outdoorMin,
      note: existing.note ?? "",
    };
  }
  return {
    date,
    mood: 3,
    stress: 3,
    energy: 3,
    concentration: 3,
    motivation: 3,
    outdoorMin: undefined,
    note: "",
  };
}

export function CheckinTab({
  checkins,
  onSaveCheckin,
  onDeleteCheckin,
}: CheckinTabProps) {
  const today = toLocalISODate();
  const initialExisting = checkins.find((c) => c.date === today);

  const form = useForm<CheckinFormValues>({
    resolver: zodResolver(checkinFormSchema),
    defaultValues: defaultForDate(today, initialExisting),
  });

  const watchedDate = useWatch({ control: form.control, name: "date" });
  const watchedOutdoor = useWatch({ control: form.control, name: "outdoorMin" });
  const existingForDate = checkins.find((c) => c.date === watchedDate);

  const handleDateChange = (nextDate: ISODate) => {
    const match = checkins.find((c) => c.date === nextDate);
    form.reset(defaultForDate(nextDate, match));
  };

  const sortedHistory = [...checkins].sort((a, b) => b.date.localeCompare(a.date));

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = checkinFormSchema.parse(values);
    const mode = await onSaveCheckin({
      date: parsed.date,
      mood: parsed.mood,
      stress: parsed.stress,
      energy: parsed.energy,
      concentration: parsed.concentration,
      motivation: parsed.motivation,
      outdoorMin: parsed.outdoorMin,
      note: parsed.note?.trim() || undefined,
    });
    toast.success(
      mode === "updated"
        ? `Updated check-in for ${parsed.date}.`
        : `Saved check-in for ${parsed.date}.`,
    );
  });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none lg:col-span-7">
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-date">Check-in date</Label>
              <Input
                id="checkin-date"
                type="date"
                value={watchedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-44 rounded-control border-border bg-surface-2 font-mono text-body"
              />
              {form.formState.errors.date ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.date.message}
                </p>
              ) : null}
            </div>

            <span className="font-mono text-caption text-muted-foreground">
              {existingForDate
                ? "Editing existing check-in for this day"
                : "One check-in per day"}
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="mood"
              render={({ field }) => (
                <RatingInput
                  label="Mood"
                  value={field.value}
                  onChange={field.onChange}
                  lowLabel="Low"
                  highLabel="Bright"
                />
              )}
            />
            <Controller
              control={form.control}
              name="stress"
              render={({ field }) => (
                <RatingInput
                  label="Stress"
                  value={field.value}
                  onChange={field.onChange}
                  lowLabel="Calm"
                  highLabel="High"
                />
              )}
            />
            <Controller
              control={form.control}
              name="energy"
              render={({ field }) => (
                <RatingInput
                  label="Energy"
                  value={field.value}
                  onChange={field.onChange}
                  lowLabel="Drained"
                  highLabel="Rested"
                />
              )}
            />
            <Controller
              control={form.control}
              name="concentration"
              render={({ field }) => (
                <RatingInput
                  label="Concentration"
                  value={field.value}
                  onChange={field.onChange}
                  lowLabel="Scattered"
                  highLabel="Steady"
                />
              )}
            />
            <Controller
              control={form.control}
              name="motivation"
              render={({ field }) => (
                <RatingInput
                  label="Motivation"
                  value={field.value}
                  onChange={field.onChange}
                  lowLabel="Reluctant"
                  highLabel="Engaged"
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkin-outdoor">Outdoor time (optional, minutes)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="checkin-outdoor"
                type="number"
                min={0}
                max={1440}
                inputMode="numeric"
                placeholder="Optional"
                value={watchedOutdoor ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    form.setValue("outdoorMin", undefined, { shouldValidate: true });
                    return;
                  }
                  const num = Number(raw);
                  form.setValue("outdoorMin", Number.isFinite(num) ? Math.round(num) : undefined, {
                    shouldValidate: true,
                  });
                }}
                className="w-32 rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
              />
              {[15, 30, 60].map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => form.setValue("outdoorMin", m, { shouldValidate: true })}
                  className="rounded-chip font-mono text-caption"
                >
                  {m}m
                </Button>
              ))}
            </div>
            {form.formState.errors.outdoorMin ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.outdoorMin.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkin-note">Note (optional)</Label>
            <Textarea
              id="checkin-note"
              rows={3}
              placeholder="Anything worth remembering about today..."
              {...form.register("note")}
              className="rounded-control border-border bg-surface-2"
            />
            {form.formState.errors.note ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.note.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="rounded-control bg-violet text-white hover:bg-violet/90"
            >
              {existingForDate ? "Update check-in" : "Save check-in"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-5">
        <h2 className="text-section font-medium text-foreground">Past check-ins</h2>
        {sortedHistory.length === 0 ? (
          <EmptyState
            title="No check-ins yet"
            description="Your daily check-ins will appear here so you can revisit or adjust any day."
          />
        ) : (
          <ul className="space-y-2.5">
            {sortedHistory.slice(0, 14).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-caption text-cyan tabular-nums">
                    {entry.date}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit check-in for ${entry.date}`}
                      onClick={() => form.reset(defaultForDate(entry.date, entry))}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete check-in for ${entry.date}`}
                      onClick={async () => {
                        await onDeleteCheckin(entry.id);
                        toast.success(`Removed check-in for ${entry.date}.`);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </div>
                </div>

                <p className="font-mono text-caption text-muted-foreground tabular-nums">
                  Mood {entry.mood}/5 · Stress {entry.stress}/5 · Energy {entry.energy}/5 · Focus{" "}
                  {entry.concentration}/5 · Motivation {entry.motivation}/5
                </p>

                {entry.outdoorMin !== undefined ? (
                  <p className="text-caption text-muted-foreground">
                    Outdoor: {entry.outdoorMin} min
                  </p>
                ) : null}
                {entry.note ? (
                  <p className="text-body text-foreground/90">{entry.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
