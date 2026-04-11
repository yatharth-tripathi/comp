import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Immersive layout — full-viewport pages with no chrome.
 * Used for the Reels feed and the Reels creator (Session 04) and later for
 * the role-play runner (Session 06) and the Copilot meeting overlay (Session 07).
 *
 * Auth is still enforced; tenant context still comes from Clerk.
 */
export default async function ImmersiveLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");
  return <div className="h-[100dvh] w-full overflow-hidden bg-black">{children}</div>;
}
