// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PANEL_LAYOUT_SCHEMA_VERSION,
  PANEL_LAYOUT_STORAGE_KEY,
  PANEL_SNAP_THRESHOLD,
  PANEL_VIEWPORT_MARGIN,
  clampPanelPosition,
  createEmptyPanelLayout,
  parsePersistedPanelLayout,
  snapPanelPosition,
} from "./panelLayout";
import { resetPanelLayout, usePanelLayout } from "./usePanelLayout";

describe("panelLayout pure clamping, snapping, and persistence validation", () => {
  afterEach(() => {
    window.localStorage.clear();
    usePanelLayout.setState({
      hydrated: false,
      topZ: 1,
      panels: {},
      defaults: {},
      measuredSizes: {},
      activeMobilePanelId: null,
    });
    vi.restoreAllMocks();
  });

  it("clamps panel coordinates to keep a 12px margin inside the viewport", () => {
    const viewport = { width: 1280, height: 800 };
    const panel = { width: 320, height: 240 };

    expect(clampPanelPosition({ x: -50, y: -20 }, panel, viewport)).toEqual({
      x: PANEL_VIEWPORT_MARGIN,
      y: PANEL_VIEWPORT_MARGIN,
    });
    expect(clampPanelPosition({ x: 2000, y: 1200 }, panel, viewport)).toEqual({
      x: 1280 - 320 - 12,
      y: 800 - 240 - 12,
    });
    expect(clampPanelPosition({ x: 400, y: 200 }, panel, viewport)).toEqual({
      x: 400,
      y: 200,
    });
  });

  it("snaps panels dropped within 24px of any edge or corner while keeping 12px margin", () => {
    const viewport = { width: 1280, height: 800 };
    const panel = { width: 300, height: 200 };
    const maxX = 1280 - 300 - 12; // 968
    const maxY = 800 - 200 - 12; // 588

    // Top-left corner snap (within 24px of 12,12)
    expect(snapPanelPosition({ x: 30, y: 28 }, panel, viewport)).toEqual({
      x: 12,
      y: 12,
      snapped: true,
    });

    // Bottom-right corner snap
    expect(
      snapPanelPosition(
        { x: maxX - PANEL_SNAP_THRESHOLD, y: maxY - PANEL_SNAP_THRESHOLD },
        panel,
        viewport,
      ),
    ).toEqual({
      x: maxX,
      y: maxY,
      snapped: true,
    });

    // Outside 24px threshold does not snap
    expect(snapPanelPosition({ x: 300, y: 260 }, panel, viewport)).toEqual({
      x: 300,
      y: 260,
      snapped: false,
    });
  });

  it("validates persisted JSON and safely ignores corrupt or wrong-version payloads", () => {
    expect(parsePersistedPanelLayout(null)).toEqual(createEmptyPanelLayout());
    expect(parsePersistedPanelLayout("{corrupt")).toEqual(createEmptyPanelLayout());
    expect(
      parsePersistedPanelLayout(
        JSON.stringify({ version: 99, topZ: 5, panels: { a: { x: 20, y: 20 } } }),
      ),
    ).toEqual(createEmptyPanelLayout());

    const partial = parsePersistedPanelLayout(
      JSON.stringify({
        version: PANEL_LAYOUT_SCHEMA_VERSION,
        topZ: 4,
        panels: {
          good: { x: 40, y: 60, width: 320, collapsed: true, closed: false, zIndex: 4 },
          badCoords: { x: "nope", y: 20 },
          badNan: { x: null, y: 10 },
        },
      }),
    );
    expect(Object.keys(partial.panels)).toEqual(["good"]);
    expect(partial.panels.good).toEqual({
      x: 40,
      y: 60,
      width: 320,
      collapsed: true,
      closed: false,
      zIndex: 4,
    });
  });

  it("manages z-order, viewport re-clamping, persistence, and resetLayout in usePanelLayout", () => {
    const store = usePanelLayout.getState();
    store.hydrateFromStorage();
    store.registerPanel(
      { id: "p1", defaultPosition: { x: 20, y: 20 }, defaultSize: { width: 280, height: 200 } },
      { width: 1440, height: 900 },
    );
    store.registerPanel(
      { id: "p2", defaultPosition: { x: 1100, y: 40 }, defaultSize: { width: 300, height: 220 } },
      { width: 1440, height: 900 },
    );

    // Bring p1 in front of p2
    usePanelLayout.getState().bringToFront("p1");
    const afterFront = usePanelLayout.getState();
    expect(afterFront.panels.p1!.zIndex).toBeGreaterThan(afterFront.panels.p2!.zIndex);

    // Shrink viewport and re-clamp
    usePanelLayout.getState().clampAllToViewport({ width: 900, height: 600 });
    expect(usePanelLayout.getState().panels.p2!.x).toBe(900 - 300 - 12);

    // Collapse & persist check
    usePanelLayout.getState().setCollapsed("p1", true, { width: 900, height: 600 });
    const rawSaved = window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    expect(rawSaved).toContain('"collapsed":true');

    // Reset layout restores defaults
    resetPanelLayout({ width: 1440, height: 900 });
    const afterReset = usePanelLayout.getState();
    expect(afterReset.panels.p1!.collapsed).toBe(false);
    expect(afterReset.panels.p1!.x).toBe(20);
    expect(afterReset.panels.p2!.x).toBe(1100);
  });
});
