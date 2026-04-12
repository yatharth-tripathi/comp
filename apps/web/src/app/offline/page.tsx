import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline — SalesContent AI" };

export default function OfflinePage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm space-y-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-muted">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          SalesContent AI needs an internet connection for real-time features like
          content sharing, illustrations, and the Copilot. Please check your connection
          and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
