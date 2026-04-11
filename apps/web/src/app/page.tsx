import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LandingPage(): Promise<JSX.Element> {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">S</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">SalesContent AI</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Sales enablement that your field agents actually use.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          AI-powered content library, WhatsApp-native distribution, real-time coaching, and
          compliance built in. Purpose-built for Indian BFSI, Insurance, Pharma, and Automotive
          field sales teams.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Start free
          </Link>
          <a
            href="https://github.com/yatharth-tripathi/comp"
            className="text-base font-medium text-muted-foreground hover:text-foreground"
          >
            View on GitHub →
          </a>
        </div>
      </section>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Aarambh Labs · SalesContent AI
      </footer>
    </main>
  );
}
