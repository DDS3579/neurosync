// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { usePanelLayout } from "@/components/floating";
import { ALL_NAV_ITEMS } from "@/components/app-shell/nav-items";
import { TooltipProvider } from "@/components/ui/tooltip";
import { generateDemoData } from "@/lib/insights";
import { deriveConstellation } from "@/features/constellation/constellation";
import { ConstellationWorkspace } from "./ConstellationWorkspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/constellation",
  useSearchParams: () => new URLSearchParams(),
}));

const BANNED_DOM_PATTERNS = [
  /\bcaus(e|ed|es|ing)\b/i,
  /\bmakes you\b/i,
  /\bleads to\b/i,
  /\bresults in\b/i,
  /\baffected\b/i,
  /\bimproved\b/i,
  /\bstrengthened\b/i,
  /\bboosted\b/i,
  /\bstreak/i,
  /\bbroken\b/i,
  /\bscore\b/i,
  /\bdiagnos/i,
];

function assertCleanDomCopy(text: string) {
  for (const pattern of BANNED_DOM_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

describe("ConstellationWorkspace UI & navigation", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeAll(() => {
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
    if (typeof window.ResizeObserver === "undefined") {
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    }
  });

  afterEach(async () => {
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
    usePanelLayout.setState({
      hydrated: false,
      topZ: 1,
      panels: {},
      defaults: {},
      measuredSizes: {},
      activeMobilePanelId: null,
    });
  });

  async function renderWorkspace(node: React.ReactNode): Promise<HTMLElement> {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<TooltipProvider>{node}</TooltipProvider>);
    });
    return container;
  }

  it("registers /constellation in ALL_NAV_ITEMS (nav, command palette, and immersive dock)", () => {
    const item = ALL_NAV_ITEMS.find((entry) => entry.href === "/constellation");
    expect(item).toBeDefined();
    expect(item?.label).toBe("Constellation");
  });

  it("shows only explanation and gated Load demo data button when under 10 logged days", async () => {
    const today = new Date("2026-11-17T12:00:00");
    const emptyData = deriveConstellation({
      habits: [],
      habitLogs: [],
      activities: [],
      focus: [],
      movement: [],
      mindfulness: [],
      windowDays: 30,
      today,
    });
    const onLoadDemo = vi.fn().mockResolvedValue(undefined);

    const host = await renderWorkspace(
      <ConstellationWorkspace
        data={emptyData}
        windowDays={30}
        onChangeWindowDays={vi.fn()}
        reducedMotion
        onLoadDemo={onLoadDemo}
      />,
    );

    expect(host.querySelector("[data-constellation-canvas]")).toBeNull();
    expect(host.textContent).toContain("0 of 10 logged days");
    assertCleanDomCopy(host.textContent ?? "");

    const demoBtn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Load demo data"),
    ) as HTMLButtonElement | undefined;
    expect(demoBtn).toBeDefined();
    await act(async () => {
      demoBtn!.click();
    });
    expect(onLoadDemo).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard focus tooltip, floating detail panel with calendar & Log now, and table view toggle", async () => {
    const today = new Date("2026-11-17T12:00:00");
    const demo = generateDemoData(14, 42, today);
    const data = deriveConstellation({
      habits: demo.habits,
      habitLogs: demo.habitLogs,
      activities: [],
      focus: demo.focus,
      movement: demo.movement,
      mindfulness: [],
      windowDays: 30,
      today,
    });

    const host = await renderWorkspace(
      <ConstellationWorkspace
        data={data}
        windowDays={30}
        onChangeWindowDays={vi.fn()}
        reducedMotion
      />,
    );

    assertCleanDomCopy(host.textContent ?? "");
    const firstStar = host.querySelector("[data-star-id]") as SVGGElement;
    expect(firstStar).not.toBeNull();

    // Focus opens tooltip without requiring mouse hover
    await act(async () => {
      firstStar.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(host.querySelector("[data-constellation-tooltip]")).not.toBeNull();

    // Pressing Enter opens floating detail panel with mini calendar + "Log now" link
    await act(async () => {
      firstStar.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const detailPanel = host.querySelector('[data-panel-id="constellation-detail"]') as HTMLElement;
    expect(detailPanel).not.toBeNull();
    expect(detailPanel.querySelector('[role="grid"]')).not.toBeNull();
    const logNowLink = Array.from(detailPanel.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Log now"),
    );
    expect(logNowLink).toBeDefined();
    assertCleanDomCopy(detailPanel.textContent ?? "");

    // Switch to Table view for accessible alternative
    const tableBtn = host.querySelector('button[aria-label="Table view"]') as HTMLButtonElement;
    expect(tableBtn).not.toBeNull();
    await act(async () => {
      tableBtn.click();
    });
    const table = host.querySelector("table");
    expect(table).not.toBeNull();
    expect(table!.textContent).toContain("happened on the same day");
    assertCleanDomCopy(table!.textContent ?? "");
  });
});
