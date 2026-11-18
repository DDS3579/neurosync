import { describe, expect, it } from "vitest";

import {
  BRAIN_SIZE_DEFAULT,
  BRAIN_SIZE_MAX,
  BRAIN_SIZE_MIN,
  clampBrainSize,
  classifyWheelIntent,
  computeFitCameraDistance,
  computeWheelSizeDelta,
  shouldHandleBrainShortcut,
} from "./brainControls";

describe("brainControls pure logic", () => {
  it("clamps brain size strictly within [0.5, 2.0] and handles non-finite inputs", () => {
    expect(clampBrainSize(0.1)).toBe(BRAIN_SIZE_MIN);
    expect(clampBrainSize(0.5)).toBe(0.5);
    expect(clampBrainSize(1.234)).toBe(1.23);
    expect(clampBrainSize(2.0)).toBe(BRAIN_SIZE_MAX);
    expect(clampBrainSize(4.5)).toBe(BRAIN_SIZE_MAX);
    expect(clampBrainSize(Number.NaN)).toBe(BRAIN_SIZE_DEFAULT);
    expect(clampBrainSize(Number.POSITIVE_INFINITY)).toBe(BRAIN_SIZE_DEFAULT);
  });

  it("computes clamped wheel size deltas for Ctrl+wheel and trackpad pinch", () => {
    // Negative deltaY (pinch out / scroll up) enlarges the brain
    expect(computeWheelSizeDelta(-40, 1.0)).toBe(1.1);
    // Positive deltaY (pinch in / scroll down) shrinks the brain
    expect(computeWheelSizeDelta(40, 1.0)).toBe(0.9);
    // Caps large deltas and stays within bounds
    expect(computeWheelSizeDelta(-1000, 1.9)).toBe(2.0);
    expect(computeWheelSizeDelta(1000, 0.6)).toBe(0.5);
    expect(computeWheelSizeDelta(0, 1.25)).toBe(1.25);
  });

  it("classifies wheel intent for floating panels, ctrl+wheel resize, and plain zoom", () => {
    expect(classifyWheelIntent({ ctrlKey: false, isOverPanel: false })).toBe("zoom");
    expect(classifyWheelIntent({ ctrlKey: true, isOverPanel: false })).toBe("resize");
    expect(classifyWheelIntent({ ctrlKey: false, isOverPanel: true })).toBe("ignore");
    expect(classifyWheelIntent({ ctrlKey: true, isOverPanel: true })).toBe("ignore");
  });

  it("computes responsive fit-to-screen camera distance across aspects and sizes", () => {
    const desktop1x = computeFitCameraDistance(1.0, 16 / 9);
    const desktop2x = computeFitCameraDistance(2.0, 16 / 9);
    const portrait1x = computeFitCameraDistance(1.0, 9 / 19.5);

    expect(desktop2x).toBeGreaterThan(desktop1x);
    expect(portrait1x).toBeGreaterThan(desktop1x);
    expect(computeFitCameraDistance(0.5, 16 / 9)).toBeGreaterThanOrEqual(1.45);
  });

  it("guards keyboard shortcuts when typing, adjusting sliders, or inside dialogs", () => {
    expect(
      shouldHandleBrainShortcut({
        key: "f",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        targetTagName: "BODY",
        isDialogOpen: false,
      }),
    ).toBe(true);

    expect(
      shouldHandleBrainShortcut({
        key: "+",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        targetTagName: "INPUT",
        isDialogOpen: false,
      }),
    ).toBe(false);

    expect(
      shouldHandleBrainShortcut({
        key: "ArrowRight",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        targetRole: "slider",
        isDialogOpen: false,
      }),
    ).toBe(false);

    expect(
      shouldHandleBrainShortcut({
        key: "0",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        targetTagName: "DIV",
        isDialogOpen: true,
      }),
    ).toBe(false);

    expect(
      shouldHandleBrainShortcut({
        key: "=",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        targetTagName: "DIV",
        isDialogOpen: false,
      }),
    ).toBe(false);
  });
});
