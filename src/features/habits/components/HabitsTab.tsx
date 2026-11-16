"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { habitFormSchema, type HabitFormValues } from "@/features/habits/habitUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog, ISODate } from "@/types/domain";

export interface HabitsTabProps {
  habits: Habit[];
  habitLogs: HabitLog[];
  onToggleHabit: (habitId: string, date: ISODate, nextDone: boolean) => Promise<void>;
  onAddHabit: (name: string) => Promise<void>;
  onRenameHabit: (id: string, name: string) => Promise<void>;
  onArchiveHabit: (id: string, archived: boolean) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
}

export function HabitsTab({
  habits,
  habitLogs,
  onToggleHabit,
  onAddHabit,
  onRenameHabit,
  onArchiveHabit,
  onDeleteHabit,
}: HabitsTabProps) {
  const [selectedDate, setSelectedDate] = useState<ISODate>(() => toLocalISODate());
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: { name: "" },
  });

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.archived),
    [habits],
  );
  const archivedHabits = useMemo(
    () => habits.filter((h) => h.archived),
    [habits],
  );

  const doneByHabitId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const log of habitLogs) {
      if (log.date === selectedDate && log.done) {
        map.set(log.habitId, true);
      }
    }
    return map;
  }, [habitLogs, selectedDate]);

  const recentLogs = useMemo(() => {
    const habitName = new Map(habits.map((h) => [h.id, h.name]));
    return [...habitLogs]
      .filter((l) => l.done)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14)
      .map((l) => ({ ...l, habitName: habitName.get(l.habitId) ?? "Habit" }));
  }, [habitLogs, habits]);

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = habitFormSchema.parse(values);
    if (editingHabitId) {
      await onRenameHabit(editingHabitId, parsed.name);
      toast.success(`Updated "${parsed.name}".`);
      setEditingHabitId(null);
    } else {
      await onAddHabit(parsed.name);
      toast.success(`Added "${parsed.name}".`);
    }
    form.reset({ name: "" });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="habits-date">Day to log</Label>
              <Input
                id="habits-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44 rounded-control border-border bg-surface-2 font-mono text-body"
              />
            </div>
            <span className="text-caption text-muted-foreground">
              Tap to toggle · no streaks or penalties
            </span>
          </div>

          {activeHabits.length === 0 ? (
            <div className="pt-4">
              <EmptyState
                title="No active habits"
                description="Add a habit below or restore an archived one."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {activeHabits.map((habit) => {
                const done = doneByHabitId.get(habit.id) ?? false;
                return (
                  <li
                    key={habit.id}
                    className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-3 py-2.5"
                  >
                    <button
                      type="button"
                      aria-pressed={done}
                      onClick={async () => {
                        await onToggleHabit(habit.id, selectedDate, !done);
                        toast.success(
                          !done
                            ? `Marked "${habit.name}" for ${selectedDate}.`
                            : `Unmarked "${habit.name}" for ${selectedDate}.`,
                        );
                      }}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                          done
                            ? "border-cyan bg-cyan/20 text-cyan"
                            : "border-border bg-surface text-transparent",
                        )}
                      >
                        <Check className="size-3.5" aria-hidden />
                      </span>
                      <span className="text-body font-medium text-foreground">
                        {habit.icon ? `${habit.icon} ` : ""}
                        {habit.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit habit ${habit.name}`}
                        onClick={() => {
                          setEditingHabitId(habit.id);
                          form.reset({ name: habit.name });
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Archive habit ${habit.name}`}
                        onClick={async () => {
                          await onArchiveHabit(habit.id, true);
                          toast.success(`Archived "${habit.name}".`);
                        }}
                      >
                        <Archive className="size-3.5 text-muted-foreground" aria-hidden />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="rounded-card border border-border bg-surface p-5 shadow-none">
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <Label htmlFor="habit-name">
              {editingHabitId ? "Rename habit" : "Add a habit"}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="habit-name"
                placeholder="e.g. Morning sunlight"
                {...form.register("name")}
                className="flex-1 rounded-control border-border bg-surface-2"
              />
              <div className="flex gap-2">
                {editingHabitId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingHabitId(null);
                      form.reset({ name: "" });
                    }}
                    className="rounded-control"
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
                >
                  <Plus className="size-4" aria-hidden />
                  {editingHabitId ? "Save name" : "Add habit"}
                </Button>
              </div>
            </div>
            {form.formState.errors.name ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </form>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-5">
        {archivedHabits.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-section font-medium text-foreground">Archived habits</h2>
            <ul className="space-y-2">
              {archivedHabits.map((habit) => (
                <li
                  key={habit.id}
                  className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface p-3"
                >
                  <span className="text-body text-muted-foreground">{habit.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Restore habit ${habit.name}`}
                      onClick={async () => {
                        await onArchiveHabit(habit.id, false);
                        toast.success(`Restored "${habit.name}".`);
                      }}
                    >
                      <ArchiveRestore className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete habit ${habit.name}`}
                      onClick={async () => {
                        await onDeleteHabit(habit.id);
                        toast.success(`Deleted "${habit.name}".`);
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

        <div className="space-y-3">
          <h2 className="text-section font-medium text-foreground">Recent completions</h2>
          {recentLogs.length === 0 ? (
            <EmptyState
              title="Nothing toggled yet"
              description="Checked habits appear here for quick review."
            />
          ) : (
            <ul className="space-y-2">
              {recentLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-body text-foreground">{log.habitName}</p>
                    <p className="font-mono text-caption text-cyan tabular-nums">{log.date}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove completion of ${log.habitName} on ${log.date}`}
                    onClick={async () => {
                      await onToggleHabit(log.habitId, log.date, false);
                      toast.success(`Removed "${log.habitName}" for ${log.date}.`);
                    }}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
