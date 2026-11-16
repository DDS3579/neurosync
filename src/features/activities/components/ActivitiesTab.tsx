"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { DurationInput, EmptyState, RatingInput } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PERSONAL_ACTIVITY_LABELS,
  PERSONAL_ACTIVITY_OPTIONS,
  activityFormSchema,
  sortActivityLogs,
  summarizeWeeklyActivityVariety,
  type ActivityFormValues,
} from "@/features/activities/activityUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { cn } from "@/lib/utils";
import type { ActivityLog, PersonalActivityType } from "@/types/domain";

export interface ActivitiesTabProps {
  activityLogs: ActivityLog[];
  onCreateActivity: (
    values: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateActivity: (
    id: string,
    values: Omit<ActivityLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
}

const DEFAULT_VALUES = (): ActivityFormValues => ({
  date: toLocalISODate(),
  type: "social",
  durationMin: 30,
  enjoyment: 4,
  note: "",
});

export function ActivitiesTab({
  activityLogs,
  onCreateActivity,
  onUpdateActivity,
  onDeleteActivity,
}: ActivitiesTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickSavingType, setQuickSavingType] = useState<PersonalActivityType | null>(null);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: DEFAULT_VALUES(),
  });

  const selectedType = useWatch({
    control: form.control,
    name: "type",
  });

  const sortedHistory = useMemo(() => sortActivityLogs(activityLogs), [activityLogs]);
  const weeklyVariety = useMemo(
    () => summarizeWeeklyActivityVariety(activityLogs),
    [activityLogs],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = activityFormSchema.parse(values);
    const payload = {
      date: parsed.date,
      type: parsed.type,
      durationMin: parsed.durationMin,
      enjoyment: parsed.enjoyment,
      note: parsed.note ? parsed.note : undefined,
    };

    if (editingId) {
      await onUpdateActivity(editingId, payload);
      toast.success(`Updated ${PERSONAL_ACTIVITY_LABELS[parsed.type].toLowerCase()} log.`);
      setEditingId(null);
    } else {
      await onCreateActivity(payload);
      toast.success(
        `Logged ${parsed.durationMin}m of ${PERSONAL_ACTIVITY_LABELS[parsed.type].toLowerCase()}.`,
      );
    }
    form.reset(DEFAULT_VALUES());
  });

  const handleQuickAdd = async (type: PersonalActivityType) => {
    const option = PERSONAL_ACTIVITY_OPTIONS.find((o) => o.value === type);
    const minutes = option?.quickDurationMin ?? 30;
    setQuickSavingType(type);
    try {
      await onCreateActivity({
        date: toLocalISODate(),
        type,
        durationMin: minutes,
        enjoyment: 4,
      });
      toast.success(`Quick-logged ${minutes}m of ${PERSONAL_ACTIVITY_LABELS[type].toLowerCase()}.`);
    } finally {
      setQuickSavingType(null);
    }
  };

  const startEdit = (entry: ActivityLog) => {
    setEditingId(entry.id);
    form.reset({
      date: entry.date,
      type: entry.type,
      durationMin: entry.durationMin,
      enjoyment: entry.enjoyment,
      note: entry.note ?? "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Weekly variety summary (types used, never a score) */}
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-section font-medium text-foreground">This week beyond study</h2>
            <p className="text-caption text-muted-foreground">
              {weeklyVariety.distinctTypesCount === 0
                ? "Log time spent with people, hobbies, music, puzzles, or anything new."
                : `${weeklyVariety.distinctTypesCount} ${weeklyVariety.distinctTypesCount === 1 ? "kind" : "kinds"} of activities logged in the last 7 days (${weeklyVariety.totalLogs} ${weeklyVariety.totalLogs === 1 ? "entry" : "entries"}, ${weeklyVariety.totalMinutes} min total).`}
            </p>
          </div>
          <span className="font-mono text-caption text-cyan tabular-nums">
            {weeklyVariety.windowStart} → {weeklyVariety.windowEnd}
          </span>
        </div>

        {weeklyVariety.byType.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {weeklyVariety.byType.map((item) => (
              <Badge
                key={item.type}
                variant="outline"
                className="gap-1.5 rounded-chip border-border bg-surface-2 px-3 py-1 font-normal text-foreground"
              >
                <span>{item.label}</span>
                <span className="font-mono text-caption text-cyan tabular-nums">
                  {item.minutes}m
                </span>
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Activity type</Label>
                {!editingId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={quickSavingType !== null}
                    onClick={() => void handleQuickAdd(selectedType)}
                    className="h-7 gap-1 rounded-chip border-cyan/40 text-caption text-cyan hover:bg-cyan/10"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Quick log{" "}
                    {PERSONAL_ACTIVITY_OPTIONS.find((o) => o.value === selectedType)?.quickDurationMin ??
                      30}
                    m
                  </Button>
                ) : null}
              </div>

              {/* Quick-add chips */}
              <div
                role="group"
                aria-label="Choose activity type"
                className="flex flex-wrap gap-1.5"
              >
                {PERSONAL_ACTIVITY_OPTIONS.map((option) => {
                  const selected = selectedType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        form.setValue("type", option.value, { shouldDirty: true });
                        if (!editingId) {
                          form.setValue("durationMin", option.quickDurationMin, {
                            shouldDirty: true,
                          });
                        }
                      }}
                      className={cn(
                        "rounded-chip border px-3 py-1.5 text-caption transition-colors",
                        selected
                          ? "border-violet bg-violet/15 font-medium text-foreground"
                          : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-caption text-muted-foreground">
                {PERSONAL_ACTIVITY_OPTIONS.find((o) => o.value === selectedType)?.hint}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="activity-date">Date</Label>
              <Input
                id="activity-date"
                type="date"
                {...form.register("date")}
                className="w-44 rounded-control border-border bg-surface-2 font-mono text-body"
              />
              {form.formState.errors.date ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.date.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Controller
                control={form.control}
                name="durationMin"
                render={({ field }) => (
                  <DurationInput
                    label="Duration"
                    valueMin={field.value}
                    onChange={field.onChange}
                    presets={[15, 30, 45, 60, 90]}
                  />
                )}
              />
              {form.formState.errors.durationMin ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.durationMin.message}
                </p>
              ) : null}
            </div>

            <Controller
              control={form.control}
              name="enjoyment"
              render={({ field }) => (
                <RatingInput
                  label="Enjoyment"
                  value={field.value}
                  onChange={field.onChange}
                  lowLabel="Meh"
                  highLabel="Loved it"
                />
              )}
            />

            <div className="space-y-1.5">
              <Label htmlFor="activity-note">Short note (optional)</Label>
              <Input
                id="activity-note"
                placeholder="What did you do or try?"
                {...form.register("note")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.note ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.note.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    form.reset(DEFAULT_VALUES());
                  }}
                  className="rounded-control"
                >
                  Cancel edit
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="rounded-control bg-violet text-white hover:bg-violet/90"
              >
                {editingId ? "Update activity" : "Save activity"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-3 lg:col-span-6">
          <h2 className="text-section font-medium text-foreground">Past activity logs</h2>
          {sortedHistory.length === 0 ? (
            <EmptyState
              title="No activities logged yet"
              description="Social time, hobbies, music, puzzles, and new experiences appear here and feed Brain Explorer."
            />
          ) : (
            <ul className="space-y-2.5">
              {sortedHistory.slice(0, 14).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-caption text-cyan tabular-nums">
                        {entry.date}
                      </span>
                      <span className="text-body font-medium text-foreground">
                        {PERSONAL_ACTIVITY_LABELS[entry.type]}
                      </span>
                    </div>
                    <p className="font-mono text-caption text-muted-foreground tabular-nums">
                      {entry.durationMin} min · Enjoyment {entry.enjoyment}/5
                    </p>
                    {entry.note ? (
                      <p className="text-caption text-muted-foreground">{entry.note}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${PERSONAL_ACTIVITY_LABELS[entry.type]} log for ${entry.date}`}
                      onClick={() => startEdit(entry)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${PERSONAL_ACTIVITY_LABELS[entry.type]} log for ${entry.date}`}
                      onClick={async () => {
                        await onDeleteActivity(entry.id);
                        if (editingId === entry.id) {
                          setEditingId(null);
                          form.reset(DEFAULT_VALUES());
                        }
                        toast.success(`Removed activity log for ${entry.date}.`);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
