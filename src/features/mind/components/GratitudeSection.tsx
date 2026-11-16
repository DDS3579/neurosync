"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  gratitudeFormSchema,
  normalizeGratitudeItems,
  sortGratitudeEntries,
  type GratitudeFormValues,
} from "@/features/mind/mindUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import type { GratitudeEntry } from "@/types/domain";

export interface GratitudeSectionProps {
  entries: GratitudeEntry[];
  onSaveEntry: (
    values: Omit<GratitudeEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<"created" | "updated">;
  onDeleteEntry: (id: string) => Promise<void>;
}

const DEFAULT_VALUES = (): GratitudeFormValues => ({
  date: toLocalISODate(),
  line1: "",
  line2: "",
  line3: "",
});

export function GratitudeSection({
  entries,
  onSaveEntry,
  onDeleteEntry,
}: GratitudeSectionProps) {
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const form = useForm<GratitudeFormValues>({
    resolver: zodResolver(gratitudeFormSchema),
    defaultValues: DEFAULT_VALUES(),
  });

  const sorted = useMemo(() => sortGratitudeEntries(entries), [entries]);

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = gratitudeFormSchema.parse(values);
    const items = normalizeGratitudeItems([parsed.line1, parsed.line2, parsed.line3]);
    const mode = await onSaveEntry({ date: parsed.date, items });
    toast.success(
      mode === "updated"
        ? `Updated gratitude note for ${parsed.date}.`
        : `Saved gratitude note for ${parsed.date}.`,
    );
    setEditingDate(null);
    form.reset(DEFAULT_VALUES());
  });

  const startEdit = (entry: GratitudeEntry) => {
    setEditingDate(entry.date);
    form.reset({
      date: entry.date,
      line1: entry.items[0] ?? "",
      line2: entry.items[1] ?? "",
      line3: entry.items[2] ?? "",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <h2 className="text-section font-medium text-foreground">What went well?</h2>
            <p className="text-caption text-muted-foreground">
              Notice 1–3 ordinary things from your day. Saving again for the same date updates that
              day&apos;s note.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gratitude-date">Date</Label>
            <Input
              id="gratitude-date"
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

          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="gratitude-line1">Line 1</Label>
              <Input
                id="gratitude-line1"
                placeholder="Something small that went well..."
                {...form.register("line1")}
                className="rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.line1 ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.line1.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="gratitude-line2" className="text-muted-foreground">
                Line 2 (optional)
              </Label>
              <Input
                id="gratitude-line2"
                placeholder="Another small moment..."
                {...form.register("line2")}
                className="rounded-control border-border bg-surface-2"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="gratitude-line3" className="text-muted-foreground">
                Line 3 (optional)
              </Label>
              <Input
                id="gratitude-line3"
                placeholder="One more if you'd like..."
                {...form.register("line3")}
                className="rounded-control border-border bg-surface-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {editingDate ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingDate(null);
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
              {editingDate ? "Update gratitude" : "Save gratitude"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-6">
        <h2 className="text-section font-medium text-foreground">Past gratitude notes</h2>
        {sorted.length === 0 ? (
          <EmptyState
            title="No gratitude notes yet"
            description="One to three short lines about what went well will appear here."
          />
        ) : (
          <ul className="space-y-2.5">
            {sorted.slice(0, 14).map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="min-w-0 space-y-1.5">
                  <span className="block font-mono text-caption text-cyan tabular-nums">
                    {entry.date}
                  </span>
                  <ul className="list-disc space-y-1 pl-4 text-body text-foreground">
                    {entry.items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit gratitude note for ${entry.date}`}
                    onClick={() => startEdit(entry)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete gratitude note for ${entry.date}`}
                    onClick={async () => {
                      await onDeleteEntry(entry.id);
                      if (editingDate === entry.date) {
                        setEditingDate(null);
                        form.reset(DEFAULT_VALUES());
                      }
                      toast.success(`Removed gratitude note for ${entry.date}.`);
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
