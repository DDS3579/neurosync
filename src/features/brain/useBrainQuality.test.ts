import { describe, expect, it } from "vitest";

import { resolveReducedMotion } from "./useBrainQuality";

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
