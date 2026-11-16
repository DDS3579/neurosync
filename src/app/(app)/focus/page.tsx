"use client";

import { useCallback } from "react";

import { FocusSkeleton, FocusWorkspace } from "@/features/focus/components/FocusWorkspace";
import { useFocusSessions, useSettings } from "@/lib/db/hooks";
import { focusRepository } from "@/lib/db/repositories";
import type { FocusSession } from "@/types/domain";

export default function FocusPage() {
  const settings = useSettings();
  const focus = useFocusSessions();

  const onCreateSession = useCallback(
    async (values: Omit<FocusSession, "id" | "createdAt" | "updatedAt">) => {
      await focusRepository.create(values);
    },
    [],
  );

  const onDeleteSession = useCallback((id: string) => focusRepository.remove(id), []);

  if (settings.isLoading || focus.isLoading || !settings.data || !focus.data) {
    return <FocusSkeleton />;
  }

  return (
    <FocusWorkspace
      defaultFocusMin={settings.data.focusDefaultMin}
      sessions={focus.data}
      onCreateSession={onCreateSession}
      onDeleteSession={onDeleteSession}
    />
  );
}
