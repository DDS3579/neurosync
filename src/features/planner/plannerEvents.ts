export const PLANNER_HASH_EVENT = "nx:planner-hash-change";
export const PLANNER_ADD_TASK_EVENT = "nx:planner-focus-add-task";

export const PLANNER_TABS = ["today", "week", "tasks", "review", "day"] as const;
export type PlannerTab = (typeof PLANNER_TABS)[number];

export const PLANNER_TAB_LABELS: Record<PlannerTab, string> = {
  today: "Today",
  week: "Week",
  tasks: "Tasks",
  review: "Review",
  day: "Day plan (rules)",
};

/** `#shutdown` is a deep link that opens Today plus the shutdown dialog. */
export function parsePlannerHash(hash: string): { tab: PlannerTab; shutdown: boolean } {
  const cleaned = hash.replace(/^#/, "").trim().toLowerCase();
  if (cleaned === "shutdown") return { tab: "today", shutdown: true };
  return {
    tab: (PLANNER_TABS as readonly string[]).includes(cleaned)
      ? (cleaned as PlannerTab)
      : "today",
    shutdown: false,
  };
}

export function notifyPlannerNavigation(): void {
  if (typeof window === "undefined") return;
  const fire = () => window.dispatchEvent(new Event(PLANNER_HASH_EVENT));
  window.setTimeout(fire, 0);
  window.requestAnimationFrame(() => window.setTimeout(fire, 60));
}
