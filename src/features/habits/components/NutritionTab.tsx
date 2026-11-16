"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  nutritionFormSchema,
  type NutritionFormValues,
} from "@/features/nutrition/nutritionUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import type { NutritionLog } from "@/types/domain";

export interface NutritionTabProps {
  nutritionLogs: NutritionLog[];
  onCreateNutrition: (
    values: Omit<NutritionLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateNutrition: (
    id: string,
    values: Omit<NutritionLog, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteNutrition: (id: string) => Promise<void>;
}

const DEFAULT_VALUES = (): NutritionFormValues => ({
  date: toLocalISODate(),
  regularMeals: true,
  fruitVeg: false,
  varied: false,
  waterGlasses: 6,
  note: "",
});

export function NutritionTab({
  nutritionLogs,
  onCreateNutrition,
  onUpdateNutrition,
  onDeleteNutrition,
}: NutritionTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<NutritionFormValues>({
    resolver: zodResolver(nutritionFormSchema),
    defaultValues: DEFAULT_VALUES(),
  });

  const sortedHistory = useMemo(
    () => [...nutritionLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [nutritionLogs],
  );

  const water = useWatch({ control: form.control, name: "waterGlasses" });

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = nutritionFormSchema.parse(values);
    const payload = {
      ...parsed,
      note: parsed.note?.trim() || undefined,
    };

    if (editingId) {
      await onUpdateNutrition(editingId, payload);
      toast.success(`Updated nutrition log for ${parsed.date}.`);
      setEditingId(null);
    } else {
      await onCreateNutrition(payload);
      toast.success(`Saved nutrition log for ${parsed.date}.`);
    }
    form.reset(DEFAULT_VALUES());
  });

  const startEdit = (entry: NutritionLog) => {
    setEditingId(entry.id);
    form.reset({
      date: entry.date,
      regularMeals: entry.regularMeals,
      fruitVeg: entry.fruitVeg,
      varied: entry.varied,
      waterGlasses: entry.waterGlasses,
      note: entry.note ?? "",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none lg:col-span-6">
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="nutrition-date">Date</Label>
            <Input
              id="nutrition-date"
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

          <div className="space-y-3">
            {(
              [
                {
                  name: "regularMeals",
                  id: "nutrition-regular",
                  label: "Regular meals",
                  hint: "Ate at steady intervals without skipping meals",
                },
                {
                  name: "fruitVeg",
                  id: "nutrition-fruitveg",
                  label: "Fruit & vegetables",
                  hint: "Included plants or whole produce today",
                },
                {
                  name: "varied",
                  id: "nutrition-varied",
                  label: "Varied food",
                  hint: "A mix of proteins, fiber, and carbs",
                },
              ] as const
            ).map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-2 px-4 py-3"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={item.id} className="text-body font-medium text-foreground">
                    {item.label}
                  </Label>
                  <p className="text-caption text-muted-foreground">{item.hint}</p>
                </div>
                <Controller
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <Switch
                      id={item.id}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nutrition-water">Water (glasses)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Remove one glass of water"
                onClick={() =>
                  form.setValue("waterGlasses", Math.max(0, water - 1), {
                    shouldValidate: true,
                  })
                }
                className="rounded-control"
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Input
                id="nutrition-water"
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                {...form.register("waterGlasses", { valueAsNumber: true })}
                className="w-20 rounded-control border-border bg-surface-2 text-center font-mono text-body tabular-nums"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Add one glass of water"
                onClick={() =>
                  form.setValue("waterGlasses", Math.min(30, water + 1), {
                    shouldValidate: true,
                  })
                }
                className="rounded-control"
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
            {form.formState.errors.waterGlasses ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.waterGlasses.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nutrition-note">Note (optional)</Label>
            <Textarea
              id="nutrition-note"
              rows={2}
              placeholder="Any observation about meals or hydration..."
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
              {editingId ? "Update nutrition" : "Save nutrition"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-6">
        <h2 className="text-section font-medium text-foreground">Past nutrition logs</h2>
        {sortedHistory.length === 0 ? (
          <EmptyState
            title="No nutrition logs yet"
            description="Simple meal rhythm and water entries appear here — no calorie counting."
          />
        ) : (
          <ul className="space-y-2.5">
            {sortedHistory.slice(0, 14).map((entry) => {
              const tags = [
                entry.regularMeals ? "Regular meals" : null,
                entry.fruitVeg ? "Fruit & veg" : null,
                entry.varied ? "Varied" : null,
              ].filter(Boolean);

              return (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-caption text-cyan tabular-nums">
                        {entry.date}
                      </span>
                      <span className="font-mono text-caption text-muted-foreground tabular-nums">
                        {entry.waterGlasses} glasses
                      </span>
                    </div>
                    <p className="text-body text-foreground">
                      {tags.length > 0 ? tags.join(" · ") : "Logged without checkboxes"}
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
                      aria-label={`Edit nutrition log for ${entry.date}`}
                      onClick={() => startEdit(entry)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete nutrition log for ${entry.date}`}
                      onClick={async () => {
                        await onDeleteNutrition(entry.id);
                        if (editingId === entry.id) setEditingId(null);
                        toast.success(`Removed nutrition log for ${entry.date}.`);
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
