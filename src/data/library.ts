import type { RegionId } from "@/types/domain";

export interface LibraryEntry {
  id: string;
  title: string;
  summary: string;
  body: string;
  readingMinutes: number;
  tags: string[];
  regions: RegionId[];
}

/**
 * Static educational reading. Kept separate from user data and deliberately
 * careful: associations only, never claims about an individual's brain.
 */
export const LIBRARY_ENTRIES: LibraryEntry[] = [
  {
    id: "how-to-read-a-brain-region",
    title: "How to read a brain region page",
    summary:
      "Brain maps describe where something is often involved, not what it does on its own.",
    body: "Regions are convenient labels for clusters of tissue. Almost every everyday task involves many areas working together, and imaging studies usually report group averages rather than one person's brain. When NeuroSync says a region is associated with an activity, read that as background context for learning the anatomy, not as a claim about what happened in your head.",
    readingMinutes: 3,
    tags: ["basics", "evidence"],
    regions: [],
  },
  {
    id: "sleep-and-memory",
    title: "What is known about sleep and memory",
    summary:
      "Sleep is studied alongside memory consolidation; the honest summary is 'associated with', not 'causes'.",
    body: "Many studies find that people remember material better after a normal night of sleep than after a short one, and some experiments link specific sleep stages to consolidation. These are group findings with real variation between people, and they do not tell you what your own brain did last night. Recording your sleep is useful because it gives you something concrete to compare against your own focus and mood, not because it measures consolidation.",
    readingMinutes: 4,
    tags: ["sleep", "memory"],
    regions: ["hippocampus"],
  },
  {
    id: "why-personal-experiments",
    title: "Why run a personal experiment",
    summary:
      "A small structured comparison of your own days is more useful than a generalisation borrowed from someone else.",
    body: "Most advice is an average. A personal experiment gives a baseline window and an intervention window so you can look at your own check-ins before and after a change. It is not a clinical trial: sample sizes are tiny, the seasons change, and you are not blind. That is why NeuroSync shows your numbers with a caveat instead of a conclusion.",
    readingMinutes: 3,
    tags: ["experiments", "method"],
    regions: [],
  },
];

export function getLibraryEntry(id: string): LibraryEntry | undefined {
  return LIBRARY_ENTRIES.find((entry) => entry.id === id);
}
