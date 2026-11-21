// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getDb } from "@/lib/db/dexie";
import { settingsRepository } from "@/lib/db/repositories";
import type { Block, Task, UserSettings } from "@/types/domain";

import { PlannerTodayPanel } from "./PlannerTodayPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/planner",
  useSearchParams: () => new URLSearchParams(),
}));

const DATE = "2026-11-19";

/**
 * Heavy-dataset smoke benchmark: 40 tasks and 200 blocks, the scenario used for
 * the v0.4 profiling note. The bound is deliberately generous so it catches a
 * real regression (an accidental O(n²) render or a per-row live query) without
 * being flaky on a slow CI machine. The measured duration is logged for the
 * report; it is not a frame-rate claim.
 */
describe("planner heavy dataset", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  let settings: UserSettings;
  const tasks: Task[] = [];
  const blocks: Block[] = [];

  beforeAll(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

    await Promise.all(getDb().tables.map((table) => table.clear()));
    settings = await settingsRepository.ensure();

    for (let t = 0; t < 40; t += 1) {
      tasks.push({
        id: `perf-task-${t}`,
        createdAt: "2026-11-16T08:00:00.000Z",
        updatedAt: "2026-11-16T08:00:00.000Z",
        title: `Task ${t}`,
        kind: t % 3 === 0 ? "deep" : t % 3 === 1 ? "shallow" : "recovery",
        estimateMin: 250,
        status: "active",
      });
    }
    for (let b = 0; b < 200; b += 1) {
      const task = tasks[b % tasks.length]!;
      const placed = b % 2 === 0;
      blocks.push({
        id: `perf-block-${b}`,
        createdAt: "2026-11-16T08:00:00.000Z",
        updatedAt: "2026-11-16T08:00:00.000Z",
        taskId: task.id,
        order: b,
        plannedMin: 50,
        status: placed ? "scheduled" : "todo",
        ...(placed
          ? { plannedDate: b % 4 === 0 ? DATE : "2026-11-20", plannedStart: "09:00" }
          : { plannedDate: b % 6 === 0 ? DATE : undefined }),
      });
    }
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
    vi.clearAllMocks();
  });

  it("renders a 40-task / 200-block day in one pass and re-renders cheaply", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const started = performance.now();
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <PlannerTodayPanel
            date={DATE}
            todayISO={DATE}
            onChangeDate={vi.fn()}
            blocks={blocks}
            tasks={tasks}
            projects={[]}
            settings={settings}
          />
        </TooltipProvider>,
      );
    });
    const firstRenderMs = performance.now() - started;

    const rows = container.querySelectorAll('[id^="block-row-"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Timeline");

    // Re-render with the same props (a live-query tick with no data change).
    const rerenderStarted = performance.now();
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <PlannerTodayPanel
            date={DATE}
            todayISO={DATE}
            onChangeDate={vi.fn()}
            blocks={blocks}
            tasks={tasks}
            projects={[]}
            settings={settings}
          />
        </TooltipProvider>,
      );
    });
    const rerenderMs = performance.now() - rerenderStarted;

    console.info(
      `[planner perf] first render ${firstRenderMs.toFixed(0)}ms · rerender ${rerenderMs.toFixed(0)}ms · ${rows.length} rows`,
    );

    // No strict perf assertion here: the suite runs many workers in parallel and
    // jsdom timings vary widely. The logged numbers go in the report; the bound
    // only catches a hang or a pathological (minutes-long) render.
    expect(firstRenderMs).toBeLessThan(10_000);
    expect(rerenderMs).toBeLessThan(10_000);
  });
});
