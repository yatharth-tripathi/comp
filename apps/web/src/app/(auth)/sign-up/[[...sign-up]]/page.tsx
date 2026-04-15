import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Sign up" };

export default function SignUpPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-12 text-parchment">
      <SignUpForm />
    </main>
  );
}
