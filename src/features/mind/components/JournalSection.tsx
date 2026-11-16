"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Search, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/nx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  filterJournalEntries,
  journalFormSchema,
  type JournalFormValues,
} from "@/features/mind/mindUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import type { JournalEntry } from "@/types/domain";

export interface JournalSectionProps {
  entries: JournalEntry[];
  onCreateEntry: (values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateEntry: (
    id: string,
    values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

const DEFAULT_VALUES = (): JournalFormValues => ({
  date: toLocalISODate(),
  text: "",
});

export function JournalSection({
  entries,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
}: JournalSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: DEFAULT_VALUES(),
  });

  const filteredEntries = useMemo(
    () => filterJournalEntries(entries, searchQuery),
    [entries, searchQuery],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = journalFormSchema.parse(values);
    if (editingId) {
      await onUpdateEntry(editingId, parsed);
      toast.success(`Updated journal note for ${parsed.date}.`);
      setEditingId(null);
    } else {
      await onCreateEntry(parsed);
      toast.success(`Saved journal note for ${parsed.date}.`);
    }
    form.reset(DEFAULT_VALUES());
  });

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    form.reset({
      date: entry.date,
      text: entry.text,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <h2 className="text-section font-medium text-foreground">Daily journal</h2>
            <p className="text-caption text-muted-foreground">
              Write a few sentences whenever you like. Entries live only in this browser and are
              never analysed, scored, or sent anywhere.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="journal-date">Date</Label>
            <Input
              id="journal-date"
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
            <Label htmlFor="journal-text">Note</Label>
            <Textarea
              id="journal-text"
              rows={4}
              placeholder="A few sentences about today, what felt clear, or what is on your mind..."
              {...form.register("text")}
              className="rounded-control border-border bg-surface-2 text-body"
            />
            {form.formState.errors.text ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.text.message}
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
              {editingId ? "Update entry" : "Save entry"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-section font-medium text-foreground">Journal entries</h2>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              aria-label="Search journal entries"
              className="h-9 rounded-control border-border bg-surface pr-8 pl-8 text-body"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear journal search"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            title="No journal entries yet"
            description="Your short private notes will appear here and can be searched anytime."
          />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            title="No matching entries"
            description="Try a different word or clear the search filter."
          />
        ) : (
          <ul className="space-y-2.5">
            {filteredEntries.slice(0, 20).map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4"
              >
                <div className="min-w-0 space-y-1.5">
                  <span className="block font-mono text-caption text-cyan tabular-nums">
                    {entry.date}
                  </span>
                  <p className="text-body whitespace-pre-wrap text-foreground">{entry.text}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit journal entry from ${entry.date}`}
                    onClick={() => startEdit(entry)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete journal entry from ${entry.date}`}
                    onClick={async () => {
                      await onDeleteEntry(entry.id);
                      if (editingId === entry.id) {
                        setEditingId(null);
                        form.reset(DEFAULT_VALUES());
                      }
                      toast.success(`Removed journal entry from ${entry.date}.`);
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
