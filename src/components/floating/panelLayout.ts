export const PANEL_LAYOUT_STORAGE_KEY = "ns:ui:v1:panel-layout";
export const PANEL_LAYOUT_SCHEMA_VERSION = 1;
export const PANEL_VIEWPORT_MARGIN = 12;
export const PANEL_SNAP_THRESHOLD = 24;
export const PANEL_KEYBOARD_STEP = 16;

export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height?: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PanelState {
  x: number;
  y: number;
  width?: number;
  height?: number;
  collapsed: boolean;
  closed: boolean;
  zIndex: number;
}

export interface PersistedPanelLayout {
  version: number;
  topZ: number;
  panels: Record<string, PanelState>;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamps a panel's top-left coordinate so the full panel stays at least
 * `margin` px inside the viewport on every edge.
 */
export function clampPanelPosition(
  pos: PanelPosition,
  panelSize: { width: number; height: number },
  viewport: ViewportSize,
  margin = PANEL_VIEWPORT_MARGIN,
): PanelPosition {
  const safeWidth = Math.max(0, Number.isFinite(panelSize.width) ? panelSize.width : 0);
  const safeHeight = Math.max(0, Number.isFinite(panelSize.height) ? panelSize.height : 0);
  const safeVw = Math.max(margin * 2, Number.isFinite(viewport.width) ? viewport.width : 1024);
  const safeVh = Math.max(margin * 2, Number.isFinite(viewport.height) ? viewport.height : 768);

  const maxX = Math.max(margin, safeVw - safeWidth - margin);
  const maxY = Math.max(margin, safeVh - safeHeight - margin);

  return {
    x: Math.round(clampNumber(pos.x, margin, maxX)),
    y: Math.round(clampNumber(pos.y, margin, maxY)),
  };
}

/**
 * Clamps a panel position and snaps it to any viewport edge or corner
 * when dropped within `threshold` px of that edge (preserving `margin`).
 */
export function snapPanelPosition(
  pos: PanelPosition,
  panelSize: { width: number; height: number },
  viewport: ViewportSize,
  margin = PANEL_VIEWPORT_MARGIN,
  threshold = PANEL_SNAP_THRESHOLD,
): PanelPosition & { snapped: boolean } {
  const safeWidth = Math.max(0, Number.isFinite(panelSize.width) ? panelSize.width : 0);
  const safeHeight = Math.max(0, Number.isFinite(panelSize.height) ? panelSize.height : 0);
  const safeVw = Math.max(margin * 2, Number.isFinite(viewport.width) ? viewport.width : 1024);
  const safeVh = Math.max(margin * 2, Number.isFinite(viewport.height) ? viewport.height : 768);

  const maxX = Math.max(margin, safeVw - safeWidth - margin);
  const maxY = Math.max(margin, safeVh - safeHeight - margin);

  let x = clampNumber(pos.x, margin, maxX);
  let y = clampNumber(pos.y, margin, maxY);
  let snapped = false;

  if (Math.abs(x - margin) <= threshold) {
    x = margin;
    snapped = true;
  } else if (Math.abs(x - maxX) <= threshold) {
    x = maxX;
    snapped = true;
  }

  if (Math.abs(y - margin) <= threshold) {
    y = margin;
    snapped = true;
  } else if (Math.abs(y - maxY) <= threshold) {
    y = maxY;
    snapped = true;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    snapped,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizePanelState(raw: unknown, fallbackZ: number): PanelState | null {
  if (!isPlainRecord(raw)) return null;
  const x = raw.x;
  const y = raw.y;
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  if (typeof y !== "number" || !Number.isFinite(y)) return null;

  const width =
    typeof raw.width === "number" && Number.isFinite(raw.width) && raw.width >= 120 && raw.width <= 4096
      ? Math.round(raw.width)
      : undefined;
  const height =
    typeof raw.height === "number" && Number.isFinite(raw.height) && raw.height >= 80 && raw.height <= 4096
      ? Math.round(raw.height)
      : undefined;
  const zIndex =
    typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex) && raw.zIndex >= 1 && raw.zIndex <= 10000
      ? Math.round(raw.zIndex)
      : fallbackZ;

  return {
    x: Math.round(x),
    y: Math.round(y),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    collapsed: Boolean(raw.collapsed),
    closed: Boolean(raw.closed),
    zIndex,
  };
}

export function createEmptyPanelLayout(): PersistedPanelLayout {
  return {
    version: PANEL_LAYOUT_SCHEMA_VERSION,
    topZ: 1,
    panels: {},
  };
}

/**
 * Validates and parses a persisted layout JSON string from localStorage.
 * Corrupt JSON, unsupported schema versions, or invalid entries are safely ignored.
 */
export function parsePersistedPanelLayout(raw: string | null): PersistedPanelLayout {
  if (!raw) return createEmptyPanelLayout();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return createEmptyPanelLayout();
    if (parsed.version !== PANEL_LAYOUT_SCHEMA_VERSION) {
      return createEmptyPanelLayout();
    }
    if (!isPlainRecord(parsed.panels)) return createEmptyPanelLayout();

    const panels: Record<string, PanelState> = {};
    let maxZ = 1;
    let index = 1;

    for (const [id, entry] of Object.entries(parsed.panels)) {
      if (!id || id === "__proto__" || id === "constructor" || id === "prototype") continue;
      const clean = sanitizePanelState(entry, index);
      if (!clean) continue;
      panels[id] = clean;
      if (clean.zIndex > maxZ) maxZ = clean.zIndex;
      index += 1;
    }

    const rawTopZ =
      typeof parsed.topZ === "number" && Number.isFinite(parsed.topZ)
        ? Math.round(parsed.topZ)
        : maxZ;

    return {
      version: PANEL_LAYOUT_SCHEMA_VERSION,
      topZ: Math.max(maxZ, rawTopZ, 1),
      panels,
    };
  } catch {
    return createEmptyPanelLayout();
  }
}

export function readPersistedPanelLayout(): PersistedPanelLayout {
  if (typeof window === "undefined") return createEmptyPanelLayout();
  try {
    return parsePersistedPanelLayout(window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY));
  } catch {
    return createEmptyPanelLayout();
  }
}

export function writePersistedPanelLayout(layout: PersistedPanelLayout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}
