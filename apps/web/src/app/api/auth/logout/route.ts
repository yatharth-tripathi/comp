import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function POST(): Promise<NextResponse> {
  const token = cookies().get(SESSION_COOKIE)?.value;

  if (token) {
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ data: { ok: true } });
}
