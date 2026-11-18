export const BRAIN_SIZE_MIN = 0.5;
export const BRAIN_SIZE_MAX = 2.0;
export const BRAIN_SIZE_DEFAULT = 1.0;
export const BRAIN_SIZE_STEP = 0.05;

export type WheelIntent = "ignore" | "resize" | "zoom";

/**
 * Clamps a brain scale value into [0.5, 2.0] and rounds to 2 decimals.
 * Non-finite inputs fall back to 1.0.
 */
export function clampBrainSize(value: number): number {
  if (!Number.isFinite(value)) return BRAIN_SIZE_DEFAULT;
  const clamped = Math.min(BRAIN_SIZE_MAX, Math.max(BRAIN_SIZE_MIN, value));
  return Math.round(clamped * 100) / 100;
}

/**
 * Maps a wheel `deltaY` with Ctrl/pinch held to the next damped brain size.
 * Scrolling up (`deltaY < 0`) grows the brain; scrolling down (`deltaY > 0`) shrinks it.
 */
export function computeWheelSizeDelta(deltaY: number, currentSize: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clampBrainSize(currentSize);
  // Cap large mouse wheel spikes while keeping trackpad pinch deltas responsive.
  const normalizedDelta = Math.max(-120, Math.min(120, deltaY));
  const step = -normalizedDelta * 0.0025;
  return clampBrainSize(currentSize + step);
}

/**
 * Decides how a wheel event inside the Brain Explorer stage should be handled:
 * - Events originating inside floating panels (`isOverPanel`) scroll normally ("ignore").
 * - Events with `ctrlKey` held (Ctrl+wheel or browser-synthesized trackpad pinch) resize the brain ("resize").
 * - Plain wheel events over the canvas pass through to OrbitControls camera zoom ("zoom").
 */
export function classifyWheelIntent(input: {
  ctrlKey: boolean;
  isOverPanel: boolean;
}): WheelIntent {
  if (input.isOverPanel) return "ignore";
  if (input.ctrlKey) return "resize";
  return "zoom";
}

/**
 * Checks whether a DOM event target sits inside a floating panel or overlay dialog
 * where wheel events must behave normally instead of zooming/resizing the 3D stage.
 */
export function isTargetInsideBrainPanel(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      '[data-brain-panel="true"], [role="dialog"], [role="alertdialog"], [data-slot="select-content"], [data-slot="dialog-content"], [data-slot="sheet-content"]',
    ),
  );
}

/**
 * Computes an ideal camera distance so the normalized brain (~radius 1.05 * brainSize)
 * fits comfortably inside the viewport for both wide desktop and narrow mobile aspect ratios.
 */
export function computeFitCameraDistance(
  brainSize: number,
  aspect: number,
  fovDeg = 42,
): number {
  const safeSize = clampBrainSize(brainSize);
  const safeAspect = Number.isFinite(aspect) && aspect > 0.2 ? aspect : 1;
  const vFovRad = (fovDeg * Math.PI) / 180;
  const halfTanV = Math.tan(vFovRad / 2);
  const halfTanH = halfTanV * safeAspect;
  const limitingHalfTan = Math.min(halfTanV, halfTanH);
  // Brain spans roughly [-1.05, 1.05] normalized units; add ~35% breathing room for overlays.
  const radius = 1.08 * safeSize;
  const ideal = (radius * 1.35) / Math.max(0.15, limitingHalfTan);
  return Math.min(6.2, Math.max(1.45, Math.round(ideal * 100) / 100));
}

/**
 * Guards global Brain Explorer keyboard shortcuts so typing in inputs or using
 * sliders/dialogs never triggers camera shortcuts.
 */
export function shouldHandleBrainShortcut(input: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTagName?: string | null;
  targetRole?: string | null;
  isContentEditable?: boolean;
  isDialogOpen: boolean;
}): boolean {
  if (input.isDialogOpen) return false;
  if (input.ctrlKey || input.metaKey || input.altKey) return false;

  const tag = (input.targetTagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (input.isContentEditable) return false;
  if (input.targetRole === "slider" || input.targetRole === "textbox") return false;

  return (
    input.key === "+" ||
    input.key === "=" ||
    input.key === "-" ||
    input.key === "_" ||
    input.key === "0" ||
    input.key === "f" ||
    input.key === "F" ||
    input.key === "ArrowLeft" ||
    input.key === "ArrowRight" ||
    input.key === "ArrowUp" ||
    input.key === "ArrowDown"
  );
}
