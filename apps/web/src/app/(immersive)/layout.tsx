import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

/**
 * Immersive layout — full-viewport pages with no chrome.
 * Used for the Reels feed, Reels creator, the role-play runner, and the
 * Copilot meeting overlay. Auth is still enforced.
 */
export default async function ImmersiveLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");
  return <div className="h-[100dvh] w-full overflow-hidden bg-black">{children}</div>;
}
