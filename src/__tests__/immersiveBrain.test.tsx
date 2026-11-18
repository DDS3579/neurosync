// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";
import { usePanelLayout } from "@/components/floating";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrainExplorerWorkspace } from "@/features/brain/components/BrainExplorerWorkspace";
import { UI_BRAIN_IMMERSIVE_KEY, UI_BRAIN_SIZE_KEY, readBrainSizePref } from "@/lib/ui/brainUiPrefs";

let mockPathname = "/brain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function BrainExplorerStub(props: {
      selectedRegion: string | null;
      onSelectRegion: (id: string | null) => void;
      brainSize?: number;
    }) {
      return (
        <div
          data-testid="brain-explorer-stub"
          data-selected={props.selectedRegion ?? ""}
          data-size={props.brainSize ?? 1}
        />
      );
    },
}));

describe("Immersive /brain shell, Escape hierarchy, and wheel controls", () => {
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
    mockPathname = "/brain";
  });

  async function renderBrainShell() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <TooltipProvider>
          <AppShell>
            <BrainExplorerWorkspace
              activity={{ prefrontal: 0.7 }}
              loggedItems={[]}
              windowStart="2026-11-10"
              windowEnd="2026-11-17"
            />
          </AppShell>
        </TooltipProvider>,
      );
    });
    return container;
  }

  it("hides AppShell chrome with hidden + inert on /brain when immersive defaults true", async () => {
    const node = await renderBrainShell();

    const sidebarEl = node.querySelector('[data-slot="sidebar"]');
    const sidebarWrapper = sidebarEl?.parentElement;
    expect(sidebarWrapper?.hasAttribute("hidden")).toBe(true);
    expect(sidebarWrapper?.hasAttribute("inert")).toBe(true);
    expect(sidebarWrapper?.getAttribute("aria-hidden")).toBe("true");

    const topbarHeader = node.querySelector("header");
    const topbarWrapper = topbarHeader?.parentElement;
    expect(topbarWrapper?.hasAttribute("hidden")).toBe(true);
    expect(topbarWrapper?.hasAttribute("inert")).toBe(true);

    const navDock = node.querySelector('[data-panel-id="brain-nav-dock"]') as HTMLElement;
    const modePanel = node.querySelector('[data-panel-id="brain-mode-panel"]') as HTMLElement;
    const regionPanel = node.querySelector('[data-panel-id="brain-region-panel"]') as HTMLElement;
    expect(navDock).not.toBeNull();
    expect(modePanel).not.toBeNull();
    expect(regionPanel).not.toBeNull();

    // Navigation dock starts collapsed to quick icons; Mode and Region panels start open on >=1024px.
    expect(navDock.getAttribute("data-collapsed")).toBe("true");
    expect(modePanel.getAttribute("data-collapsed")).toBe("false");
    expect(regionPanel.getAttribute("data-collapsed")).toBe("false");

    // No duplicated non-floating aside overlay in immersive mode.
    expect(node.querySelector('aside[aria-label="Selected region details"]')).toBeNull();

    // Collapsed dock still exposes route icons, Command Palette, and Exit immersive.
    expect(navDock.querySelector('a[href="/overview"]')).not.toBeNull();
    expect(navDock.querySelector('a[href="/brain"][aria-current="page"]')).not.toBeNull();
    expect(navDock.querySelector('a[href="/settings"]')).not.toBeNull();

    // Region panel includes Networks and stays open with "Select a region" hint when deselected.
    expect(regionPanel.textContent).toContain("Networks");
    expect(regionPanel.textContent).toContain("Frontoparietal control network");

    const prefrontalChip = Array.from(regionPanel.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Prefrontal Cortex",
    ) as HTMLButtonElement;
    await act(async () => {
      prefrontalChip.click();
    });
    expect(node.querySelector('[data-panel-id="brain-region-panel"]')).not.toBeNull();
    expect(regionPanel.textContent).toContain("Select a region");

    // Mode panel houses modes, Fit/Reset/Size controls, and Activity disclaimer.
    expect(modePanel.querySelector('button[aria-label="Fit to screen"]')).not.toBeNull();
    expect(modePanel.querySelector('button[aria-label="Reset view"]')).not.toBeNull();
    const activityTab = Array.from(modePanel.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent?.trim() === "Activity",
    ) as HTMLElement;
    await act(async () => {
      activityTab.click();
    });
    expect(modePanel.textContent).toContain(
      "Educational association, not a measurement of your brain activity.",
    );

    // Expanding Navigation dock reveals full labeled links, Command Palette hint, Reset layout, and Exit.
    const expandDockBtn = navDock.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      expandDockBtn.click();
    });
    expect(navDock.getAttribute("data-collapsed")).toBe("false");
    expect(navDock.textContent).toContain("Reset layout");
    expect(navDock.textContent).toContain("Ctrl+K");
    expect(navDock.querySelector('button[aria-label="Exit immersive mode"]')).not.toBeNull();
  });

  it("exits immersive on Exit button or Esc only after no region is selected, and honors localStorage pref", async () => {
    const node = await renderBrainShell();

    // First Esc should NOT exit immersive while default region ("prefrontal") is selected.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(node.querySelector('button[aria-label="Exit immersive mode"]')).not.toBeNull();

    // Exit via top-right Exit immersive button
    const exitBtn = node.querySelector('button[aria-label="Exit immersive mode"]') as HTMLButtonElement;
    await act(async () => {
      exitBtn.click();
    });

    const sidebarWrapper = node.querySelector('[data-slot="sidebar"]')?.parentElement;
    expect(sidebarWrapper?.hasAttribute("hidden")).toBe(false);
    expect(sidebarWrapper?.hasAttribute("inert")).toBe(false);
    expect(node.querySelector('button[aria-label="Enter full-screen immersive mode"]')).not.toBeNull();

    // Re-enter, deselect region, then Esc should exit immersive
    const enterBtn = node.querySelector(
      'button[aria-label="Enter full-screen immersive mode"]',
    ) as HTMLButtonElement;
    await act(async () => {
      enterBtn.click();
    });
    expect(node.querySelector('button[aria-label="Exit immersive mode"]')).not.toBeNull();

    // Deselect default "prefrontal" via chip click
    const prefrontalChip = Array.from(node.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Prefrontal Cortex",
    ) as HTMLButtonElement;
    await act(async () => {
      prefrontalChip.click();
    });

    // Now Esc exits immersive
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(node.querySelector('button[aria-label="Enter full-screen immersive mode"]')).not.toBeNull();

    // Preference false opens /brain in standard layout
    await act(async () => {
      root!.unmount();
    });
    root = null;
    container!.remove();
    container = null;

    window.localStorage.setItem(UI_BRAIN_IMMERSIVE_KEY, "false");
    const nonImmersiveNode = await renderBrainShell();
    expect(
      nonImmersiveNode.querySelector('button[aria-label="Enter full-screen immersive mode"]'),
    ).not.toBeNull();
  });

  it("handles ctrl+wheel brain resize with preventDefault while leaving floating panel wheels untouched", async () => {
    window.localStorage.setItem(UI_BRAIN_SIZE_KEY, "1");
    const node = await renderBrainShell();

    const canvasStub = node.querySelector('[data-testid="brain-explorer-stub"]') as HTMLElement;
    expect(canvasStub).not.toBeNull();

    const ctrlWheel = new WheelEvent("wheel", {
      deltaY: -40,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      canvasStub.dispatchEvent(ctrlWheel);
    });
    expect(ctrlWheel.defaultPrevented).toBe(true);
    expect(readBrainSizePref()).toBe(1.1);

    // Wheel with ctrlKey inside a floating panel must NOT preventDefault or resize the brain
    const floatingPanel = node.querySelector('[data-brain-panel="true"]') as HTMLElement;
    const panelWheel = new WheelEvent("wheel", {
      deltaY: -40,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      floatingPanel.dispatchEvent(panelWheel);
    });
    expect(panelWheel.defaultPrevented).toBe(false);
    expect(readBrainSizePref()).toBe(1.1);

    // Focus rescue: clicking Enter full-screen moves focus out of hidden inert sidebar
    const sidebarLink = node.querySelector('[data-slot="sidebar"] a') as HTMLElement | null;
    if (sidebarLink) {
      await act(async () => {
        node
          .querySelector<HTMLButtonElement>('button[aria-label="Exit immersive mode"]')!
          .click();
      });
      sidebarLink.focus();
      await act(async () => {
        node
          .querySelector<HTMLButtonElement>('button[aria-label="Enter full-screen immersive mode"]')!
          .click();
      });
      expect(document.activeElement?.closest("[inert]")).toBeNull();
    }
  });
});
