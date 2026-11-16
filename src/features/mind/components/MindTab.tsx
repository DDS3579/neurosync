"use client";

import type { GratitudeEntry, JournalEntry, MindfulnessSession } from "@/types/domain";

import { BreathingMeditationCard } from "./BreathingMeditationCard";
import { GratitudeSection } from "./GratitudeSection";
import { JournalSection } from "./JournalSection";

export interface MindTabProps {
  mindfulnessSessions: MindfulnessSession[];
  journalEntries: JournalEntry[];
  gratitudeEntries: GratitudeEntry[];
  onCreateMindfulness: (
    values: Omit<MindfulnessSession, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteMindfulness: (id: string) => Promise<void>;
  onCreateJournal: (
    values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateJournal: (
    id: string,
    values: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onDeleteJournal: (id: string) => Promise<void>;
  onSaveGratitude: (
    values: Omit<GratitudeEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<"created" | "updated">;
  onDeleteGratitude: (id: string) => Promise<void>;
}

export function MindTab({
  mindfulnessSessions,
  journalEntries,
  gratitudeEntries,
  onCreateMindfulness,
  onDeleteMindfulness,
  onCreateJournal,
  onUpdateJournal,
  onDeleteJournal,
  onSaveGratitude,
  onDeleteGratitude,
}: MindTabProps) {
  return (
    <div className="space-y-8">
      <BreathingMeditationCard
        sessions={mindfulnessSessions}
        onCreateSession={onCreateMindfulness}
        onDeleteSession={onDeleteMindfulness}
      />
      <JournalSection
        entries={journalEntries}
        onCreateEntry={onCreateJournal}
        onUpdateEntry={onUpdateJournal}
        onDeleteEntry={onDeleteJournal}
      />
      <GratitudeSection
        entries={gratitudeEntries}
        onSaveEntry={onSaveGratitude}
        onDeleteEntry={onDeleteGratitude}
      />
    </div>
  );
}
