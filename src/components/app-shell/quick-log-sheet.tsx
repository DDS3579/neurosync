"use client";

import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface QuickLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

export function QuickLogSheet({ open, onOpenChange, children }: QuickLogSheetProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 border-border bg-surface p-0",
          isMobile
            ? "h-[72svh] rounded-t-card pb-[env(safe-area-inset-bottom)]"
            : "w-full max-w-md rounded-l-card",
        )}
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-section font-medium">Log today</SheetTitle>
          <SheetDescription className="text-caption text-muted-foreground">
            Pick what you want to record. Everything stays in this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
