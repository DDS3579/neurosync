// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BRAIN_IMMERSIVE,
  DEFAULT_BRAIN_SIZE,
  UI_BRAIN_IMMERSIVE_KEY,
  UI_BRAIN_SIZE_KEY,
  readBrainImmersivePref,
  readBrainSizePref,
  writeBrainImmersivePref,
  writeBrainSizePref,
} from "./brainUiPrefs";

describe("brainUiPrefs localStorage helpers", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults immersive to true and size to 1.0 when unset or invalid", () => {
    expect(readBrainImmersivePref()).toBe(DEFAULT_BRAIN_IMMERSIVE);
    expect(readBrainSizePref()).toBe(DEFAULT_BRAIN_SIZE);

    window.localStorage.setItem(UI_BRAIN_IMMERSIVE_KEY, "{bad-json");
    window.localStorage.setItem(UI_BRAIN_SIZE_KEY, "not-a-number");

    expect(readBrainImmersivePref()).toBe(true);
    expect(readBrainSizePref()).toBe(1.0);
  });

  it("persists immersive boolean and clamps brain size to [0.5, 2.0]", () => {
    writeBrainImmersivePref(false);
    expect(readBrainImmersivePref()).toBe(false);

    writeBrainImmersivePref(true);
    expect(readBrainImmersivePref()).toBe(true);

    expect(writeBrainSizePref(3.2)).toBe(2.0);
    expect(readBrainSizePref()).toBe(2.0);

    expect(writeBrainSizePref(0.1)).toBe(0.5);
    expect(readBrainSizePref()).toBe(0.5);

    expect(writeBrainSizePref(1.45)).toBe(1.45);
    expect(readBrainSizePref()).toBe(1.45);
  });

  it("handles localStorage exceptions safely", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(readBrainImmersivePref()).toBe(true);
    expect(readBrainSizePref()).toBe(1.0);
    expect(() => writeBrainImmersivePref(false)).not.toThrow();
    expect(writeBrainSizePref(1.5)).toBe(1.5);
  });
});
