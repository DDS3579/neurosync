"use client";

import { useState } from "react";
import { Brain, Moon, Timer, Waves } from "lucide-react";

import {
  ChartCard,
  DurationInput,
  EmptyState,
  InsightCard,
  PageHeader,
  RatingInput,
  RegionBadge,
  StatCard,
} from "@/components/nx";
import { Button } from "@/components/ui/button";
import { BRAIN_REGIONS } from "@/data/brainRegions";
import type { Insight, Rating, RegionId } from "@/types/domain";

const SAMPLE_INSIGHT: Insight = {
  id: "dev-insight-1",
  pillar: "sleep",
  kind: "observation",
  title: "Your focus sessions ran longer on nights you logged 7h or more",
  body: "Across the last three weeks, sessions that followed a logged night of at least seven hours averaged 38 minutes, compared with 24 minutes after shorter nights.",
  evidence: ["7 nights ≥ 7h", "12 nights < 7h", "38 min vs 24 min"],
  caveat:
    "This describes the days you logged. Sleep, workload, and motivation affect each other, so this cannot show that sleep caused the longer sessions.",
  education:
    "Sleep is studied alongside attention and memory consolidation. Many studies report group averages, which is why the atlas talks about associations rather than measurements.",
  regions: ["hippocampus", "prefrontal"],
};

const MINIMAL_INSIGHT: Insight = {
  id: "dev-insight-2",
  pillar: "movement",
  kind: "reflection",
  title: "Two walks were logged this week",
  body: "Both were short and both happened after lunch.",
  evidence: [],
  caveat: "A quiet week of logging is still information, not a shortfall.",
};

const WEEK_BARS = [42, 68, 35, 80, 55, 72, 90];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const ALL_REGIONS: RegionId[] = BRAIN_REGIONS.map((region) => region.id);

export default function DevUiClient() {
  const [rating, setRating] = useState<Rating | undefined>(4);
  const [emptyRating, setEmptyRating] = useState<Rating | undefined>(undefined);
  const [duration, setDuration] = useState(25);

  return (
    <div className="space-y-10">
      <PageHeader
        title="UI foundation"
        description="Every shared primitive, in its normal and empty states. Sample numbers are illustrative only."
        actions={<Button variant="outline" className="rounded-control">Secondary action</Button>}
      />

      <section className="space-y-4">
        <h2 className="text-section font-medium text-foreground">Stats</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sleep last night"
            value="7.3"
            unit="h"
            delta={{ value: 0.4, direction: "up", label: "vs 7-day avg" }}
            hint="Reference: adults 7h+"
            icon={<Moon />}
            accent="cyan"
          />
          <StatCard
            label="Focus this week"
            value="4:25"
            unit="h:m"
            delta={{ value: 12, direction: "down", label: "vs last week" }}
            hint="9 sessions logged"
            icon={<Timer />}
            accent="violet"
          />
          <StatCard
            label="Mood"
            value="3.8"
            unit="/5"
            delta={{ value: 0, direction: "flat", label: "unchanged" }}
            icon={<Waves />}
          />
          <StatCard label="Nights logged" value="6" unit="nights" hint="One night left blank" accent="neutral" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section font-medium text-foreground">Charts</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Focus minutes per day"
            description="Planned versus actual, this week"
            footer="Bars show minutes logged; colour marks information, not a verdict."
          >
            <div className="flex h-40 items-end gap-3" aria-hidden>
              {WEEK_BARS.map((value, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-[4px] bg-cyan/70"
                    style={{ height: `${value}%` }}
                  />
                  <span className="font-mono text-caption text-muted-foreground">
                    {DAY_LABELS[index]}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Sleep duration"
            description="No nights logged yet"
            empty
            emptyMessage="Log a night to see duration here. Nothing is inferred while the week is empty."
            footer="Reference ranges are a guide, never a verdict."
          >
            <div />
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section font-medium text-foreground">Empty states</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={<Brain />}
            title="No insights yet"
            description="Observations appear once a few days have data, and they always describe patterns rather than causes."
            action={<Button variant="outline" className="rounded-control">Open the atlas</Button>}
          />
          <EmptyState
            title="No experiments running"
            description="Start a baseline window when you are ready — nothing is due and nothing is overdue."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section font-medium text-foreground">Inputs</h2>
        <div className="grid gap-6 rounded-card border border-border bg-surface p-4 lg:grid-cols-2">
          <div className="space-y-6">
            <RatingInput
              label="How rested do you feel?"
              value={rating}
              onChange={setRating}
              lowLabel="Drained"
              highLabel="Rested"
            />
            <RatingInput
              label="Mood (empty state)"
              value={emptyRating}
              onChange={setEmptyRating}
              lowLabel="Low"
              highLabel="Bright"
            />
          </div>

          <div className="space-y-6">
            <DurationInput label="Focus length" valueMin={duration} onChange={setDuration} />
            <DurationInput
              label="Break length"
              valueMin={5}
              onChange={() => undefined}
              presets={[5, 10, 15]}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section font-medium text-foreground">Insights</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <InsightCard insight={SAMPLE_INSIGHT} />
          <InsightCard insight={MINIMAL_INSIGHT} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-section font-medium text-foreground">Region chips</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_REGIONS.map((region) => (
            <RegionBadge key={region} region={region} />
          ))}
        </div>
      </section>
    </div>
  );
}
