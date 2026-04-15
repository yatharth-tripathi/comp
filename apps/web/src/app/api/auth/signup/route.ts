import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const res = await fetch(`${apiUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await res.text();
  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

  if (!res.ok) {
    return NextResponse.json(parsed, { status: res.status });
  }

  const data = parsed.data as {
    token: string;
    expiresAt: string;
    user: Record<string, unknown>;
  };

  cookies().set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ data: { user: data.user } }, { status: 201 });
}
