// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { parseFocusTabHash } from "@/features/focus/timerUtils";
import { MICROTASKS_FRAMING_POINTS, PRACTICE_EFFECT_CAVEAT } from "@/features/focus/microtasks";
import type { MicrotaskResult } from "@/types/domain";
import { MicrotasksTab } from "./MicrotasksTab";
import { MicrotaskTrendsCard } from "./MicrotaskTrendsCard";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/focus",
  useSearchParams: () => new URLSearchParams(),
}));

describe("MicrotasksTab, Runners & Trends", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    window.localStorage.clear();
  });

  async function renderNode(node: React.ReactNode): Promise<HTMLElement> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(node);
    });
    return container;
  }

  it("parses #microtasks hash tab cleanly", () => {
    expect(parseFocusTabHash("#microtasks")).toBe("microtasks");
    expect(parseFocusTabHash("#MICROTASKS")).toBe("microtasks");
  });

  it("shows honest framing, practice-first buttons, never auto-starts, and cancels cleanly", async () => {
    const onCreateResult = vi.fn().mockResolvedValue(undefined);
    const onDeleteResult = vi.fn().mockResolvedValue(undefined);

    const host = await renderNode(
      <MicrotasksTab
        results={[]}
        reducedMotion
        onCreateResult={onCreateResult}
        onDeleteResult={onDeleteResult}
      />,
    );

    for (const point of MICROTASKS_FRAMING_POINTS) {
      expect(host.textContent).toContain(point);
    }
    expect(host.textContent).toContain("How rested do you feel?");

    // Practice round is primary before first run
    const practiceBtn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Practice reaction time"),
    ) as HTMLButtonElement | undefined;
    expect(practiceBtn).toBeDefined();

    await act(async () => {
      practiceBtn!.click();
    });

    // Runner opens in intro (never auto-starts) and cancels via Cancel button
    const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain("Start practice round");

    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Cancel"),
    ) as HTMLButtonElement;
    await act(async () => {
      cancelBtn.click();
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(onCreateResult).not.toHaveBeenCalled();
  });

  it("records reaction time run with keyboard input, false start handling, and median summary", async () => {
    vi.useFakeTimers();
    let fakeNow = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => fakeNow);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(fakeNow);
      return 1;
    });
    vi.spyOn(Math, "random").mockReturnValue(0.2); // 1600 ms wait

    const onCreateResult = vi.fn().mockResolvedValue(undefined);
    const host = await renderNode(
      <MicrotasksTab
        results={[]}
        reducedMotion
        onCreateResult={onCreateResult}
        onDeleteResult={vi.fn()}
      />,
    );

    // Optional rested rating = 4
    const restedGroup = host.querySelector('[role="group"][aria-label="How rested do you feel 1 to 5"]')!;
    const rating4 = Array.from(restedGroup.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "4",
    ) as HTMLButtonElement;
    await act(async () => {
      rating4.click();
    });

    const skipBtn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Skip practice"),
    ) as HTMLButtonElement;
    await act(async () => {
      skipBtn.click();
    });

    const startBtn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Start 5 trials"),
    ) as HTMLButtonElement;
    await act(async () => {
      startBtn.click();
    });

    // Trigger 1 false start during wait via Space
    await act(async () => {
      fakeNow += 200;
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    });
    expect(host.textContent).toContain("Too soon");

    // Advance out of false-start feedback into fresh wait
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Complete 5 valid trials of 260 ms each
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1700);
      });
      fakeNow += 260;
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
      });
      if (i < 4) {
        await act(async () => {
          vi.advanceTimersByTime(800);
        });
      }
    }

    expect(onCreateResult).toHaveBeenCalledTimes(1);
    expect(onCreateResult).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "reaction_time",
        inputType: "keyboard",
        restedRating: 4,
        metrics: {
          trialsMs: [260, 260, 260, 260, 260],
          medianMs: 260,
          bestMs: 260,
          falseStarts: 1,
        },
      }),
    );

    const dialogText = host.querySelector('[role="dialog"]')!.textContent ?? "";
    expect(dialogText).toContain("260 ms");
    expect(dialogText).toContain(MICROTASKS_FRAMING_POINTS[0]!);
    expect(dialogText).not.toMatch(/\bgood\b|\bbad\b/i);
  });

  it("renders per-task trend chart with sample size, median line, practice-effect caveat, and delete", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const sampleResults: MicrotaskResult[] = [
      {
        id: "mt-1",
        date: "2026-11-15",
        createdAt: "2026-11-15T09:00:00.000Z",
        updatedAt: "2026-11-15T09:00:00.000Z",
        task: "reaction_time",
        timeOfDay: "morning",
        restedRating: 4,
        inputType: "keyboard",
        metrics: { trialsMs: [290, 300, 310], medianMs: 300, bestMs: 290, falseStarts: 0 },
      },
      {
        id: "mt-2",
        date: "2026-11-16",
        createdAt: "2026-11-16T14:00:00.000Z",
        updatedAt: "2026-11-16T14:00:00.000Z",
        task: "memory_span",
        timeOfDay: "afternoon",
        inputType: "mouse",
        metrics: { longestSpan: 5, startingLength: 3, totalRounds: 5, failures: 2 },
      },
    ];

    const host = await renderNode(
      <MicrotaskTrendsCard results={sampleResults} onDeleteResult={onDelete} />,
    );

    expect(host.textContent).toContain("Sample size: 1 run");
    expect(host.textContent).toContain("Median: 300 ms");
    expect(host.textContent).toContain(PRACTICE_EFFECT_CAVEAT);
    expect(host.querySelector('svg[role="img"]')).not.toBeNull();
    expect(host.textContent).not.toMatch(/\bgood\b|\bbad\b|\bscore\b/i);

    const spanTab = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Memory span"),
    ) as HTMLButtonElement;
    await act(async () => {
      spanTab.click();
    });
    expect(host.textContent).toContain("Median: 5 items");

    const delBtn = host.querySelector(
      'button[aria-label="Delete Memory span run from 2026-11-16"]',
    ) as HTMLButtonElement;
    await act(async () => {
      delBtn.click();
    });
    expect(onDelete).toHaveBeenCalledWith("mt-2");
  });
});
