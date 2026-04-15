import { NextResponse } from "next/server";
import { getServerSessionToken } from "@/lib/session";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export async function GET(): Promise<NextResponse> {
  const token = getServerSessionToken();
  if (!token) return NextResponse.json({ data: null }, { status: 401 });

  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const raw = await res.text();
  const parsed = raw ? (JSON.parse(raw) as unknown) : null;
  return NextResponse.json(parsed, { status: res.status });
}
