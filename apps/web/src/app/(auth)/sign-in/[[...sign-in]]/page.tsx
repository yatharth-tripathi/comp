import { SignIn } from "@clerk/nextjs";

export default function SignInPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SignIn path="/sign-in" />
    </div>
  );
}
