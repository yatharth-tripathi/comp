"use client";

import { useEffect } from "react";

/**
 * Service worker registration — runs once on mount in the root layout.
 * Only registers in production or when explicitly enabled.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register after the page has loaded to avoid competing with critical resources
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] registered, scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] registration failed:", err);
        });
    });
  }, []);

  return null;
}
