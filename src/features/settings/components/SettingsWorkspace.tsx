"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, CalendarPlus, Download, ShieldAlert, Trash2, Upload } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DurationInput, PageHeader } from "@/components/nx";
import { resetPanelLayout } from "@/components/floating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_REMINDER_SETTINGS,
  buildRemindersIcs,
  normalizeReminderSettings,
} from "@/features/reminders/reminderUtils";
import type { BackupMode, ImportSummary } from "@/lib/db/backup";
import {
  BRAIN_UI_PREFS_EVENT,
  DEFAULT_BRAIN_IMMERSIVE,
  DEFAULT_BRAIN_SIZE,
  UI_BRAIN_IMMERSIVE_KEY,
  UI_BRAIN_SIZE_KEY,
  readBrainImmersivePref,
  readBrainSizePref,
  writeBrainImmersivePref,
  writeBrainSizePref,
} from "@/lib/ui/brainUiPrefs";
import type { ReminderSettings, TextSizePref, UserSettings } from "@/types/domain";

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM 24-hour time.");

const reminderSlotSchema = z.object({
  enabled: z.boolean(),
  time: hhmmSchema,
});

const settingsFormSchema = z.object({
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
  breakDefaultMin: z
    .number()
    .int("Whole minutes only.")
    .min(1, "At least 1 minute.")
    .max(60, "Max 60 minutes."),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  textSize: z.enum(["sm", "md", "lg"]),
  reminders: z.object({
    windDown: reminderSlotSchema,
    checkin: reminderSlotSchema,
    reviewDue: reminderSlotSchema,
    quietHours: z.object({
      enabled: z.boolean(),
      start: hhmmSchema,
      end: hhmmSchema,
    }),
  }),
});

type SettingsFormValues = z.input<typeof settingsFormSchema>;

export interface SettingsWorkspaceProps {
  settings: UserSettings;
  onSaveSettings: (patch: {
    displayName?: string;
    sleepTargetMin: number;
    focusDefaultMin: number;
    breakDefaultMin: number;
    reducedMotion: boolean;
    highContrast: boolean;
    textSize: TextSizePref;
    reminders: ReminderSettings;
  }) => Promise<void>;
  onExportJson: () => Promise<void>;
  onImportJson: (text: string, mode: BackupMode) => Promise<ImportSummary>;
  onDeleteAllData: () => Promise<void>;
}

function subscribeImmersiveBrainSetting(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === UI_BRAIN_IMMERSIVE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BRAIN_UI_PREFS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BRAIN_UI_PREFS_EVENT, callback);
  };
}

function subscribeBrainSizeSetting(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === UI_BRAIN_SIZE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BRAIN_UI_PREFS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BRAIN_UI_PREFS_EVENT, callback);
  };
}

function readNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function SettingsWorkspace({
  settings,
  onSaveSettings,
  onExportJson,
  onImportJson,
  onDeleteAllData,
}: SettingsWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingImportText, setPendingImportText] = useState<string | null>(null);
  const [pendingImportFilename, setPendingImportFilename] = useState<string>("");
  const [importMode, setImportMode] = useState<BackupMode>("merge");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => readNotificationPermission(),
  );
  const immersiveBrain = useSyncExternalStore(
    subscribeImmersiveBrainSetting,
    readBrainImmersivePref,
    () => DEFAULT_BRAIN_IMMERSIVE,
  );
  const brainSize = useSyncExternalStore(
    subscribeBrainSizeSetting,
    readBrainSizePref,
    () => DEFAULT_BRAIN_SIZE,
  );

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      displayName: settings.displayName ?? "",
      sleepTargetHours: Number((settings.sleepTargetMin / 60).toFixed(1)),
      focusDefaultMin: settings.focusDefaultMin,
      breakDefaultMin: settings.breakDefaultMin,
      reducedMotion: Boolean(settings.reducedMotion),
      highContrast: Boolean(settings.highContrast),
      textSize: settings.textSize ?? "md",
      reminders: normalizeReminderSettings(settings.reminders),
    },
  });

  const watchedReminders = useWatch({
    control: form.control,
    name: "reminders",
  });

  const handleSave = async (values: SettingsFormValues) => {
    const parsed = settingsFormSchema.parse(values);
    await onSaveSettings({
      displayName: parsed.displayName?.trim() || undefined,
      sleepTargetMin: Math.round(parsed.sleepTargetHours * 60),
      focusDefaultMin: parsed.focusDefaultMin,
      breakDefaultMin: parsed.breakDefaultMin,
      reducedMotion: parsed.reducedMotion,
      highContrast: parsed.highContrast,
      textSize: parsed.textSize,
      reminders: parsed.reminders,
    });
    toast.success("Settings saved.");
  };

  const handleReminderToggle = async (next: boolean, onChange: (value: boolean) => void) => {
    onChange(next);
    if (!next) return;
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setNotifPermission(result);
      } else {
        setNotifPermission(Notification.permission);
      }
    }
  };

  const handleExportCalendar = () => {
    const normalized = normalizeReminderSettings(watchedReminders);
    const anyEnabled =
      normalized.windDown.enabled ||
      normalized.checkin.enabled ||
      normalized.reviewDue.enabled;
    if (!anyEnabled) {
      toast.info("Turn on at least one reminder before exporting a calendar file.");
      return;
    }
    const ics = buildRemindersIcs(normalized);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "neurosync-reminders.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Downloaded neurosync-reminders.ics for your calendar app.");
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    const text = await file.text();
    setPendingImportText(text);
    setPendingImportFilename(file.name);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!pendingImportText) return;
    setImporting(true);
    setImportError(null);
    try {
      const summary = await onImportJson(pendingImportText, importMode);
      const totalRows = Object.values(summary.imported).reduce((a, b) => a + b, 0);
      toast.success(`Imported ${totalRows} records (${summary.mode} mode).`);
      setPendingImportText(null);
      setPendingImportFilename("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Import failed; your existing data was untouched.";
      setImportError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const confirmDeleteAll = async () => {
    if (deleteConfirmText.trim() !== "DELETE") return;
    setDeleting(true);
    try {
      await onDeleteAllData();
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      form.reset({
        displayName: "",
        sleepTargetHours: 8,
        focusDefaultMin: 25,
        breakDefaultMin: 5,
        reducedMotion: false,
        highContrast: false,
        textSize: "md",
        reminders: DEFAULT_REMINDER_SETTINGS,
      });
      toast.success("Deleted all local NeuroSync data.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your sleep target, focus defaults, reduced motion preference, and local backup controls."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Preferences form */}
        <Card className="rounded-card border border-border bg-surface p-5 shadow-none sm:p-6 lg:col-span-7">
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6" noValidate>
            <h2 className="text-section font-medium text-foreground">Preferences</h2>

            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Display name (optional)</Label>
              <Input
                id="settings-name"
                placeholder="Used only for the Overview greeting"
                {...form.register("displayName")}
                className="max-w-sm rounded-control border-border bg-surface-2"
              />
              {form.formState.errors.displayName ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.displayName.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-sleep-target">Sleep target (hours per night)</Label>
              <Input
                id="settings-sleep-target"
                type="number"
                step="0.5"
                min={4}
                max={12}
                {...form.register("sleepTargetHours", { valueAsNumber: true })}
                className="w-28 rounded-control border-border bg-surface-2 font-mono text-body tabular-nums"
              />
              {form.formState.errors.sleepTargetHours ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.sleepTargetHours.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
              <Controller
                control={form.control}
                name="breakDefaultMin"
                render={({ field }) => (
                  <DurationInput
                    label="Default break length"
                    valueMin={field.value}
                    onChange={field.onChange}
                    presets={[5, 10, 15]}
                  />
                )}
              />
              {form.formState.errors.breakDefaultMin ? (
                <p role="alert" className="text-caption text-danger">
                  {form.formState.errors.breakDefaultMin.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-section font-medium text-foreground">
                Display &amp; accessibility
              </h2>

              <div className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="settings-reduced-motion" className="text-body font-medium">
                    Reduced motion
                  </Label>
                  <p className="text-caption text-muted-foreground">
                    Prefer minimal transitions inside NeuroSync (system setting is always respected).
                  </p>
                </div>
                <Controller
                  control={form.control}
                  name="reducedMotion"
                  render={({ field }) => (
                    <Switch
                      id="settings-reduced-motion"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="settings-high-contrast" className="text-body font-medium">
                    High-contrast mode
                  </Label>
                  <p className="text-caption text-muted-foreground">
                    Increases text contrast, borders, focus outlines, and 3D brain point contrast.
                  </p>
                </div>
                <Controller
                  control={form.control}
                  name="highContrast"
                  render={({ field }) => (
                    <Switch
                      id="settings-high-contrast"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="space-y-0.5">
                  <span id="settings-text-size-label" className="text-body font-medium text-foreground">
                    Text size
                  </span>
                  <p className="text-caption text-muted-foreground">
                    Scales interface and chart label typography across S, M, and L.
                  </p>
                </div>
                <Controller
                  control={form.control}
                  name="textSize"
                  render={({ field }) => (
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(next) => {
                        if (next === "sm" || next === "md" || next === "lg") {
                          field.onChange(next);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      aria-labelledby="settings-text-size-label"
                    >
                      <ToggleGroupItem value="sm" aria-label="Small text size">
                        S
                      </ToggleGroupItem>
                      <ToggleGroupItem value="md" aria-label="Medium text size">
                        M
                      </ToggleGroupItem>
                      <ToggleGroupItem value="lg" aria-label="Large text size">
                        L
                      </ToggleGroupItem>
                    </ToggleGroup>
                  )}
                />
              </div>
            </div>

            {/* Brain Explorer */}
            <div className="space-y-3 border-t border-border pt-6">
              <h2 className="text-section font-medium text-foreground">
                Brain Explorer
              </h2>

              <div className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="settings-immersive-brain" className="text-body font-medium">
                    Open the Brain Explorer in full-screen mode
                  </Label>
                  <p className="text-caption text-muted-foreground">
                    Launch /brain with a full-viewport 3D canvas (stored in this browser; press Esc or Exit to switch back anytime).
                  </p>
                </div>
                <Switch
                  id="settings-immersive-brain"
                  checked={immersiveBrain}
                  onCheckedChange={(next) => writeBrainImmersivePref(next)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-body font-medium text-foreground">
                    Brain Explorer panel layout
                  </p>
                  <p className="text-caption text-muted-foreground">
                    Restore the floating dock, mode, timeline, quick log, region, and impact panels to their default positions.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetPanelLayout();
                    toast.success("Brain Explorer panel layout reset to defaults.");
                  }}
                  className="rounded-control"
                >
                  Reset layout
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-body font-medium text-foreground">
                    Brain Explorer size
                  </p>
                  <p className="text-caption text-muted-foreground tabular-nums">
                    Current display scale is {brainSize.toFixed(1)}× (default 1.0×).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    writeBrainSizePref(DEFAULT_BRAIN_SIZE);
                    toast.success("Brain Explorer size reset to 1.0×.");
                  }}
                  className="rounded-control"
                >
                  Reset size
                </Button>
              </div>
            </div>

            {/* Reminders */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-cyan" aria-hidden />
                  <h2 className="text-section font-medium text-foreground">Reminders</h2>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {notifPermission === "granted"
                    ? "Browser notifications allowed"
                    : notifPermission === "denied"
                      ? "Browser notifications blocked (in-app active)"
                      : notifPermission === "unsupported"
                        ? "In-app reminders active"
                        : "Permission asked only on toggle"}
                </span>
              </div>

              <p className="rounded-control border border-border bg-surface-2 p-3 text-caption leading-relaxed text-muted-foreground">
                Because NeuroSync runs locally with no push server, browser notifications can only
                fire while the app is open or recently active—not reliably when fully closed. For
                guaranteed alerts, export a recurring calendar file (.ics) below.
              </p>

              {(
                [
                  {
                    key: "windDown",
                    label: "Wind-down",
                    hint: "Gentle evening cue to step away from bright work.",
                  },
                  {
                    key: "checkin",
                    label: "Daily check-in",
                    hint: "Low-pressure prompt to note mood, energy, and focus.",
                  },
                  {
                    key: "reviewDue",
                    label: "Review due",
                    hint: "Fires when topics are due in your Focus Lab review queue.",
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <Label
                      htmlFor={`reminder-${item.key}-toggle`}
                      className="text-body font-medium"
                    >
                      {item.label}
                    </Label>
                    <p className="text-caption text-muted-foreground">{item.hint}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      aria-label={`${item.label} time`}
                      {...form.register(`reminders.${item.key}.time`)}
                      className="h-9 w-28 rounded-control border-border bg-surface font-mono text-caption tabular-nums"
                    />
                    <Controller
                      control={form.control}
                      name={`reminders.${item.key}.enabled`}
                      render={({ field }) => (
                        <Switch
                          id={`reminder-${item.key}-toggle`}
                          checked={field.value}
                          onCheckedChange={(next) => void handleReminderToggle(next, field.onChange)}
                        />
                      )}
                    />
                  </div>
                </div>
              ))}

              {/* Quiet hours */}
              <div className="space-y-3 rounded-control border border-border bg-surface-2 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="reminder-quiet-toggle" className="text-body font-medium">
                      Quiet hours
                    </Label>
                    <p className="text-caption text-muted-foreground">
                      Silence in-app and browser reminders during these local hours.
                    </p>
                  </div>
                  <Controller
                    control={form.control}
                    name="reminders.quietHours.enabled"
                    render={({ field }) => (
                      <Switch
                        id="reminder-quiet-toggle"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="reminder-quiet-start"
                      className="text-caption text-muted-foreground"
                    >
                      From
                    </Label>
                    <Input
                      id="reminder-quiet-start"
                      type="time"
                      {...form.register("reminders.quietHours.start")}
                      className="h-9 w-28 rounded-control border-border bg-surface font-mono text-caption tabular-nums"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="reminder-quiet-end"
                      className="text-caption text-muted-foreground"
                    >
                      To
                    </Label>
                    <Input
                      id="reminder-quiet-end"
                      type="time"
                      {...form.register("reminders.quietHours.end")}
                      className="h-9 w-28 rounded-control border-border bg-surface font-mono text-caption tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCalendar}
                  disabled={
                    !watchedReminders?.windDown?.enabled &&
                    !watchedReminders?.checkin?.enabled &&
                    !watchedReminders?.reviewDue?.enabled
                  }
                  className="gap-1.5 rounded-control"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  Add to calendar (.ics)
                </Button>
                <span className="text-caption text-muted-foreground">
                  Remember to click Save settings below to store changes.
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="rounded-control bg-violet text-white hover:bg-violet/90"
              >
                Save settings
              </Button>
            </div>
          </form>
        </Card>

        {/* Backup & Privacy */}
        <div className="space-y-5 lg:col-span-5">
          <Card className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-none sm:p-6">
            <h2 className="text-section font-medium text-foreground">Backup & restore</h2>

            <p className="rounded-control border border-border bg-surface-2 p-3 text-caption leading-relaxed text-muted-foreground">
              Data — including your journal entries, gratitude notes, and mindfulness sessions —
              lives only in this browser (IndexedDB), is{" "}
              <strong className="font-medium text-foreground">not encrypted</strong> on your
              device, and is included in JSON exports. Export a backup anytime to keep a copy or
              move between devices.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await onExportJson();
                  toast.success("Downloaded JSON backup.");
                }}
                className="gap-1.5 rounded-control"
              >
                <Download className="size-4" aria-hidden />
                Export JSON
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 rounded-control"
              >
                <Upload className="size-4" aria-hidden />
                Import JSON
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Choose NeuroSync JSON backup file"
                className="sr-only"
                onChange={(e) => void handleFileChange(e.target.files?.[0])}
              />
            </div>

            {importError ? (
              <p role="alert" className="text-caption text-danger">
                {importError}
              </p>
            ) : null}
          </Card>

          <Card className="space-y-4 rounded-card border border-danger/30 bg-surface p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-danger" aria-hidden />
              <h2 className="text-section font-medium text-foreground">Delete local data</h2>
            </div>
            <p className="text-caption text-muted-foreground">
              Permanently removes all check-ins, sleep logs, focus sessions, habits, mindfulness
              sessions, journal entries, gratitude notes, activity logs, review queue items, and
              experiments from this browser. This cannot be undone unless you exported a JSON
              backup.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteDialogOpen(true);
              }}
              className="gap-1.5 rounded-control"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete all my data
            </Button>
          </Card>
        </div>
      </div>

      {/* Import confirmation dialog */}
      <Dialog
        open={pendingImportText !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingImportText(null);
            setPendingImportFilename("");
          }
        }}
      >
        <DialogContent className="border-border bg-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm JSON import</DialogTitle>
            <DialogDescription>
              File: <span className="font-mono text-foreground">{pendingImportFilename}</span>. The
              entire file is validated before anything is written.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3" role="radiogroup" aria-label="Import mode">
            <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface-2 p-3">
              <input
                type="radio"
                name="import-mode"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
                className="mt-1"
              />
              <div>
                <p className="text-body font-medium text-foreground">Merge with existing data</p>
                <p className="text-caption text-muted-foreground">
                  Keeps current rows and updates or adds rows from the backup.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface-2 p-3">
              <input
                type="radio"
                name="import-mode"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
                className="mt-1"
              />
              <div>
                <p className="text-body font-medium text-foreground">Replace all existing data</p>
                <p className="text-caption text-muted-foreground">
                  Clears current local tables first, then restores only the backup.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingImportText(null)}
              className="rounded-control"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={importing}
              onClick={confirmImport}
              className="rounded-control bg-violet text-white hover:bg-violet/90"
            >
              {importing ? "Importing..." : "Confirm import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete all confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-border bg-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete all local data?</DialogTitle>
            <DialogDescription>
              Type <span className="font-mono text-foreground">DELETE</span> below to confirm
              wiping all local NeuroSync tables in this browser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm-input">Confirmation</Label>
            <Input
              id="delete-confirm-input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
              className="rounded-control border-border bg-surface-2 font-mono"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-control"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirmText.trim() !== "DELETE" || deleting}
              onClick={confirmDeleteAll}
              className="rounded-control"
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-36 rounded-[6px]" />
        <Skeleton className="h-4 w-96 max-w-full rounded-[4px]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[460px] rounded-card lg:col-span-7" />
        <Skeleton className="h-[340px] rounded-card lg:col-span-5" />
      </div>
    </div>
  );
}
