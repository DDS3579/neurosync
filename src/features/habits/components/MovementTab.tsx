"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { DurationInput, EmptyState, RatingInput } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MOVEMENT_TYPES,
  movementFormSchema,
  type MovementFormValues,
} from "@/features/movement/movementUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import type { MovementLog } from "@/types/domain";

export interface MovementTabProps {
  movementLogs: MovementLog[];
  onCreateMovement: (values: Omit<MovementLog, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateMovement: (
    id: string,
    values: Omit<MovementLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteMovement: (id: string) => Promise<void>;
}

const DEFAULT_VALUES = (): MovementFormValues => ({
  date: toLocalISODate(),
  type: "walk",
  durationMin: 30,
  effort: 3,
});

export function MovementTab({
  movementLogs,
  onCreateMovement,
  onUpdateMovement,
  onDeleteMovement,
}: MovementTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: DEFAULT_VALUES(),
  });

  const sortedHistory = useMemo(
    () => [...movementLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [movementLogs],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = movementFormSchema.parse(values);
    if (editingId) {
      await onUpdateMovement(editingId, parsed);
      toast.success(`Updated movement log for ${parsed.date}.`);
      setEditingId(null);
    } else {
      await onCreateMovement(parsed);
      toast.success(`Logged ${parsed.durationMin}m of ${parsed.type}.`);
    }
    form.reset(DEFAULT_VALUES());
  });

  const startEdit = (entry: MovementLog) => {
    setEditingId(entry.id);
    form.reset({
      date: entry.date,
      type: entry.type,
      durationMin: entry.durationMin,
      effort: entry.effort,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none lg:col-span-6">
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="movement-date">Date</Label>
              <Input
                id="movement-date"
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
              <Label htmlFor="movement-type">Activity type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="movement-type"
                      className="w-full rounded-control border-border bg-surface-2"
                    >
                      <SelectValue placeholder="Choose activity" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOVEMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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
            name="effort"
            render={({ field }) => (
              <RatingInput
                label="Perceived effort"
                value={field.value}
                onChange={field.onChange}
                lowLabel="Gentle"
                highLabel="All-out"
              />
            )}
          />

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
              {editingId ? "Update movement" : "Save movement"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-6">
        <h2 className="text-section font-medium text-foreground">Past movement logs</h2>
        {sortedHistory.length === 0 ? (
          <EmptyState
            title="No movement logged yet"
            description="Walks, stretches, runs, and workouts you log appear here."
          />
        ) : (
          <ul className="space-y-2.5">
            {sortedHistory.slice(0, 14).map((entry) => {
              const label =
                MOVEMENT_TYPES.find((t) => t.value === entry.type)?.label ?? entry.type;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-caption text-cyan tabular-nums">
                        {entry.date}
                      </span>
                      <span className="text-body font-medium text-foreground">{label}</span>
                    </div>
                    <p className="font-mono text-caption text-muted-foreground tabular-nums">
                      {entry.durationMin} min · Effort {entry.effort}/5
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit movement log for ${entry.date}`}
                      onClick={() => startEdit(entry)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete movement log for ${entry.date}`}
                      onClick={async () => {
                        await onDeleteMovement(entry.id);
                        if (editingId === entry.id) setEditingId(null);
                        toast.success(`Removed movement log for ${entry.date}.`);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
