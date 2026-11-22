"use client";

import { CalendarClock, Info } from "lucide-react";
import { CALENDAR_PROVIDER_DIRECTORY } from "@/features/calendar/localProvider";

/**
 * Placeholder section required by the v0.4 spec. No network, no OAuth, no keys:
 * it documents the provider boundary a Google integration will plug into.
 */
export function CalendarsSection() {
  return (
    <section aria-labelledby="settings-calendars" className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-cyan" aria-hidden />
        <h2 id="settings-calendars" className="text-section font-medium text-foreground">
          Calendars
        </h2>
      </div>
      <p className="text-caption text-muted-foreground">
        Integrations are planned. Today the planner reads and writes calendar data only through local providers, and no
        request ever leaves this device.
      </p>
      <ul className="space-y-2">
        {CALENDAR_PROVIDER_DIRECTORY.map((provider) => (
          <li
            key={provider.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-3"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-body font-medium text-foreground">{provider.name}</p>
              <p className="text-caption text-muted-foreground">{provider.detail}</p>
            </div>
            <span className="shrink-0 rounded-chip border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {provider.status === "available" ? "Available" : "Planned"}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-start gap-2 rounded-control border border-border bg-surface-2 p-3 text-caption text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-cyan" aria-hidden />
        <p>
          Export your plan from <span className="text-foreground">Planner → Export day / Export week</span>, and import a
          calendar file from <span className="text-foreground">Planner → Day plan</span>. Imported windows are read-only
          and loaded for that visit only.
        </p>
      </div>
    </section>
  );
}
