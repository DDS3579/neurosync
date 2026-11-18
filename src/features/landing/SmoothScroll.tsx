"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type Lenis from "lenis";

import { usePrefersReducedMotion } from "@/features/brain/useBrainQuality";
import { isScrollKey, loadScrollEngine } from "./scrollEngine";

interface SmoothScrollContextValue {
  scrollTo: (target: string | number | HTMLElement, offset?: number) => void;
  scrollReady: boolean;
  ensureScrollEngine: () => void;
  setScrollLocked: (locked: boolean) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  scrollTo: () => {},
  scrollReady: false,
  ensureScrollEngine: () => {},
  setScrollLocked: () => {},
});

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

/**
 * Defers loading Lenis + GSAP ScrollTrigger until the user scrolls, jumps to a hash,
 * or triggers smooth navigation — keeping the initial hero bundle light.
 * Disabled automatically when `prefers-reduced-motion: reduce` is active.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);
  const lockedRef = useRef(false);
  const [activated, setActivated] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);

  const setScrollLocked = useCallback((locked: boolean) => {
    lockedRef.current = locked;
    const lenis = lenisRef.current;
    if (lenis) {
      if (locked) lenis.stop();
      else lenis.start();
    }
  }, []);

  const ensureScrollEngine = useCallback(() => {
    if (!reducedMotion) {
      setActivated(true);
    }
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || activated) return;
    if (typeof window === "undefined") return;

    if (window.scrollY > 4 || Boolean(window.location.hash)) {
      const id = window.requestAnimationFrame(() => setActivated(true));
      return () => window.cancelAnimationFrame(id);
    }

    const triggerActivation = () => {
      if (lockedRef.current) return;
      setActivated(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (lockedRef.current) return;
      if (isScrollKey(event.key)) {
        setActivated(true);
      }
    };

    window.addEventListener("wheel", triggerActivation, { passive: true, once: true });
    window.addEventListener("touchmove", triggerActivation, { passive: true, once: true });
    window.addEventListener("scroll", triggerActivation, { passive: true, once: true });
    window.addEventListener("hashchange", triggerActivation, { passive: true, once: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });

    return () => {
      window.removeEventListener("wheel", triggerActivation);
      window.removeEventListener("touchmove", triggerActivation);
      window.removeEventListener("scroll", triggerActivation);
      window.removeEventListener("hashchange", triggerActivation);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [reducedMotion, activated]);

  useEffect(() => {
    if (reducedMotion) {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      return;
    }

    if (!activated) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void loadScrollEngine().then(({ gsap, ScrollTrigger, Lenis: LenisCtor }) => {
      if (cancelled) return;

      const lenis = new LenisCtor({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      if (lockedRef.current) {
        lenis.stop();
      }
      lenisRef.current = lenis;

      const handleScroll = () => {
        ScrollTrigger.update();
      };
      lenis.on("scroll", handleScroll);

      const tick = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      setScrollReady(true);

      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.off("scroll", handleScroll);
        lenis.destroy();
        lenisRef.current = null;
      };
    });

    return () => {
      cancelled = true;
      setScrollReady(false);
      cleanup?.();
    };
  }, [reducedMotion, activated]);

  const scrollTo = useCallback(
    (target: string | number | HTMLElement, offset = 0) => {
      const nativeScroll = () => {
        if (typeof target === "number") {
          window.scrollTo({
            top: target + offset,
            behavior: reducedMotion ? "auto" : "smooth",
          });
          return;
        }

        const el =
          typeof target === "string"
            ? document.querySelector<HTMLElement>(target)
            : target;
        if (!el) return;

        const top = el.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({
          top,
          behavior: reducedMotion ? "auto" : "smooth",
        });
      };

      if (reducedMotion) {
        nativeScroll();
        return;
      }

      setActivated(true);
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target, { offset });
        return;
      }

      // Start scrolling immediately if Lenis is still loading, and ensure engine mounts.
      nativeScroll();
      void loadScrollEngine().then(() => {
        if (lenisRef.current) {
          lenisRef.current.scrollTo(target, { offset });
        }
      });
    },
    [reducedMotion],
  );

  return (
    <SmoothScrollContext.Provider
      value={{
        scrollTo,
        scrollReady: !reducedMotion && scrollReady,
        ensureScrollEngine,
        setScrollLocked,
      }}
    >
      {children}
    </SmoothScrollContext.Provider>
  );
}
