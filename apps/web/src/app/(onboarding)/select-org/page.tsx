import { CreateOrganization } from "@clerk/nextjs";

export const metadata = { title: "Create your workspace" };

export default function SelectOrgPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is your company space on SalesContent AI. You can invite teammates next.
          </p>
        </div>
        <CreateOrganization afterCreateOrganizationUrl="/onboarding" skipInvitationScreen />
      </div>
    </main>
  );
}
