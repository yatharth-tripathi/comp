import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // mirrors API default

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: string;
  exp: number;
}

function secret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("JWT_SECRET must be set (≥32 chars) on the web app to verify session cookies");
  }
  return new TextEncoder().encode(raw);
}

/**
 * Read and cryptographically verify the session cookie. Returns null when the
 * cookie is absent or invalid — callers decide whether to redirect.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const { userId, tenantId, role, exp } = payload as Record<string, unknown>;
    if (
      typeof userId !== "string" ||
      typeof tenantId !== "string" ||
      typeof role !== "string" ||
      typeof exp !== "number"
    ) {
      return null;
    }
    return { userId, tenantId, role, exp };
  } catch {
    return null;
  }
}

/**
 * Read the raw session token (for Bearer forwarding to the Hono API).
 */
export function getServerSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}
