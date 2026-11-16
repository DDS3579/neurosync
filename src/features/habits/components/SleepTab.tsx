"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ChartCard, EmptyState, RatingInput } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SleepChart } from "@/features/overview/overview-charts";
import {
  computeSleepWindow,
  extractHHMM,
  formatDurationMinutes,
  sleepFormSchema,
  toLocalISODate,
  type SleepFormValues,
} from "@/features/sleep/sleepUtils";
import type { SleepLog } from "@/types/domain";

export interface SleepTabProps {
  sleepLogs: SleepLog[];
  sleepTargetMin: number;
  onCreateSleep: (values: Omit<SleepLog, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateSleep: (id: string, values: Omit<SleepLog, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onDeleteSleep: (id: string) => Promise<void>;
}

const DEFAULT_VALUES = (): SleepFormValues => ({
  date: toLocalISODate(),
  bedtimeHHMM: "23:00",
  wakeTimeHHMM: "07:00",
  quality: 3,
  rested: 3,
  interruptions: 0,
});

export function SleepTab({
  sleepLogs,
  sleepTargetMin,
  onCreateSleep,
  onUpdateSleep,
  onDeleteSleep,
}: SleepTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<SleepFormValues>({
    resolver: zodResolver(sleepFormSchema),
    defaultValues: DEFAULT_VALUES(),
  });

  const wakeDateISO = useWatch({ control: form.control, name: "date" });
  const bedtimeHHMM = useWatch({ control: form.control, name: "bedtimeHHMM" });
  const wakeTimeHHMM = useWatch({ control: form.control, name: "wakeTimeHHMM" });

  const preview = useMemo(
    () => computeSleepWindow({ wakeDateISO, bedtimeHHMM, wakeTimeHHMM }),
    [wakeDateISO, bedtimeHHMM, wakeTimeHHMM],
  );

  const sortedHistory = useMemo(
    () => [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [sleepLogs],
  );

  const recentChartData = useMemo(() => {
    return [...sortedHistory]
      .slice(0, 7)
      .reverse()
      .map((item) => ({
        day: item.date.slice(5),
        hours: Number((item.durationMin / 60).toFixed(2)),
      }));
  }, [sortedHistory]);

  const targetHours = Number((sleepTargetMin / 60).toFixed(1));

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = sleepFormSchema.parse(values);
    const window = computeSleepWindow({
      wakeDateISO: parsed.date,
      bedtimeHHMM: parsed.bedtimeHHMM,
      wakeTimeHHMM: parsed.wakeTimeHHMM,
    });
    if (!window) return;

    const payload = {
      date: parsed.date,
      bedtime: window.bedtime,
      wakeTime: window.wakeTime,
      durationMin: window.durationMin,
      quality: parsed.quality,
      rested: parsed.rested,
      interruptions: parsed.interruptions,
    };

    if (editingId) {
      await onUpdateSleep(editingId, payload);
      toast.success(`Updated sleep log for ${parsed.date}.`);
      setEditingId(null);
    } else {
      await onCreateSleep(payload);
      toast.success(`Logged ${formatDurationMinutes(window.durationMin)} of sleep.`);
    }
    form.reset(DEFAULT_VALUES());
  });

  const startEdit = (entry: SleepLog) => {
    setEditingId(entry.id);
    form.reset({
      date: entry.date,
      bedtimeHHMM: extractHHMM(entry.bedtime, "23:00"),
      wakeTimeHHMM: extractHHMM(entry.wakeTime, "07:00"),
      quality: entry.quality,
      rested: entry.rested,
      interruptions: entry.interruptions,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="rounded-card border border-border bg-surface p-5 shadow-none lg:col-span-7">
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sleep-date">Wake-up date</Label>
                <Input
                  id="sleep-date"
                  type="date"
                  {...form.register("date")}
                  className="rounded-control border-border bg-surface-2 font-mono text-body"
                />
                {form.formState.errors.date ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.date.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sleep-bedtime">Bedtime</Label>
                <Input
                  id="sleep-bedtime"
                  type="time"
                  {...form.register("bedtimeHHMM")}
                  className="rounded-control border-border bg-surface-2 font-mono text-body"
                />
                {form.formState.errors.bedtimeHHMM ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.bedtimeHHMM.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sleep-waketime">Wake time</Label>
                <Input
                  id="sleep-waketime"
                  type="time"
                  {...form.register("wakeTimeHHMM")}
                  className="rounded-control border-border bg-surface-2 font-mono text-body"
                />
                {form.formState.errors.wakeTimeHHMM ? (
                  <p role="alert" className="text-caption text-danger">
                    {form.formState.errors.wakeTimeHHMM.message}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Neutral duration & target summary — never a score */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-4 py-3">
              <div>
                <p className="text-caption text-muted-foreground">Computed duration</p>
                <p className="font-mono text-section font-medium text-foreground tabular-nums">
                  {preview ? formatDurationMinutes(preview.durationMin) : "—"}
                  {preview?.crossedMidnight ? (
                    <span className="ml-2 text-caption text-cyan">(crossed midnight)</span>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                <p className="text-caption text-muted-foreground">Your target</p>
                <p className="font-mono text-body text-foreground tabular-nums">
                  {formatDurationMinutes(sleepTargetMin)}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="quality"
                render={({ field }) => (
                  <RatingInput
                    label="Sleep quality"
                    value={field.value}
                    onChange={field.onChange}
                    lowLabel="Restless"
                    highLabel="Deep"
                  />
                )}
              />
              <Controller
                control={form.control}
                name="rested"
                render={({ field }) => (
                  <RatingInput
                    label="How rested you feel"
                    value={field.value}
                    onChange={field.onChange}
                    lowLabel="Groggy"
                    highLabel="Refreshed"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sleep-interruptions">Interruptions</Label>
              <Input
                id="sleep-interruptions"
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                {...form.register("interruptions", { valueAsNumber: true })}
                className="w-28 rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
              />
              {form.formState.errors.interruptions ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.interruptions.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
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
                {editingId ? "Update sleep log" : "Save sleep log"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4 lg:col-span-5">
          <ChartCard
            title="Recent nights"
            description={`Your target: ${targetHours}h per night (neutral reference line)`}
            empty={recentChartData.length === 0}
            emptyMessage="Log a night of sleep to see it compared gently against your target."
          >
            <SleepChart data={recentChartData} targetHours={targetHours} />
          </ChartCard>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-section font-medium text-foreground">Past sleep logs</h2>
        {sortedHistory.length === 0 ? (
          <EmptyState
            title="No sleep logs yet"
            description="Nights you record appear here with bedtime, wake time, and duration."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {sortedHistory.slice(0, 14).map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-caption text-cyan tabular-nums">
                      {entry.date}
                    </span>
                    <span className="font-mono text-body font-medium text-foreground tabular-nums">
                      {formatDurationMinutes(entry.durationMin)}
                    </span>
                  </div>
                  <p className="font-mono text-caption text-muted-foreground tabular-nums">
                    {extractHHMM(entry.bedtime, "--:--")} → {extractHHMM(entry.wakeTime, "--:--")} ·
                    Quality {entry.quality}/5 · Rested {entry.rested}/5 · Interruptions{" "}
                    {entry.interruptions}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit sleep log for ${entry.date}`}
                    onClick={() => startEdit(entry)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete sleep log for ${entry.date}`}
                    onClick={async () => {
                      await onDeleteSleep(entry.id);
                      if (editingId === entry.id) setEditingId(null);
                      toast.success(`Removed sleep log for ${entry.date}.`);
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
  );
}
