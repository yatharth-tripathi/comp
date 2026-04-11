"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown on the public /s/:shortCode page. Lets the customer request a
 * callback, which stamps callbackRequestedAt on the share event so the agent
 * can act. This is the final conversion step in PRD §10.4.
 */
export function ShareCallbackButton({ shortCode }: { shortCode: string }): JSX.Element {
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const request = async (): Promise<void> => {
    setBusy(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/public/shares/${shortCode}/callback-request`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Could not request callback");
      setRequested(true);
      toast.success("Callback requested. Your agent will get in touch shortly.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (requested) {
    return (
      <p className="text-sm text-muted-foreground">
        ✓ Callback requested — your agent will reach out shortly.
      </p>
    );
  }

  return (
    <Button size="lg" onClick={request} disabled={busy}>
      <PhoneCall className="h-4 w-4" />
      Request a callback
    </Button>
  );
}
