"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DurationInput } from "@/components/nx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/db/hooks";
import { settingsRepository } from "@/lib/db/repositories";

const onboardingSchema = z.object({
  displayName: z.string().max(50, "Keep your name under 50 characters.").optional(),
  sleepTargetHours: z
    .number()
    .min(4, "Choose between 4 and 12 hours.")
    .max(12, "Choose between 4 and 12 hours."),
  focusDefaultMin: z
    .number()
    .int("Whole minutes only.")
    .min(5, "At least 5 minutes.")
    .max(180, "Max 180 minutes."),
});

type OnboardingValues = z.input<typeof onboardingSchema>;

export function OnboardingDialog() {
  const { data: settings, isLoading } = useSettings();

  const open = !isLoading && settings !== undefined && !settings.onboarded;

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: settings?.displayName ?? "",
      sleepTargetHours: settings ? Number((settings.sleepTargetMin / 60).toFixed(1)) : 8,
      focusDefaultMin: settings?.focusDefaultMin ?? 25,
    },
  });

  if (!open || !settings) return null;

  const handleSave = form.handleSubmit(async (values) => {
    const parsed = onboardingSchema.parse(values);
    await settingsRepository.save({
      displayName: parsed.displayName?.trim() || undefined,
      sleepTargetMin: Math.round(parsed.sleepTargetHours * 60),
      focusDefaultMin: parsed.focusDefaultMin,
      onboarded: true,
    });
    toast.success("Preferences saved locally.");
  });

  const handleSkip = async () => {
    await settingsRepository.save({ onboarded: true });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void handleSkip();
        }
      }}
    >
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to NeuroSync</DialogTitle>
          <DialogDescription>
            Set a few gentle defaults. Everything stays in your browser and can be changed anytime in
            Settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">Display name (optional)</Label>
            <Input
              id="onboard-name"
              placeholder="e.g. Sam"
              {...form.register("displayName")}
              className="rounded-control border-border bg-surface-2"
            />
            {form.formState.errors.displayName ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.displayName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onboard-sleep">Sleep target (hours per night)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="onboard-sleep"
                type="number"
                step="0.5"
                min={4}
                max={12}
                {...form.register("sleepTargetHours", { valueAsNumber: true })}
                className="w-24 rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
              />
              {[7, 7.5, 8, 8.5].map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => form.setValue("sleepTargetHours", h, { shouldValidate: true })}
                  className="rounded-chip font-mono text-caption"
                >
                  {h}h
                </Button>
              ))}
            </div>
            {form.formState.errors.sleepTargetHours ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.sleepTargetHours.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Controller
              control={form.control}
              name="focusDefaultMin"
              render={({ field }) => (
                <DurationInput
                  label="Default focus length"
                  valueMin={field.value}
                  onChange={field.onChange}
                  presets={[25, 50, 90]}
                />
              )}
            />
            {form.formState.errors.focusDefaultMin ? (
              <p role="alert" className="text-caption text-danger">
                {form.formState.errors.focusDefaultMin.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="rounded-control"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="rounded-control bg-violet text-white hover:bg-violet/90"
            >
              Save & begin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
