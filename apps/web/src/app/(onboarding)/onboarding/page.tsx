import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getServerSession } from "@/lib/session";

export const metadata = {
  title: "Welcome — SalesContent AI",
};

/**
 * Onboarding — finalise the freshly signed-up user's profile and optional
 * branch. Runs once, after /auth/signup.
 */
export default async function OnboardingPage(): Promise<JSX.Element> {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <OnboardingWizard />
    </main>
  );
}
