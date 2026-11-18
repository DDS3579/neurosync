import { describe, expect, it } from "vitest";

import {
  computeCappedDpr,
  normalizeTextSize,
  resolveHighContrast,
  resolveReducedMotion,
  shouldDowngradeFps,
} from "./useBrainQuality";

describe("resolveReducedMotion", () => {
  it("returns true when OS is false and user setting is true", () => {
    expect(resolveReducedMotion(false, true)).toBe(true);
  });

  it("returns true when OS is true and user setting is false or undefined", () => {
    expect(resolveReducedMotion(true, false)).toBe(true);
    expect(resolveReducedMotion(true, undefined)).toBe(true);
  });

  it("returns true when both OS and user setting are true", () => {
    expect(resolveReducedMotion(true, true)).toBe(true);
  });

  it("returns false when both OS and user setting are false or undefined", () => {
    expect(resolveReducedMotion(false, false)).toBe(false);
    expect(resolveReducedMotion(false, undefined)).toBe(false);
  });
});

describe("resolveHighContrast & normalizeTextSize", () => {
  it("resolves high contrast from OS media queries or UserSettings", () => {
    expect(resolveHighContrast(false, false, false)).toBe(false);
    expect(resolveHighContrast(true, false, false)).toBe(true);
    expect(resolveHighContrast(false, true, false)).toBe(true);
    expect(resolveHighContrast(false, false, true)).toBe(true);
  });

  it("normalizes text size to sm, md, or lg", () => {
    expect(normalizeTextSize("sm")).toBe("sm");
    expect(normalizeTextSize("md")).toBe("md");
    expect(normalizeTextSize("lg")).toBe("lg");
    expect(normalizeTextSize("unknown")).toBe("md");
    expect(normalizeTextSize(undefined)).toBe("md");
  });
});

describe("computeCappedDpr & shouldDowngradeFps", () => {
  it("caps DPR per quality tier and handles invalid inputs safely", () => {
    expect(computeCappedDpr(3, "high")).toBe(1.5);
    expect(computeCappedDpr(1.25, "high")).toBe(1.25);
    expect(computeCappedDpr(2, "low")).toBe(1);
    expect(computeCappedDpr(Number.NaN, "high")).toBe(1);
  });

  it("steps down only in auto mode from high tier when average FPS drops below 45", () => {
    expect(shouldDowngradeFps(38, "auto", "high")).toBe(true);
    expect(shouldDowngradeFps(45, "auto", "high")).toBe(false);
    expect(shouldDowngradeFps(30, "high", "high")).toBe(false);
    expect(shouldDowngradeFps(20, "auto", "low")).toBe(false);
  });
});
