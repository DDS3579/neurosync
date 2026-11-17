import { describe, expect, it } from "vitest";

import {
  normalizeTextSize,
  resolveHighContrast,
  resolveReducedMotion,
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
