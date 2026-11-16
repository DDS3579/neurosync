"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Observes an element once via IntersectionObserver and returns true once visible,
 * or immediately returns true when `disabled` (e.g. `prefers-reduced-motion`).
 */
export function useInViewOnce(
  ref: RefObject<HTMLElement | null>,
  { threshold = 0.25, disabled = false }: { threshold?: number; disabled?: boolean } = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, disabled]);

  return disabled || inView;
}
