"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { useSmoothScroll } from "./SmoothScroll";
import { loadGsapScrollTrigger } from "./scrollEngine";

const PROGRESS_EPSILON = 0.003;

export interface UseScrollProgressOptions {
  start?: string | number | (() => string | number);
  end?: string | number | (() => string | number);
  disabled?: boolean;
  /** Changing this key forces the ScrollTrigger to recreate cleanly (e.g. responsive end). */
  refreshKey?: string | number | boolean;
}

/**
 * Tracks a ScrollTrigger's 0..1 progress in a ref and flushes into React state
 * via requestAnimationFrame only when it has changed by more than 0.003.
 * Defers loading GSAP ScrollTrigger until SmoothScroll activates.
 */
export function useScrollProgress(
  trigger: RefObject<HTMLElement | null>,
  {
    start = "top top",
    end = "bottom bottom",
    disabled = false,
    refreshKey,
  }: UseScrollProgressOptions = {},
): number {
  const { scrollReady } = useSmoothScroll();
  const [progress, setProgress] = useState(0);
  const latestRef = useRef(0);
  const committedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelPending = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    if (disabled) {
      cancelPending();
      latestRef.current = 0;
      if (committedRef.current !== 0) {
        committedRef.current = 0;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setProgress(0);
        });
      }
      return cancelPending;
    }

    if (!scrollReady) return cancelPending;

    const el = trigger.current;
    if (!el) return;

    let cancelled = false;
    let killTrigger: (() => void) | undefined;

    const flush = () => {
      rafRef.current = null;
      const next = latestRef.current;
      const atBoundary =
        (next === 0 && committedRef.current !== 0) ||
        (next === 1 && committedRef.current !== 1);
      if (Math.abs(next - committedRef.current) > PROGRESS_EPSILON || atBoundary) {
        committedRef.current = next;
        setProgress(next);
      }
    };

    const scheduleFlush = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    };

    void loadGsapScrollTrigger().then(({ ScrollTrigger }) => {
      if (cancelled) return;

      const st = ScrollTrigger.create({
        trigger: el,
        start,
        end,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          latestRef.current = self.progress;
          scheduleFlush();
        },
        onRefresh: (self) => {
          latestRef.current = self.progress;
          scheduleFlush();
        },
      });

      ScrollTrigger.refresh();
      latestRef.current = st.progress;
      scheduleFlush();
      killTrigger = () => st.kill();
    });

    return () => {
      cancelled = true;
      cancelPending();
      killTrigger?.();
    };
    // `start`/`end` may be inline functions or primitives; `refreshKey` controls intentional rebinds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, disabled, refreshKey, scrollReady]);

  return progress;
}
