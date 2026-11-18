"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Brain,
  Clock,
  Command as CommandIcon,
  Compass,
  LayoutGrid,
  Minimize2,
  PlusCircle,
  SlidersHorizontal,
} from "lucide-react";

import { ALL_NAV_ITEMS, isActiveRoute } from "@/components/app-shell/nav-items";
import { FloatingPanel, FloatingPanelLayer, resetPanelLayout } from "@/components/floating";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BrainImmersivePanelsProps {
  onExitImmersive: () => void;
  onOpenCommandPalette: () => void;
  modeContent: ReactNode;
  regionContent: ReactNode;
  impactContent: ReactNode;
  timelineContent: ReactNode;
  quickLogContent?: ReactNode;
}

/**
 * Immersive /brain floating workspace:
 * - Navigation Dock (top-left, collapsed to icons by default)
 * - Quick Log (top-left under dock, collapsed by default)
 * - Modes & Controls (bottom-left on desktop, collapsed <1024px)
 * - Time Scrubber (bottom-center, slim, collapsible)
 * - Region Details (top-right on desktop, collapsed <1024px)
 * - Activity Impact (bottom-right on desktop, collapsed <1024px)
 * On mobile (<768px), FloatingPanelLayer renders them as a bottom chip row + single-open sheet.
 */
export function BrainImmersivePanels({
  onExitImmersive,
  onOpenCommandPalette,
  modeContent,
  regionContent,
  impactContent,
  timelineContent,
  quickLogContent,
}: BrainImmersivePanelsProps) {
  const pathname = usePathname();

  const collapsedNavIcons = (
    <nav aria-label="Quick navigation" className="flex items-center gap-0.5">
      {ALL_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-panel-action="true"
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "bg-violet/25 text-violet-text ring-1 ring-violet/50"
                : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </Link>
        );
      })}
      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
      <button
        type="button"
        data-panel-action="true"
        onClick={onOpenCommandPalette}
        aria-label="Open command palette (Ctrl+K)"
        title="Command palette (Ctrl/⌘+K)"
        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <CommandIcon className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        data-panel-action="true"
        onClick={onExitImmersive}
        aria-label="Exit immersive mode"
        title="Exit immersive (Esc)"
        className="inline-flex size-7 items-center justify-center rounded-full text-cyan transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Minimize2 className="size-3.5" aria-hidden />
      </button>
    </nav>
  );

  return (
    <FloatingPanelLayer>
      <FloatingPanel
        id="brain-nav-dock"
        title="Navigation"
        chipLabel="Nav"
        icon={<Compass className="size-3.5" aria-hidden />}
        defaultPosition={{ x: 16, y: 16 }}
        defaultSize={{ width: 248 }}
        defaultCollapsed
        collapsedContent={collapsedNavIcons}
      >
        <div className="space-y-3">
          <nav aria-label="Brain Explorer navigation" className="space-y-1">
            {ALL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-caption transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-violet/20 font-medium text-violet-text ring-1 ring-violet/40"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-1.5 border-t border-border pt-2.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenCommandPalette}
              className="w-full justify-between rounded-control text-caption"
            >
              <span className="inline-flex items-center gap-1.5">
                <CommandIcon className="size-3.5 text-cyan" aria-hidden />
                Command palette
              </span>
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Ctrl+K
              </kbd>
            </Button>

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => resetPanelLayout()}
                className="gap-1 rounded-control px-2 text-caption"
              >
                <LayoutGrid className="size-3.5 text-muted-foreground" aria-hidden />
                Reset layout
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onExitImmersive}
                aria-label="Exit immersive mode"
                className="gap-1 rounded-control px-2 text-caption"
              >
                <Minimize2 className="size-3.5 text-cyan" aria-hidden />
                Exit
              </Button>
            </div>
          </div>
        </div>
      </FloatingPanel>

      {quickLogContent ? (
        <FloatingPanel
          id="brain-quick-log"
          title="Quick Log"
          chipLabel="Log"
          icon={<PlusCircle className="size-3.5" aria-hidden />}
          defaultPosition={{ x: 16, y: 72 }}
          defaultSize={{ width: 312 }}
          defaultCollapsed
        >
          {quickLogContent}
        </FloatingPanel>
      ) : null}

      <FloatingPanel
        id="brain-mode-panel"
        title="Modes & Controls"
        chipLabel="Modes"
        icon={<SlidersHorizontal className="size-3.5" aria-hidden />}
        defaultPosition={{ x: 16, y: 460 }}
        resolveDefaultPosition={(vp, size) => ({
          x: 16,
          y: Math.max(120, vp.height - Math.max(size.height, 360) - 16),
        })}
        defaultSize={{ width: 332 }}
        defaultCollapsed={(vp) => vp.width < 1024}
        resizable
      >
        {modeContent}
      </FloatingPanel>

      <FloatingPanel
        id="brain-time-scrubber"
        title="Timeline"
        chipLabel="Time"
        icon={<Clock className="size-3.5" aria-hidden />}
        defaultPosition={{ x: 460, y: 740 }}
        resolveDefaultPosition={(vp, size) => ({
          x: Math.max(16, Math.round((vp.width - size.width) / 2)),
          y: Math.max(16, vp.height - Math.max(size.height, 140) - 16),
        })}
        defaultSize={{ width: 396 }}
        defaultCollapsed={(vp) => vp.width < 1024}
      >
        {timelineContent}
      </FloatingPanel>

      <FloatingPanel
        id="brain-region-panel"
        title="Region Details"
        chipLabel="Region"
        icon={<Brain className="size-3.5" aria-hidden />}
        defaultPosition={{ x: 1068, y: 16 }}
        resolveDefaultPosition={(vp, size) => ({
          x: Math.max(16, vp.width - size.width - 16),
          y: 16,
        })}
        defaultSize={{ width: 356, height: 420 }}
        defaultCollapsed={(vp) => vp.width < 1024}
        resizable
      >
        {regionContent}
      </FloatingPanel>

      <FloatingPanel
        id="brain-impact-panel"
        title="Activity Impact"
        chipLabel="Impact"
        icon={<Activity className="size-3.5" aria-hidden />}
        defaultPosition={{ x: 1068, y: 540 }}
        resolveDefaultPosition={(vp, size) => ({
          x: Math.max(16, vp.width - size.width - 16),
          y: Math.max(16, vp.height - Math.max(size.height, 340) - 16),
        })}
        defaultSize={{ width: 356, height: 340 }}
        defaultCollapsed={(vp) => vp.width < 1024}
        resizable
      >
        {impactContent}
      </FloatingPanel>
    </FloatingPanelLayer>
  );
}
