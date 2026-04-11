import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const metadata = {
  title: "Welcome — SalesContent AI",
};

/**
 * Onboarding is reached after Clerk sign-up OR after accepting an invite.
 * We push users into Clerk's CreateOrganization flow first, then bring them
 * here to complete the tenant + profile setup.
 */
export default async function OnboardingPage(): Promise<JSX.Element> {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <OnboardingWizard />
    </main>
  );
}
