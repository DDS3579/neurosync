// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FloatingPanel } from "./FloatingPanel";
import { FloatingPanelLayer } from "./FloatingPanelLayer";
import { usePanelLayout } from "./usePanelLayout";

let mockIsMobile = false;

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

describe("FloatingPanel & FloatingPanelLayer accessibility, keyboard, and mobile sheet", () => {
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
    mockIsMobile = false;
  });

  it("renders role=region panels, toggles collapse, moves with Alt+Arrows, and Esc returns focus to canvas", async () => {
    const returnFocusSpy = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <FloatingPanelLayer onReturnFocusToCanvas={returnFocusSpy}>
          <FloatingPanel id="modes" title="Atlas Modes" defaultPosition={{ x: 24, y: 24 }}>
            <p>Panel body content</p>
          </FloatingPanel>
        </FloatingPanelLayer>,
      );
    });

    const region = container.querySelector('[role="region"][aria-label="Atlas Modes"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.getAttribute("data-collapsed")).toBe("false");

    // Click header toggle collapses to compact chip
    const headerBtn = region.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      headerBtn.click();
    });
    expect(region.getAttribute("data-collapsed")).toBe("true");
    expect(container.textContent).not.toContain("Panel body content");

    // Alt+ArrowRight moves panel by 16px
    const startX = usePanelLayout.getState().panels.modes!.x;
    await act(async () => {
      headerBtn.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }),
      );
    });
    expect(usePanelLayout.getState().panels.modes!.x).toBe(startX + 16);

    // Esc inside panel returns focus to canvas
    await act(async () => {
      headerBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(returnFocusSpy).toHaveBeenCalledTimes(1);
  });

  it("renders mobile bottom chip row and single-open bottom sheet under 768px", async () => {
    mockIsMobile = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <FloatingPanelLayer>
          <FloatingPanel id="p1" title="Controls" defaultPosition={{ x: 20, y: 20 }}>
            <p>Controls body</p>
          </FloatingPanel>
          <FloatingPanel id="p2" title="Inspector" defaultPosition={{ x: 20, y: 200 }}>
            <p>Inspector body</p>
          </FloatingPanel>
        </FloatingPanelLayer>,
      );
    });

    // Initially chips are visible, no sheet is open
    const chips = Array.from(
      container.querySelectorAll('[role="group"][aria-label="Floating panels"] button'),
    ) as HTMLButtonElement[];
    expect(chips.map((c) => c.textContent)).toEqual(["Controls", "Inspector"]);
    expect(container.textContent).not.toContain("Controls body");

    // Open Controls sheet
    await act(async () => {
      chips[0]!.click();
    });
    expect(container.textContent).toContain("Controls body");
    expect(container.textContent).not.toContain("Inspector body");

    // Switch to Inspector sheet (one open at a time)
    await act(async () => {
      chips[1]!.click();
    });
    expect(container.textContent).toContain("Inspector body");
    expect(container.textContent).not.toContain("Controls body");
  });
});
