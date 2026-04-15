import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sc_session";

const publicPathPatterns = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/s\/.*/,
  /^\/i\/.*/,
  /^\/api\/auth\/(login|signup)$/,
  /^\/api\/public\/.*/,
];

function isPublic(pathname: string): boolean {
  return publicPathPatterns.some((re) => re.test(pathname));
}

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("JWT_SECRET must be set on the web app");
  return new TextEncoder().encode(raw);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "salescontent.ai";

  let tenantSlug = "";
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const parts = host.split(".");
    if (host.endsWith(rootDomain) && parts.length >= 3) {
      tenantSlug = parts[0] ?? "";
    }
  }

  const forwardedHeaders = new Headers(request.headers);
  if (tenantSlug) forwardedHeaders.set("x-tenant-slug", tenantSlug);

  if (isPublic(url.pathname)) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  if (!(await hasValidSession(request))) {
    const signIn = new URL("/sign-in", request.url);
    const ret = url.pathname + url.search;
    if (ret && ret !== "/") signIn.searchParams.set("return_to", ret);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
