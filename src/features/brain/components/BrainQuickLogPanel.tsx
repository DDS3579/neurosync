"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Play, Plus, Smile } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  PERSONAL_ACTIVITY_LABELS,
  PERSONAL_ACTIVITY_OPTIONS,
  activityFormSchema,
} from "@/features/activities/activityUtils";
import { toLocalISODate } from "@/features/sleep/sleepUtils";
import { cn } from "@/lib/utils";
import type { PersonalActivityType, Rating } from "@/types/domain";

export interface BrainQuickLogPanelProps {
  onCreateActivity: (input: {
    date: string;
    type: PersonalActivityType;
    durationMin: number;
    enjoyment: Rating;
  }) => Promise<void>;
  onQuickMoodCheckin: (mood: Rating, date: string) => Promise<"created" | "updated">;
  onQuickFocusLog?: (input: {
    date: string;
    subject: string;
    durationMin: number;
  }) => Promise<void>;
}

const DURATION_PRESETS = [15, 30, 45, 60] as const;
const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

export function BrainQuickLogPanel({
  onCreateActivity,
  onQuickMoodCheckin,
  onQuickFocusLog,
}: BrainQuickLogPanelProps) {
  const [activityType, setActivityType] = useState<PersonalActivityType>("social");
  const [durationMin, setDurationMin] = useState<number>(30);
  const [savingActivity, setSavingActivity] = useState(false);

  const [mood, setMood] = useState<Rating>(4);
  const [savingMood, setSavingMood] = useState(false);

  const [focusSubject, setFocusSubject] = useState("");
  const [focusMin, setFocusMin] = useState<number>(25);
  const [savingFocus, setSavingFocus] = useState(false);

  const handleActivitySubmit = async (e: FormEvent) => {
    e.preventDefault();
    const today = toLocalISODate();
    const parsed = activityFormSchema.safeParse({
      date: today,
      type: activityType,
      durationMin,
      enjoyment: 4,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter valid minutes (1–600).");
      return;
    }
    setSavingActivity(true);
    try {
      await onCreateActivity({
        date: parsed.data.date,
        type: parsed.data.type,
        durationMin: parsed.data.durationMin,
        enjoyment: parsed.data.enjoyment,
      });
      toast.success(
        `Logged ${parsed.data.durationMin}m of ${PERSONAL_ACTIVITY_LABELS[parsed.data.type].toLowerCase()}.`,
      );
    } finally {
      setSavingActivity(false);
    }
  };

  const handleSaveMood = async () => {
    setSavingMood(true);
    try {
      const mode = await onQuickMoodCheckin(mood, toLocalISODate());
      toast.success(
        mode === "updated"
          ? `Updated today's mood check-in (${mood}/5).`
          : `Saved today's mood check-in (${mood}/5).`,
      );
    } finally {
      setSavingMood(false);
    }
  };

  const handleQuickFocusLog = async () => {
    if (!onQuickFocusLog) return;
    const mins = Math.min(240, Math.max(5, Math.round(focusMin || 25)));
    setSavingFocus(true);
    try {
      await onQuickFocusLog({
        date: toLocalISODate(),
        subject: focusSubject.trim() || "Focus block",
        durationMin: mins,
      });
      toast.success(`Logged ${mins}m focus session.`);
      setFocusSubject("");
    } finally {
      setSavingFocus(false);
    }
  };

  const focusHref = focusSubject.trim()
    ? `/focus?subject=${encodeURIComponent(focusSubject.trim())}&plannedMin=${focusMin}`
    : `/focus?plannedMin=${focusMin}`;

  return (
    <div className="space-y-4">
      {/* 1. Quick activity log */}
      <form onSubmit={handleActivitySubmit} className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor="brain-quick-activity-type" className="text-caption text-foreground">
            Log an activity
          </Label>
          <Select
            value={activityType}
            onValueChange={(v) => setActivityType(v as PersonalActivityType)}
          >
            <SelectTrigger
              id="brain-quick-activity-type"
              aria-label="Activity type"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONAL_ACTIVITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="brain-quick-activity-min" className="text-caption text-muted-foreground">
              Minutes
            </Label>
            <div className="flex items-center gap-1">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationMin(preset)}
                  className={cn(
                    "rounded-chip border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                    durationMin === preset
                      ? "border-cyan/60 bg-cyan/15 text-cyan"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="brain-quick-activity-min"
              type="number"
              min={1}
              max={600}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="h-8 w-24 rounded-control border-border bg-surface-2 font-mono text-caption tabular-nums"
            />
            <Button
              type="submit"
              size="sm"
              disabled={savingActivity}
              className="h-8 flex-1 gap-1.5 rounded-control bg-violet text-white hover:bg-violet/90"
            >
              <Plus className="size-3.5" aria-hidden />
              {savingActivity ? "Saving…" : "Log activity"}
            </Button>
          </div>
        </div>
      </form>

      {/* 2. Mood check-in shortcut */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-foreground">
            <Smile className="size-3.5 text-cyan" aria-hidden />
            Quick mood check-in
          </span>
          <Link
            href="/habits#checkin"
            className="text-[11px] text-cyan underline-offset-4 hover:underline"
          >
            Full check-in →
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <div role="group" aria-label="Mood rating 1 to 5" className="flex flex-1 gap-1">
            {RATINGS.map((val) => (
              <button
                key={val}
                type="button"
                aria-pressed={mood === val}
                onClick={() => setMood(val)}
                className={cn(
                  "h-7 flex-1 rounded-control border font-mono text-caption transition-colors",
                  mood === val
                    ? "border-cyan/60 bg-cyan/15 text-cyan"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
              >
                {val}
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={savingMood}
            onClick={handleSaveMood}
            className="h-7 rounded-control px-2.5 text-caption"
          >
            {savingMood ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* 3. Focus session shortcut */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-medium text-foreground">Focus session</span>
          <span className="font-mono text-[11px] text-muted-foreground">{focusMin}m</span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            aria-label="Focus session topic"
            placeholder="Topic (optional)"
            value={focusSubject}
            onChange={(e) => setFocusSubject(e.target.value)}
            className="h-8 flex-1 rounded-control border-border bg-surface-2 text-caption"
          />
          <select
            aria-label="Focus duration minutes"
            value={focusMin}
            onChange={(e) => setFocusMin(Number(e.target.value))}
            className="h-8 rounded-control border border-border bg-surface-2 px-2 font-mono text-caption text-foreground"
          >
            <option value={15}>15m</option>
            <option value={25}>25m</option>
            <option value={50}>50m</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button asChild size="sm" variant="outline" className="h-7 flex-1 gap-1 rounded-control text-caption">
            <Link href={focusHref}>
              <Play className="size-3 text-cyan" aria-hidden />
              Start timer
            </Link>
          </Button>
          {onQuickFocusLog ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingFocus}
              onClick={handleQuickFocusLog}
              className="h-7 rounded-control px-2.5 text-caption"
            >
              {savingFocus ? "Saving…" : "Log now"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
