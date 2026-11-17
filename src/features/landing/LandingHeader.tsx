"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Minimal fixed top bar: NEUROSYNC mono wordmark left, Enter link to /overview right.
 * Hides on scroll down, shows on scroll up, and stays visible at top or when focused.
 */
export function LandingHeader() {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);
  const visibleRef = useRef(true);

  useEffect(() => {
    lastYRef.current = window.scrollY;
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const y = window.scrollY;
      const delta = y - lastYRef.current;

      let nextVisible = visibleRef.current;
      if (y < 48) {
        nextVisible = true;
      } else if (delta > 6 && y > 80) {
        nextVisible = false;
      } else if (delta < -6) {
        nextVisible = true;
      }

      if (nextVisible !== visibleRef.current) {
        visibleRef.current = nextVisible;
        setVisible(nextVisible);
      }
      lastYRef.current = y;
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      onFocusCapture={() => {
        if (!visibleRef.current) {
          visibleRef.current = true;
          setVisible(true);
        }
      }}
      className={`fixed inset-x-0 top-0 z-40 border-b border-white/[0.08] bg-[#060913]/75 backdrop-blur-md transition-transform duration-300 ease-out motion-reduce:transition-none ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5 sm:px-10 lg:px-16">
        <Link
          href="#top"
          className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6EAF5] transition-colors hover:text-[#22D3EE]"
        >
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full bg-[#22D3EE]"
          />
          NEUROSYNC
        </Link>

        <Link
          href="/overview"
          className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E6EAF5] transition-colors hover:border-[#22D3EE]/50 hover:text-[#22D3EE]"
        >
          Enter
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
