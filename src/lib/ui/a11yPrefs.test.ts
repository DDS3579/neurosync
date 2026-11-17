// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_UI_A11Y_PREFS,
  UI_A11Y_STORAGE_KEY,
  readUiA11yPrefs,
  writeUiA11yPrefs,
} from "./a11yPrefs";

describe("a11yPrefs localStorage helper", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns safe defaults when storage is empty or malformed", () => {
    expect(readUiA11yPrefs()).toEqual(DEFAULT_UI_A11Y_PREFS);

    window.localStorage.setItem(UI_A11Y_STORAGE_KEY, "{not-valid-json");
    expect(readUiA11yPrefs()).toEqual(DEFAULT_UI_A11Y_PREFS);

    window.localStorage.setItem(UI_A11Y_STORAGE_KEY, JSON.stringify({ textSize: "huge" }));
    expect(readUiA11yPrefs()).toEqual({
      reducedMotion: false,
      highContrast: false,
      textSize: "md",
    });
  });

  it("round-trips valid preferences under the versioned key", () => {
    writeUiA11yPrefs({
      reducedMotion: true,
      highContrast: true,
      textSize: "lg",
    });

    expect(readUiA11yPrefs()).toEqual({
      reducedMotion: true,
      highContrast: true,
      textSize: "lg",
    });
  });

  it("swallows storage access exceptions safely", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(readUiA11yPrefs()).toEqual(DEFAULT_UI_A11Y_PREFS);
    expect(() =>
      writeUiA11yPrefs({ reducedMotion: true, highContrast: false, textSize: "sm" }),
    ).not.toThrow();
  });
});
