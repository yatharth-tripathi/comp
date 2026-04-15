import { NextResponse } from "next/server";
import { getServerSessionToken } from "@/lib/session";

/**
 * Returns the current session token so client components can forward it as a
 * Bearer to the Hono API. The cookie stays HttpOnly — we expose the token on
 * demand, which matches the same threat model as Clerk's `getToken()`.
 */
export async function GET(): Promise<NextResponse> {
  const token = getServerSessionToken();
  if (!token) return NextResponse.json({ data: { token: null } }, { status: 401 });
  return NextResponse.json({ data: { token } });
}
