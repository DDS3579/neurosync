"use client";

import { useState } from "react";

import { PageHeader } from "@/components/nx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BRAIN_REGIONS } from "@/data/brainRegions";
import BrainExplorer from "@/features/brain";
import type { BrainMode } from "@/features/brain/regionZones";
import type { ActivityKind, RegionId } from "@/types/domain";

const MODES: { value: BrainMode; label: string }[] = [
  { value: "anatomy", label: "Anatomy" },
  { value: "functional", label: "Functional" },
  { value: "activity", label: "Activity" },
];

const SAMPLE_ACTIVITY: { kind: ActivityKind; minutes: number }[] = [
  { kind: "deep_focus", minutes: 90 },
  { kind: "active_recall", minutes: 45 },
  { kind: "exercise", minutes: 30 },
  { kind: "sleep_rest", minutes: 480 },
];

export default function DevBrainPage() {
  const [mode, setMode] = useState<BrainMode>("anatomy");
  const [selectedRegion, setSelectedRegion] = useState<RegionId | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionId | null>(null);
  const [activity, setActivity] = useState<Partial<Record<RegionId, number>>>({});

  const setRegionActivity = (id: RegionId, next: number) => {
    setActivity((current) => ({ ...current, [id]: next }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dev · Brain explorer"
        description="Temporary harness for the 3D atlas: mode switching, region selection, and per-region activity intensity."
      />

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value) setMode(value as BrainMode);
          }}
          variant="outline"
          size="sm"
        >
          {MODES.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button size="sm" variant="outline" onClick={() => setActivity({})}>
          Clear activity
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>mode: <span className="font-mono text-foreground">{mode}</span></span>
        <span aria-hidden>·</span>
        <span>
          selected:{" "}
          <span className="font-mono text-foreground">{selectedRegion ?? "none"}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          hovered:{" "}
          <span className="font-mono text-foreground">{hoveredRegion ?? "none"}</span>
        </span>
        <span aria-hidden>·</span>
        <span>Esc clears the selection</span>
      </div>

      <BrainExplorer
        mode={mode}
        selectedRegion={selectedRegion}
        activity={activity}
        onSelectRegion={setSelectedRegion}
        onHoverRegion={setHoveredRegion}
        quality="auto"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Region selection</p>
          <div className="flex flex-wrap gap-1.5">
            {BRAIN_REGIONS.map((region) => {
              const isSelected = selectedRegion === region.id;
              return (
                <Button
                  key={region.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedRegion(isSelected ? null : region.id)}
                >
                  {region.name}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Activity intensity (0–1)</p>
          {BRAIN_REGIONS.map((region) => {
            const value = Math.round((activity[region.id] ?? 0) * 100);
            return (
              <div key={region.id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">
                  {region.name}
                </span>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[value]}
                  onValueChange={(next) => setRegionActivity(region.id, (next[0] ?? 0) / 100)}
                  aria-label={`${region.name} activity`}
                />
                <Badge variant="outline" className="w-12 justify-center font-mono tabular-nums">
                  {value}%
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Sample activity used while wiring real logs:{" "}
        {SAMPLE_ACTIVITY.map((item) => `${item.kind} ${item.minutes}m`).join(", ")} — associations
        only, never a measurement.
      </p>
    </div>
  );
}
