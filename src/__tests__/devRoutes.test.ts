import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("@/app/(app)/dev-brain/DevBrainClient", () => ({
  default: function DevBrainClientStub() {
    return null;
  },
}));

vi.mock("@/app/(app)/dev-overview/DevOverviewClient", () => ({
  default: function DevOverviewClientStub() {
    return null;
  },
}));

vi.mock("@/app/(app)/dev-ui/DevUiClient", () => ({
  default: function DevUiClientStub() {
    return null;
  },
}));

import DevBrainPage from "@/app/(app)/dev-brain/page";
import DevOverviewPage from "@/app/(app)/dev-overview/page";
import DevUiPage from "@/app/(app)/dev-ui/page";
import {
  ALL_NAV_ITEMS,
  MOBILE_NAV_ITEMS,
  NAV_GROUPS,
  routeTitle,
} from "@/components/app-shell/nav-items";

const DEV_ROUTES = ["/dev-brain", "/dev-overview", "/dev-ui"] as const;

describe("dev-only route gating", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
    notFoundMock.mockClear();
  });

  it("calls notFound() on /dev-brain, /dev-overview, and /dev-ui in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => DevBrainPage()).toThrow("NEXT_NOT_FOUND");
    expect(() => DevOverviewPage()).toThrow("NEXT_NOT_FOUND");
    expect(() => DevUiPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(3);
  });

  it("allows /dev-brain, /dev-overview, and /dev-ui outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() => DevBrainPage()).not.toThrow();
    expect(() => DevOverviewPage()).not.toThrow();
    expect(() => DevUiPage()).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("excludes dev routes from navigation, command palette, manifest, and service worker", () => {
    const navHrefs = [
      ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
      ...ALL_NAV_ITEMS.map((i) => i.href),
      ...MOBILE_NAV_ITEMS.map((i) => i.href),
    ];

    for (const route of DEV_ROUTES) {
      expect(navHrefs).not.toContain(route);
      expect(routeTitle(route)).toBe("NeuroSync");
    }

    const commandPaletteSource = readFileSync(
      resolve(process.cwd(), "src/components/app-shell/command-palette.tsx"),
      "utf8",
    );
    const swSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    const manifestSource = readFileSync(resolve(process.cwd(), "src/app/manifest.ts"), "utf8");

    for (const route of DEV_ROUTES) {
      expect(commandPaletteSource).not.toContain(route);
      expect(swSource).not.toContain(route);
      expect(manifestSource).not.toContain(route);
    }

    const sitemapPath = resolve(process.cwd(), "src/app/sitemap.ts");
    if (existsSync(sitemapPath)) {
      const sitemapSource = readFileSync(sitemapPath, "utf8");
      for (const route of DEV_ROUTES) {
        expect(sitemapSource).not.toContain(route);
      }
    }
  });
});
