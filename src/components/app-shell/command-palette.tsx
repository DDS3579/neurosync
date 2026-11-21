"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarRange, Compass, ListChecks, Moon, Plus, Repeat, Timer, Wind } from "lucide-react";
import { toast } from "sonner";

import { ALL_NAV_ITEMS } from "@/components/app-shell/nav-items";
import { FOCUS_HASH_EVENT } from "@/features/focus/timerUtils";
import { HABIT_HASH_EVENT } from "@/features/habits/habitUtils";
import {
  PLANNER_ADD_TASK_EVENT,
  notifyPlannerNavigation,
} from "@/features/planner/plannerEvents";
import { nextBlockHref } from "@/features/planner/services/blockActions";
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
            <CommandItem
              value="your week weekly report export pdf png /insights/weekly"
              onSelect={() => run(() => router.push("/insights/weekly"))}
            >
              <CalendarRange aria-hidden />
              Your week report
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Actions">
            <CommandItem value="log today quick log" onSelect={() => run(onQuickLog)}>
              <Plus aria-hidden />
              Log today
            </CommandItem>
            <CommandItem
              value="add task planner capture block"
              onSelect={() =>
                run(() => {
                  router.push("/planner#today");
                  notifyPlannerNavigation();
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event(PLANNER_ADD_TASK_EVENT));
                  }, 120);
                })
              }
            >
              <ListChecks aria-hidden />
              Add task
            </CommandItem>
            <CommandItem
              value="plan today planner timeline blocks"
              onSelect={() =>
                run(() => {
                  router.push("/planner#today");
                  notifyPlannerNavigation();
                })
              }
            >
              <CalendarClock aria-hidden />
              Plan today
            </CommandItem>
            <CommandItem
              value="start next block focus timer planner"
              onSelect={() =>
                run(() => {
                  void (async () => {
                    const href = await nextBlockHref();
                    if (href) {
                      router.push(href);
                      return;
                    }
                    router.push("/planner#today");
                    notifyPlannerNavigation();
                    toast.info("No block is scheduled for today yet — place one first.");
                  })();
                })
              }
            >
              <Timer aria-hidden />
              Start next block
            </CommandItem>
            <CommandItem
              value="shutdown close day reflection planner"
              onSelect={() =>
                run(() => {
                  router.push("/planner#shutdown");
                  notifyPlannerNavigation();
                })
              }
            >
              <Moon aria-hidden />
              Shutdown
            </CommandItem>
            <CommandItem
              value="start focus session timer"
              onSelect={() => run(() => router.push("/focus"))}
            >
              <Timer aria-hidden />
              Start focus session
            </CommandItem>
            <CommandItem
              value="spaced repetition review queue due today /focus#review"
              onSelect={() =>
                run(() => {
                  router.push("/focus#review");
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event(FOCUS_HASH_EVENT));
                  }, 0);
                  window.requestAnimationFrame(() => {
                    window.dispatchEvent(new Event(FOCUS_HASH_EVENT));
                  });
                })
              }
            >
              <Repeat aria-hidden />
              Review queue (spaced repetition)
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
            <CommandItem
              value="activities social creative music language puzzles hobby novelty /habits#activities"
              onSelect={() =>
                run(() => {
                  router.push("/habits#activities");
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event(HABIT_HASH_EVENT));
                  }, 0);
                  window.requestAnimationFrame(() => {
                    window.dispatchEvent(new Event(HABIT_HASH_EVENT));
                  });
                })
              }
            >
              <Compass aria-hidden />
              Activities beyond study
            </CommandItem>
            <CommandItem
              value="your week weekly report export pdf png /insights/weekly"
              onSelect={() => run(() => router.push("/insights/weekly"))}
            >
              <CalendarRange aria-hidden />
              Your week report
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
