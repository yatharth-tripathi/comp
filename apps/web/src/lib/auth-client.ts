"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Minimal client-side auth hook. Replaces `@clerk/nextjs`'s useAuth/useUser —
 * the API is intentionally kept compatible so feature components don't have
 * to change their call sites.
 *
 * `getToken()` fetches the current session JWT from the same-origin web API
 * route, which reads the HttpOnly cookie. Returns null if not authenticated.
 */
export function useAuth(): {
  getToken: () => Promise<string | null>;
} {
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/token", { cache: "no-store" });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { token: string | null } };
      return body.data?.token ?? null;
    } catch {
      return null;
    }
  }, []);
  return { getToken };
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
  role: string;
}

export interface SessionTenant {
  id: string;
  slug: string;
  name: string;
}

export interface MeResponse {
  user: SessionUser;
  tenant: SessionTenant;
}

/**
 * Fetches the signed-in user + tenant from the web origin. Returns null when
 * the session is missing or expired.
 */
export function useSessionUser(): { data: MeResponse | null; loading: boolean } {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const body = (await res.json()) as { data?: MeResponse };
        if (!cancelled) setData(body.data ?? null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  window.location.href = "/sign-in";
}
