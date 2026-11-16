"use client";

import { useEffect } from "react";

/**
 * Registers the offline-shell service worker in production, and cleans up any
 * previously registered worker/caches in development so `next dev` chunks stay fresh.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) void caches.delete(key);
        });
      }
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Ignore registration failures in unsupported or private browsing contexts.
      });
  }, []);

  return null;
}
