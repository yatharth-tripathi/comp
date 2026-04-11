import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/s/:shortCode", // public share-link redirect pages
  "/i/:shortCode", // illustration public view
  "/api/public/(.*)",
]);

/**
 * Clerk middleware + tenant subdomain routing.
 *
 * Two responsibilities:
 *  1. Enforce auth on every non-public route.
 *  2. Parse the host header into a tenant slug and forward it via
 *     `x-tenant-slug`, so server components and API route handlers can
 *     pick it up without another round trip.
 */
export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") ?? "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "salescontent.ai";

  let tenantSlug = "";
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const parts = host.split(".");
    if (host.endsWith(rootDomain) && parts.length >= 3) {
      tenantSlug = parts[0] ?? "";
    }
  }

  const requestHeaders = new Headers(req.headers);
  if (tenantSlug) requestHeaders.set("x-tenant-slug", tenantSlug);

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run middleware on API routes
    "/(api|trpc)(.*)",
  ],
};
