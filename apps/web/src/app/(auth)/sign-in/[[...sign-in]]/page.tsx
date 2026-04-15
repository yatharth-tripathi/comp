import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-12 text-parchment">
      <SignInForm />
    </main>
  );
}
