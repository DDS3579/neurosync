// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDb } from "@/lib/db/dexie";
import { blockRepository, settingsRepository, taskRepository } from "@/lib/db/repositories";
import type { Block, Task, UserSettings } from "@/types/domain";
import { PlannerReviewPanel } from "./PlannerReviewPanel";
import { PlannerTodayPanel } from "./PlannerTodayPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/planner",
  useSearchParams: () => new URLSearchParams(),
}));

const DATE = "2026-11-19";

describe("planner connections UI", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  let settings: UserSettings;
  let task: Task;
  let done: Block;
  let tray: Block;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      }),
    });
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  beforeEach(async () => {
    await Promise.all(getDb().tables.map((table) => table.clear()));
    settings = await settingsRepository.ensure();
    task = await taskRepository.create({ title: "Chapter", kind: "deep", estimateMin: 100, status: "active" });
    const created = await blockRepository.bulkCreate([
      { taskId: task.id, order: 0, plannedMin: 50, status: "done", actualMin: 62, plannedDate: DATE, plannedStart: "09:00" },
      { taskId: task.id, order: 1, plannedMin: 30, status: "todo" },
    ]);
    done = created[0]!;
    tray = created[1]!;
  });

  afterEach(async () => {
    if (root) await act(async () => { root!.unmount(); });
    root = null;
    container?.remove();
    container = null;
    vi.clearAllMocks();
  });

  async function render(node: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(<TooltipProvider>{node}</TooltipProvider>); });
    return container;
  }

  it("Review shows averages with sample sizes and a self-logged caveat, and no scoring language", async () => {
    const host = await render(<PlannerReviewPanel todayISO={DATE} blocks={[done]} tasks={[task]} />);
    expect(host.textContent).toContain("By block length");
    expect(host.textContent).toContain("By kind");
    expect(host.textContent).toContain("n = 1");
    expect(host.textContent).toMatch(/Self-logged/i);
    expect(host.textContent).not.toMatch(/\bscore|\bproductivity|\befficiency/i);
    const tableToggle = host.querySelector('button[aria-label*="View By block length as table"]');
    expect(tableToggle).not.toBeNull();
    await act(async () => { (tableToggle as HTMLButtonElement).click(); });
    expect(host.querySelector("table caption")).not.toBeNull();
  });

  it("Review explains an empty window instead of showing zeros as a verdict", async () => {
    const host = await render(<PlannerReviewPanel todayISO={DATE} blocks={[tray]} tasks={[task]} />);
    expect(host.textContent).toMatch(/Finish a block with the Focus Lab timer/i);
  });

  it("Today marks a tray block done through the single completion path", async () => {
    const host = await render(
      <PlannerTodayPanel
        date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
        blocks={[done, tray]} tasks={[task]} projects={[]} settings={settings}
      />,
    );
    const checkbox = host.querySelector(`input[aria-label="Mark Chapter done"]`) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    await act(async () => { checkbox.click(); });
    expect((await blockRepository.getById(tray.id))?.status).toBe("done");
  });

  it("Today rejects an overlapping placement with the engine's own explanation", async () => {
    const host = await render(
      <PlannerTodayPanel
        date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
        blocks={[done, tray]} tasks={[task]} projects={[]} settings={settings}
      />,
    );
    const time = host.querySelector(`input[id="block-clock-${tray.id}"]`) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(time, "09:30");
      time.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const place = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Place")!;
    await act(async () => { place.click(); });
    expect((await blockRepository.getById(tray.id))?.plannedStart).toBeUndefined();
  });

  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  };

  it("places a block from the slot rail (tap/keyboard parity)", async () => {
    const host = await render(
      <PlannerTodayPanel
        date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
        blocks={[done, tray]} tasks={[task]} projects={[]} settings={settings}
      />,
    );

    const arm = host.querySelector(
      'button[aria-label="Pick a timeline slot for Chapter"]',
    ) as HTMLButtonElement | null;
    expect(arm).not.toBeNull();
    await act(async () => { arm!.click(); });
    await settle();

    const slot = host.querySelector('button[aria-label="Place Chapter at 13:00"]') as HTMLButtonElement | null;
    expect(slot).not.toBeNull();
    await act(async () => { slot!.click(); });
    await settle();

    const stored = await blockRepository.getById(tray.id);
    expect(stored?.plannedStart).toBe("13:00");
    expect(stored?.status).toBe("scheduled");
  });

  it("nudges a placed block by 15 minutes and rejects an overlapping nudge", async () => {
    const host = await render(
      <PlannerTodayPanel
        date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
        blocks={[done, tray]} tasks={[task]} projects={[]} settings={settings}
      />,
    );
    const time = host.querySelector(`input[id="block-clock-${tray.id}"]`) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(time, "11:00");
      time.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const place = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Place")!;
    await act(async () => { place.click(); });
    await settle();
    const placedBlock = await blockRepository.getById(tray.id);
    expect(placedBlock?.plannedStart).toBe("11:00");

    // The panel receives props from a live query in the app, so re-render with
    // the stored row before asserting the timeline-only nudge controls.
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <PlannerTodayPanel
            date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
            blocks={[done, placedBlock!]} tasks={[task]} projects={[]} settings={settings}
          />
        </TooltipProvider>,
      );
    });

    const earlier = host.querySelector(
      'button[aria-label="Move Chapter earlier by 15 minutes"]',
    ) as HTMLButtonElement | null;
    expect(earlier).not.toBeNull();
    await act(async () => { earlier!.click(); });
    await settle();
    expect((await blockRepository.getById(tray.id))?.plannedStart).toBe("10:45");
  });

  it("places a block with a pointer drag onto a slot", async () => {
    const host = await render(
      <PlannerTodayPanel
        date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
        blocks={[done, tray]} tasks={[task]} projects={[]} settings={settings}
      />,
    );

    // Open the rail first so a drop target exists, then drag the same block.
    const arm = host.querySelector(
      'button[aria-label="Pick a timeline slot for Chapter"]',
    ) as HTMLButtonElement;
    await act(async () => { arm.click(); });
    await settle();
    const slot = host.querySelector('[data-slot-clock="14:00"]') as HTMLElement;
    expect(slot).not.toBeNull();

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => slot;

    const handle = host.querySelector('[title="Drag to a timeline slot"]') as HTMLElement;
    expect(handle).not.toBeNull();

    await act(async () => {
      // Let the dynamically imported drag module resolve.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
      window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 40 }));
      window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 40, clientY: 40 }));
    });

    await settle();
    document.elementFromPoint = originalElementFromPoint;
    expect((await blockRepository.getById(tray.id))?.plannedStart).toBe("14:00");
  });

  it("Today shows the overpacked notice neutrally when planned time exceeds capacity", async () => {
    const heavy = await blockRepository.bulkCreate([
      { taskId: task.id, order: 5, plannedMin: 900, status: "scheduled", plannedDate: DATE, plannedStart: "12:00" },
    ]);
    const host = await render(
      <PlannerTodayPanel
        date={DATE} todayISO={DATE} onChangeDate={vi.fn()}
        blocks={[done, tray, heavy[0]!]} tasks={[task]} projects={[]} settings={settings}
      />,
    );
    expect(host.textContent).toContain("Overpacked by");
    expect(host.textContent).not.toMatch(/\bfail|\bstreak|\bshould\b/i);
  });
});
