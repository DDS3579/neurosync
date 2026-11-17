"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface InViewSectionProps {
  id: string;
  minHeightClass: string;
  children: ReactNode;
}

/**
 * Delays mounting a `next/dynamic` below-the-fold section until it approaches
 * the viewport (`rootMargin: "450px 0px"`) or its anchor hash is targeted.
 */
export function InViewSection({ id, minHeightClass, children }: InViewSectionProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    if (typeof window === "undefined") return;

    const hashMatches = () => window.location.hash === `#${id}`;
    if (hashMatches()) {
      const frame = window.requestAnimationFrame(() => setMounted(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const onHashChange = () => {
      if (hashMatches()) setMounted(true);
    };
    window.addEventListener("hashchange", onHashChange);

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setMounted(true));
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("hashchange", onHashChange);
      };
    }

    const el = sentinelRef.current;
    if (!el) {
      return () => window.removeEventListener("hashchange", onHashChange);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "450px 0px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [id, mounted]);

  if (mounted) {
    return <>{children}</>;
  }

  return (
    <div
      id={id}
      ref={sentinelRef}
      aria-hidden="true"
      className={`relative z-10 w-full border-t border-white/[0.08] bg-[#060913] ${minHeightClass}`}
    />
  );
}
