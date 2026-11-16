"use client";

import { useRouter } from "next/navigation";

import { OverviewSkeleton, OverviewView } from "@/features/overview/OverviewView";
import type { Insight } from "@/types/domain";

const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: "dev-overview-1",
    pillar: "sleep",
    kind: "observation",
    title: "Focus ran longer after fuller nights",
    body: "On the four days after seven hours or more, focus sessions averaged 41 minutes, compared with 26 minutes on the other days.",
    evidence: ["4 nights ≥ 7h", "3 nights < 7h", "41 min vs 26 min"],
    caveat:
      "This compares the days you logged. Workload and motivation move together with sleep, so it cannot show that one caused the other.",
    education:
      "Attention and memory consolidation are studied alongside sleep. Findings are usually group averages, which is why this stays an association.",
    regions: ["hippocampus", "prefrontal"],
  },
  {
    id: "dev-overview-2",
    pillar: "movement",
    kind: "milestone",
    title: "Walks landed on your steadiest mood days",
    body: "The two days with a walk after lunch also had your highest concentration ratings this week.",
    evidence: ["2 walks", "concentration 4/5"],
    caveat: "Two days is a small sample and both were weekdays.",
    regions: ["cerebellum"],
  },
  {
    id: "dev-overview-3",
    pillar: "wellbeing",
    kind: "reflection",
    title: "Mondays were the quietest check-ins",
    body: "Mood was logged on five days; the two lowest ratings both fell on a Monday.",
    evidence: ["5 check-ins", "Mondays: 2/5 and 2/5"],
    caveat: "Five entries is too few to call this a pattern yet.",
  },
];

const TODAY = { checkinDone: true, sleepLogged: true, focusMinutes: 75, movementMinutes: 30 };

const SLEEP_WEEK = [
  { date: "2026-11-10", hours: 7.4 },
  { date: "2026-11-11", hours: 6.2 },
  { date: "2026-11-12", hours: null },
  { date: "2026-11-13", hours: 7.9 },
  { date: "2026-11-14", hours: 5.8 },
  { date: "2026-11-15", hours: 8.1 },
  { date: "2026-11-16", hours: 7.2 },
];

const FOCUS_WEEK = [
  { date: "2026-11-10", minutes: 50 },
  { date: "2026-11-11", minutes: 25 },
  { date: "2026-11-12", minutes: 0 },
  { date: "2026-11-13", minutes: 75 },
  { date: "2026-11-14", minutes: 40 },
  { date: "2026-11-15", minutes: 90 },
  { date: "2026-11-16", minutes: 75 },
];

const MOOD_WEEK = [
  { date: "2026-11-10", mood: 3, concentration: 4 },
  { date: "2026-11-11", mood: 2, concentration: 2 },
  { date: "2026-11-12", mood: null, concentration: null },
  { date: "2026-11-13", mood: 4, concentration: 4 },
  { date: "2026-11-14", mood: 5, concentration: 3 },
  { date: "2026-11-15", mood: 4, concentration: 5 },
  { date: "2026-11-16", mood: 3, concentration: 3 },
];

const BRAIN_ACTIVITY = {
  prefrontal: 0.7,
  hippocampus: 0.55,
  parietal: 0.35,
  cerebellum: 0.3,
} as const;

export default function DevOverviewPage() {
  const router = useRouter();

  return (
    <div className="space-y-10">
      <OverviewView
        greetingName="Sam"
        today={TODAY}
        sleepWeek={SLEEP_WEEK}
        sleepTargetHours={8}
        focusWeek={FOCUS_WEEK}
        moodWeek={MOOD_WEEK}
        insights={SAMPLE_INSIGHTS}
        brainActivity={BRAIN_ACTIVITY}
        isEmpty={false}
        onLogToday={() => undefined}
        onLoadDemo={() => undefined}
        onOpenBrain={() => router.push("/brain")}
      />

      <section className="space-y-3">
        <h2 className="text-section font-medium text-foreground">Empty week</h2>
        <OverviewView
          today={TODAY}
          sleepWeek={[]}
          sleepTargetHours={8}
          focusWeek={[]}
          moodWeek={[]}
          insights={[]}
          brainActivity={{}}
          isEmpty={false}
          onLogToday={() => undefined}
          onOpenBrain={() => router.push("/brain")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-section font-medium text-foreground">Nothing logged (isEmpty)</h2>
        <OverviewView
          today={TODAY}
          sleepWeek={[]}
          sleepTargetHours={8}
          focusWeek={[]}
          moodWeek={[]}
          insights={[]}
          brainActivity={{}}
          isEmpty
          onLogToday={() => undefined}
          onLoadDemo={() => undefined}
          onOpenBrain={() => router.push("/brain")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-section font-medium text-foreground">Loading</h2>
        <OverviewSkeleton />
      </section>
    </div>
  );
}
