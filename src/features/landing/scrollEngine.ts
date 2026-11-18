"use client";

export interface GsapScrollTriggerModules {
  gsap: typeof import("gsap").default;
  ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
}

export interface ScrollEngineModules extends GsapScrollTriggerModules {
  Lenis: typeof import("lenis").default;
}

let gsapPromise: Promise<GsapScrollTriggerModules> | null = null;
let enginePromise: Promise<ScrollEngineModules> | null = null;

/**
 * Lazily loads and registers GSAP + ScrollTrigger once on demand.
 */
export function loadGsapScrollTrigger(): Promise<GsapScrollTriggerModules> {
  if (!gsapPromise) {
    gsapPromise = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapMod, stMod]) => {
        const gsap = gsapMod.default;
        const ScrollTrigger = stMod.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);
        return { gsap, ScrollTrigger };
      },
    );
  }
  return gsapPromise;
}

/**
 * Lazily loads GSAP ScrollTrigger + Lenis together when the first scroll-driven
 * section or smooth-scroll navigation needs them.
 */
export function loadScrollEngine(): Promise<ScrollEngineModules> {
  if (!enginePromise) {
    enginePromise = Promise.all([loadGsapScrollTrigger(), import("lenis")]).then(
      ([gsapMods, lenisMod]) => ({
        ...gsapMods,
        Lenis: lenisMod.default,
      }),
    );
  }
  return enginePromise;
}

export function isScrollKey(key: string): boolean {
  return (
    key === "ArrowDown" ||
    key === "ArrowUp" ||
    key === "PageDown" ||
    key === "PageUp" ||
    key === "Space" ||
    key === " " ||
    key === "End" ||
    key === "Home"
  );
}
