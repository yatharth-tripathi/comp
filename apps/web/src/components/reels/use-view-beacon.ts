"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef } from "react";

/**
 * Sends progress beacons to /api/reels/:id/view at key completion milestones.
 * The server dedupes so we can fire the same threshold multiple times without
 * inflating counters.
 *
 * Milestones:
 *   - 0%    — fires once on play-start
 *   - 25%   — when the viewer has consumed a quarter
 *   - 50%, 75%, 95% (completion) — same
 *
 * We use sendBeacon on page-hide so we capture the final state even when
 * the user closes the tab mid-reel.
 */
const MILESTONES_BPS = [0, 2_500, 5_000, 7_500, 9_500] as const;

export function useViewBeacon(reelId: string) {
  const { getToken } = useAuth();
  const firedRef = useRef<Set<number>>(new Set());
  const lastPositionRef = useRef<number>(0);
  const lastCompletionRef = useRef<number>(0);

  const send = useCallback(
    async (completionPctBps: number, lastPositionSec: number) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const body = JSON.stringify({
        startedAtMs: Date.now(),
        lastPositionSec: Math.max(0, Math.floor(lastPositionSec)),
        completionPctBps,
        deviceKind:
          typeof window !== "undefined" && "ontouchstart" in window ? "mobile" : "desktop",
      });
      try {
        const token = await getToken();
        await fetch(`${apiUrl}/api/reels/${reelId}/view`, {
          method: "POST",
          keepalive: true,
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body,
        });
      } catch {
        // Beacons are best-effort; swallow errors.
      }
    },
    [getToken, reelId],
  );

  const trackProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!duration || Number.isNaN(duration)) return;
      const completionPctBps = Math.min(10_000, Math.round((currentTime / duration) * 10_000));
      lastPositionRef.current = currentTime;
      lastCompletionRef.current = completionPctBps;

      for (const threshold of MILESTONES_BPS) {
        if (completionPctBps >= threshold && !firedRef.current.has(threshold)) {
          firedRef.current.add(threshold);
          void send(completionPctBps, currentTime);
        }
      }
    },
    [send],
  );

  // Flush on unmount / page hide
  useEffect(() => {
    const onHide = (): void => {
      if (lastCompletionRef.current > 0 && !firedRef.current.has(lastCompletionRef.current)) {
        void send(lastCompletionRef.current, lastPositionRef.current);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [send]);

  return { trackProgress };
}
