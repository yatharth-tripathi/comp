"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  computeSip,
  getDisclaimersForProduct,
  type SipInput,
} from "@salescontent/finance";
import { IllustrationPreview } from "./illustration-preview";
import { SharePanel } from "./share-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SipBuilder(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [customerName, setCustomerName] = useState("Priya Nair");
  const [monthlyAmount, setMonthlyAmount] = useState(10_000);
  const [durationYears, setDurationYears] = useState(15);
  const [expectedReturn, setExpectedReturn] = useState(12);
  const [goalLabel, setGoalLabel] = useState("Retirement");

  const [submitting, setSubmitting] = useState(false);
  const [sharePayload, setSharePayload] = useState<{ publicUrl: string } | null>(null);

  const input: SipInput = {
    customerName,
    monthlyAmount,
    durationYears,
    expectedReturnPct: expectedReturn,
    goalLabel,
  };

  const preview = useMemo(() => {
    const out = computeSip(input);
    const disclaimers = getDisclaimersForProduct("sip");
    return {
      sections: [
        {
          heading: "You Invest",
          rows: [
            { label: "Monthly SIP", value: `₹${out.monthlyAmount.toLocaleString("en-IN")}` },
            { label: "Duration", value: `${out.durationYears} years` },
            {
              label: "Total invested",
              value: `₹${out.totalInvested.toLocaleString("en-IN")}`,
            },
          ],
        },
        {
          heading: "You Get (at assumed return)",
          rows: [
            {
              label: "Maturity value",
              value: `₹${out.maturityValue.toLocaleString("en-IN")}`,
            },
            {
              label: "Wealth gained",
              value: `₹${out.wealthGained.toLocaleString("en-IN")}`,
            },
            {
              label: "Multiplier",
              value: `${out.wealthMultiplier.toFixed(2)}×`,
            },
            {
              label: "Real purchasing power (after 6% inflation)",
              value: `₹${out.realPurchasingPower.toLocaleString("en-IN")}`,
            },
          ],
        },
      ],
      chartData: out.projection.map((p) => ({
        year: p.year,
        paid: p.invested,
        value: p.corpus,
      })),
      comparisons: out.scenarios.map((s) => ({
        product: s.label,
        returns: `₹${s.maturityValue.toLocaleString("en-IN")}`,
      })),
      disclaimers: disclaimers.disclaimers,
      regime: disclaimers.regime,
      assumptions: out.assumptions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName, monthlyAmount, durationYears, expectedReturn, goalLabel]);

  const generate = async (): Promise<void> => {
    if (!customerName.trim()) { toast.error("Customer name required"); return; }
    setSubmitting(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/illustrations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productType: "sip", input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Failed");
      }
      const { data } = (await res.json()) as { data: { publicUrl: string } };
      setSharePayload({ publicUrl: data.publicUrl });
      toast.success("Illustration ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SIP / Mutual Fund</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Closed-form compound math. SEBI-mandated 4% / 8% / 12% illustration rates included.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="name">Customer name</Label>
            <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Goal</Label>
            <Input
              id="goal"
              value={goalLabel}
              onChange={(e) => setGoalLabel(e.target.value)}
              placeholder="Retirement, daughter's college, dream home…"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Monthly SIP · ₹{monthlyAmount.toLocaleString("en-IN")}
            </Label>
            <input
              type="range"
              min={500}
              max={200_000}
              step={500}
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Duration · {durationYears} yrs</Label>
              <input
                type="range"
                min={1}
                max={40}
                value={durationYears}
                onChange={(e) => setDurationYears(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <Label>Assumed return · {expectedReturn}%</Label>
              <input
                type="range"
                min={4}
                max={18}
                step={0.5}
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>

        <Button onClick={generate} disabled={submitting} className="w-full">
          {submitting ? "Generating…" : "Generate & share"}
        </Button>
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Live preview
        </h2>
        <IllustrationPreview
          productType="sip"
          payload={preview}
          comparisonTitle="SEBI-mandated illustration at 4% / 8% / 12%"
        />
      </div>

      {sharePayload && (
        <SharePanel
          customerName={customerName}
          publicUrl={sharePayload.publicUrl}
          onClose={() => setSharePayload(null)}
          onContinue={() => router.push("/illustrator")}
        />
      )}
    </div>
  );
}
