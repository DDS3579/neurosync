"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Timer, Wind } from "lucide-react";

import { ALL_NAV_ITEMS } from "@/components/app-shell/nav-items";
import { HABIT_HASH_EVENT } from "@/features/habits/habitUtils";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickLog: () => void;
}

export function CommandPalette({ open, onOpenChange, onQuickLog }: CommandPaletteProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Search pages and actions"
    >
      <Command>
        <CommandInput placeholder="Search pages and actions…" />

        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>

          <CommandGroup heading="Go to">
            {ALL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <Icon aria-hidden />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem value="log today quick log" onSelect={() => run(onQuickLog)}>
              <Plus aria-hidden />
              Log today
            </CommandItem>
            <CommandItem
              value="start focus session timer"
              onSelect={() => run(() => router.push("/focus"))}
            >
              <Timer aria-hidden />
              Start focus session
            </CommandItem>
            <CommandItem
              value="mind breathing meditation journal gratitude /habits#mind"
              onSelect={() =>
                run(() => {
                  router.push("/habits#mind");
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event(HABIT_HASH_EVENT));
                  }, 0);
                  window.requestAnimationFrame(() => {
                    window.dispatchEvent(new Event(HABIT_HASH_EVENT));
                  });
                })
              }
            >
              <Wind aria-hidden />
              Mind &amp; breathing
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
