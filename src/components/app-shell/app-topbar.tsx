"use client";

import { usePathname } from "next/navigation";
import { CommandIcon, Plus } from "lucide-react";

import { routeTitle } from "@/components/app-shell/nav-items";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export interface AppTopbarProps {
  onOpenQuickLog: () => void;
  onOpenCommand: () => void;
}

export function AppTopbar({ onOpenQuickLog, onOpenCommand }: AppTopbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <SidebarTrigger className="hidden md:inline-flex" />

      <p className="min-w-0 truncate text-section font-medium text-foreground">
        {routeTitle(pathname)}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenCommand}
          className="hidden gap-1.5 rounded-control text-caption text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          <CommandIcon className="size-3.5" aria-hidden />
          <span className="font-mono">K</span>
          <span className="sr-only">Open command palette</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onOpenQuickLog}
          className="gap-1.5 rounded-control bg-violet text-white transition-colors duration-[180ms] ease-out hover:bg-violet/90"
        >
          <Plus className="size-4" aria-hidden />
          Log today
        </Button>
      </div>
    </header>
  );
}
