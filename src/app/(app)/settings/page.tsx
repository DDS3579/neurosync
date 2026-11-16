"use client";

import { useCallback } from "react";
import { format } from "date-fns";

import {
  SettingsSkeleton,
  SettingsWorkspace,
} from "@/features/settings/components/SettingsWorkspace";
import { FOCUS_STORAGE_KEY } from "@/features/focus/timerUtils";
import { HABITS_SEEDED_KEY } from "@/features/habits/habitUtils";
import { exportAll, importAll, type BackupMode } from "@/lib/db/backup";
import { useSettings } from "@/lib/db/hooks";
import { settingsRepository } from "@/lib/db/repositories";

export default function SettingsPage() {
  const settings = useSettings();

  const onSaveSettings = useCallback(
    async (patch: {
      displayName?: string;
      sleepTargetMin: number;
      focusDefaultMin: number;
      breakDefaultMin: number;
      reducedMotion: boolean;
    }) => {
      await settingsRepository.save(patch);
    },
    [],
  );

  const onExportJson = useCallback(async () => {
    const blob = await exportAll();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurosync-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const onImportJson = useCallback(
    (text: string, mode: BackupMode) => importAll(text, mode),
    [],
  );

  const schemaVersion = settings.data?.schemaVersion ?? 1;

  const onDeleteAllData = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;
    await importAll(
      JSON.stringify({
        schemaVersion,
        exportedAt: new Date().toISOString(),
        tables: {
          settings: [],
          sleepLogs: [],
          checkins: [],
          focusSessions: [],
          movementLogs: [],
          nutritionLogs: [],
          habits: [],
          habitLogs: [],
          experiments: [],
        },
      }),
      "replace",
    );
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FOCUS_STORAGE_KEY);
      window.localStorage.removeItem(HABITS_SEEDED_KEY);
    }
    await settingsRepository.ensure();
  }, [schemaVersion]);

  if (settings.isLoading || !settings.data) {
    return <SettingsSkeleton />;
  }

  return (
    <SettingsWorkspace
      settings={settings.data}
      onSaveSettings={onSaveSettings}
      onExportJson={onExportJson}
      onImportJson={onImportJson}
      onDeleteAllData={onDeleteAllData}
    />
  );
}
