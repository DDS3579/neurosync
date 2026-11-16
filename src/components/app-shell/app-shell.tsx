"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppTopbar } from "@/components/app-shell/app-topbar";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { QuickLogSheet } from "@/components/app-shell/quick-log-sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const COLLAPSED_KEY = "nx:sidebar-collapsed";
const COLLAPSED_EVENT = "nx:sidebar-collapsed-change";

function subscribeCollapsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(COLLAPSED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(COLLAPSED_EVENT, callback);
  };
}

function getCollapsedSnapshot(): boolean {
  return window.localStorage.getItem(COLLAPSED_KEY) !== "1";
}

const QUICK_LOG_TARGETS = [
  { href: "/habits", label: "Check-in and sleep", hint: "Last night's rest and how today feels" },
  { href: "/focus", label: "Focus session", hint: "Planned versus actual minutes" },
  { href: "/habits#habits", label: "Habits and movement", hint: "Daily habits, movement, food and water" },
];

function QuickLogContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {QUICK_LOG_TARGETS.map((target) => (
        <li key={target.href}>
          <Link
            href={target.href}
            onClick={onNavigate}
            className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-2 px-4 py-3 transition-colors duration-[180ms] ease-out hover:border-border-strong"
          >
            <span className="min-w-0">
              <span className="block text-body font-medium text-foreground">{target.label}</span>
              <span className="block text-caption text-muted-foreground">{target.hint}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const open = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, () => true);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const handleOpenChange = useCallback((next: boolean) => {
    window.localStorage.setItem(COLLAPSED_KEY, next ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
  }, []);

  const openQuickLog = useCallback(() => setQuickLogOpen(true), []);

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <AppSidebar />

      <SidebarInset>
        <AppTopbar
          onOpenQuickLog={openQuickLog}
          onOpenCommand={() => setCommandOpen(true)}
        />
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pb-10">
          {children}
        </div>
      </SidebarInset>

      <MobileNav onQuickLog={openQuickLog} />

      <QuickLogSheet open={quickLogOpen} onOpenChange={setQuickLogOpen}>
        <QuickLogContent onNavigate={() => setQuickLogOpen(false)} />
      </QuickLogSheet>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onQuickLog={openQuickLog}
      />
    </SidebarProvider>
  );
}
