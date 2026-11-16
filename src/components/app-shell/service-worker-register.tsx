"use client";

import { useEffect } from "react";

/**
 * Registers the offline-shell service worker once on the client.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Ignore registration failures in unsupported or private browsing contexts.
      });
  }, []);

  return null;
}
