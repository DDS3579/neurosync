"use client";

import { create } from "zustand";

import {
  PANEL_LAYOUT_SCHEMA_VERSION,
  clampPanelPosition,
  createEmptyPanelLayout,
  readPersistedPanelLayout,
  writePersistedPanelLayout,
  type PanelPosition,
  type PanelSize,
  type PanelState,
  type PersistedPanelLayout,
  type ViewportSize,
} from "./panelLayout";

export interface PanelDefaultsSpec {
  id: string;
  defaultPosition: PanelPosition;
  defaultSize?: PanelSize;
}

interface PanelLayoutStoreState {
  hydrated: boolean;
  topZ: number;
  panels: Record<string, PanelState>;
  defaults: Record<string, PanelDefaultsSpec>;
  measuredSizes: Record<string, { width: number; height: number }>;
  activeMobilePanelId: string | null;

  hydrateFromStorage: () => void;
  registerPanel: (spec: PanelDefaultsSpec, viewport?: ViewportSize) => void;
  setMeasuredSize: (id: string, size: { width: number; height: number }) => void;
  setPosition: (id: string, pos: PanelPosition) => void;
  setSize: (id: string, size: { width: number; height?: number }) => void;
  setCollapsed: (id: string, collapsed: boolean, viewport?: ViewportSize) => void;
  toggleCollapsed: (id: string, viewport?: ViewportSize) => void;
  setClosed: (id: string, closed: boolean) => void;
  bringToFront: (id: string) => void;
  clampAllToViewport: (viewport: ViewportSize) => void;
  setMobileActivePanel: (id: string | null) => void;
  resetLayout: (viewport?: ViewportSize) => void;
}

function persistSnapshot(topZ: number, panels: Record<string, PanelState>): void {
  const payload: PersistedPanelLayout = {
    version: PANEL_LAYOUT_SCHEMA_VERSION,
    topZ,
    panels,
  };
  writePersistedPanelLayout(payload);
}

function getEffectiveSize(
  id: string,
  panel: PanelState | undefined,
  defaults: Record<string, PanelDefaultsSpec>,
  measured: Record<string, { width: number; height: number }>,
): { width: number; height: number } {
  const measuredSize = measured[id];
  if (measuredSize && measuredSize.width > 0 && measuredSize.height > 0) {
    return measuredSize;
  }
  const def = defaults[id]?.defaultSize;
  return {
    width: panel?.width ?? def?.width ?? 300,
    height: panel?.height ?? def?.height ?? 240,
  };
}

export const usePanelLayout = create<PanelLayoutStoreState>((set, get) => ({
  hydrated: false,
  topZ: 1,
  panels: {},
  defaults: {},
  measuredSizes: {},
  activeMobilePanelId: null,

  hydrateFromStorage: () => {
    if (get().hydrated) return;
    const loaded = readPersistedPanelLayout();
    set((state) => {
      const mergedPanels: Record<string, PanelState> = { ...loaded.panels };
      let nextTopZ = loaded.topZ;

      for (const [id, spec] of Object.entries(state.defaults)) {
        if (!mergedPanels[id]) {
          nextTopZ += 1;
          mergedPanels[id] = {
            x: spec.defaultPosition.x,
            y: spec.defaultPosition.y,
            ...(spec.defaultSize?.width !== undefined ? { width: spec.defaultSize.width } : {}),
            ...(spec.defaultSize?.height !== undefined ? { height: spec.defaultSize.height } : {}),
            collapsed: false,
            closed: false,
            zIndex: nextTopZ,
          };
        }
      }

      return {
        hydrated: true,
        topZ: nextTopZ,
        panels: mergedPanels,
      };
    });
  },

  registerPanel: (spec, viewport) => {
    set((state) => {
      const nextDefaults = { ...state.defaults, [spec.id]: spec };
      const existing = state.panels[spec.id];

      if (existing) {
        if (!viewport) {
          return { defaults: nextDefaults };
        }
        const size = getEffectiveSize(spec.id, existing, nextDefaults, state.measuredSizes);
        const clamped = clampPanelPosition(existing, size, viewport);
        if (clamped.x === existing.x && clamped.y === existing.y) {
          return { defaults: nextDefaults };
        }
        const nextPanels = {
          ...state.panels,
          [spec.id]: { ...existing, x: clamped.x, y: clamped.y },
        };
        if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
        return { defaults: nextDefaults, panels: nextPanels };
      }

      const nextTopZ = state.topZ + 1;
      const basePos = viewport
        ? clampPanelPosition(
            spec.defaultPosition,
            {
              width: spec.defaultSize?.width ?? 300,
              height: spec.defaultSize?.height ?? 240,
            },
            viewport,
          )
        : spec.defaultPosition;

      const nextPanels: Record<string, PanelState> = {
        ...state.panels,
        [spec.id]: {
          x: basePos.x,
          y: basePos.y,
          ...(spec.defaultSize?.width !== undefined ? { width: spec.defaultSize.width } : {}),
          ...(spec.defaultSize?.height !== undefined ? { height: spec.defaultSize.height } : {}),
          collapsed: false,
          closed: false,
          zIndex: nextTopZ,
        },
      };

      if (state.hydrated) persistSnapshot(nextTopZ, nextPanels);
      return {
        defaults: nextDefaults,
        topZ: nextTopZ,
        panels: nextPanels,
      };
    });
  },

  setMeasuredSize: (id, size) => {
    set((state) => {
      const prev = state.measuredSizes[id];
      const nextMeasured = {
        ...state.measuredSizes,
        [id]: size,
      };
      const currentPanel = state.panels[id];
      const viewport =
        typeof window !== "undefined"
          ? { width: window.innerWidth, height: window.innerHeight }
          : null;

      let nextPanels = state.panels;
      if (currentPanel && viewport) {
        const clamped = clampPanelPosition(currentPanel, size, viewport);
        if (clamped.x !== currentPanel.x || clamped.y !== currentPanel.y) {
          nextPanels = {
            ...state.panels,
            [id]: { ...currentPanel, x: clamped.x, y: clamped.y },
          };
          if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
        }
      }

      if (
        prev &&
        prev.width === size.width &&
        prev.height === size.height &&
        nextPanels === state.panels
      ) {
        return state;
      }

      return {
        measuredSizes: nextMeasured,
        ...(nextPanels !== state.panels ? { panels: nextPanels } : {}),
      };
    });
  },

  setPosition: (id, pos) => {
    set((state) => {
      const current = state.panels[id];
      if (!current) return state;
      if (current.x === pos.x && current.y === pos.y) return state;
      const nextPanels = {
        ...state.panels,
        [id]: { ...current, x: Math.round(pos.x), y: Math.round(pos.y) },
      };
      if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
      return { panels: nextPanels };
    });
  },

  setSize: (id, size) => {
    set((state) => {
      const current = state.panels[id];
      if (!current) return state;
      const nextPanels = {
        ...state.panels,
        [id]: {
          ...current,
          width: Math.round(size.width),
          ...(size.height !== undefined ? { height: Math.round(size.height) } : {}),
        },
      };
      if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
      return { panels: nextPanels };
    });
  },

  setCollapsed: (id, collapsed, viewport) => {
    set((state) => {
      const current = state.panels[id];
      if (!current) return state;
      let nextX = current.x;
      let nextY = current.y;
      if (viewport) {
        const size = getEffectiveSize(id, current, state.defaults, state.measuredSizes);
        const clamped = clampPanelPosition({ x: nextX, y: nextY }, size, viewport);
        nextX = clamped.x;
        nextY = clamped.y;
      }
      const nextPanels = {
        ...state.panels,
        [id]: { ...current, collapsed, x: nextX, y: nextY },
      };
      if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
      return { panels: nextPanels };
    });
  },

  toggleCollapsed: (id, viewport) => {
    const current = get().panels[id];
    if (!current) return;
    get().setCollapsed(id, !current.collapsed, viewport);
  },

  setClosed: (id, closed) => {
    set((state) => {
      const current = state.panels[id];
      if (!current) return state;
      const nextPanels = {
        ...state.panels,
        [id]: { ...current, closed },
      };
      if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
      return {
        panels: nextPanels,
        activeMobilePanelId:
          closed && state.activeMobilePanelId === id ? null : state.activeMobilePanelId,
      };
    });
  },

  bringToFront: (id) => {
    set((state) => {
      const current = state.panels[id];
      if (!current) return state;
      if (current.zIndex === state.topZ) return state;
      const nextTopZ = state.topZ + 1;
      const nextPanels = {
        ...state.panels,
        [id]: { ...current, zIndex: nextTopZ },
      };
      if (state.hydrated) persistSnapshot(nextTopZ, nextPanels);
      return { topZ: nextTopZ, panels: nextPanels };
    });
  },

  clampAllToViewport: (viewport) => {
    set((state) => {
      let changed = false;
      const nextPanels: Record<string, PanelState> = { ...state.panels };

      for (const [id, panel] of Object.entries(state.panels)) {
        const size = getEffectiveSize(id, panel, state.defaults, state.measuredSizes);
        const clamped = clampPanelPosition(panel, size, viewport);
        if (clamped.x !== panel.x || clamped.y !== panel.y) {
          nextPanels[id] = { ...panel, x: clamped.x, y: clamped.y };
          changed = true;
        }
      }

      if (!changed) return state;
      if (state.hydrated) persistSnapshot(state.topZ, nextPanels);
      return { panels: nextPanels };
    });
  },

  setMobileActivePanel: (id) => {
    set({ activeMobilePanelId: id });
  },

  resetLayout: (viewport) => {
    set((state) => {
      const nextPanels: Record<string, PanelState> = {};
      let nextTopZ = 1;

      for (const [id, spec] of Object.entries(state.defaults)) {
        nextTopZ += 1;
        const pos = viewport
          ? clampPanelPosition(
              spec.defaultPosition,
              {
                width: spec.defaultSize?.width ?? 300,
                height: spec.defaultSize?.height ?? 240,
              },
              viewport,
            )
          : spec.defaultPosition;

        nextPanels[id] = {
          x: pos.x,
          y: pos.y,
          ...(spec.defaultSize?.width !== undefined ? { width: spec.defaultSize.width } : {}),
          ...(spec.defaultSize?.height !== undefined ? { height: spec.defaultSize.height } : {}),
          collapsed: false,
          closed: false,
          zIndex: nextTopZ,
        };
      }

      const fallback = createEmptyPanelLayout();
      persistSnapshot(Math.max(nextTopZ, fallback.topZ), nextPanels);
      return {
        topZ: Math.max(nextTopZ, fallback.topZ),
        panels: nextPanels,
        activeMobilePanelId: null,
      };
    });
  },
}));

/**
 * Restores all registered floating panels to their default positions and states.
 */
export function resetPanelLayout(viewport?: ViewportSize): void {
  const effectiveViewport =
    viewport ??
    (typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : undefined);
  usePanelLayout.getState().resetLayout(effectiveViewport);
}
