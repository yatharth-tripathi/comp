"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  computeTermPlan,
  getDisclaimersForProduct,
  type TermPlanInput,
} from "@salescontent/finance";
import { IllustrationPreview } from "./illustration-preview";
import { SharePanel } from "./share-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Term Plan Illustrator builder page.
 *
 * Live preview is 100% client-side — the SAME pure function from
 * `@salescontent/finance/term-plan` runs in the browser as runs on the
 * server. What the agent sees while tweaking the form is byte-identical
 * to what the server persists on submit.
 */
export function TermPlanBuilder(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [customerName, setCustomerName] = useState("Ravi Kumar");
  const [customerAge, setCustomerAge] = useState(32);
  const [customerGender, setCustomerGender] = useState<"male" | "female" | "other">("male");
  const [smoker, setSmoker] = useState(false);
  const [sumAssured, setSumAssured] = useState(10_000_000); // ₹1 Cr
  const [policyTerm, setPolicyTerm] = useState(30);
  const [premiumTerm, setPremiumTerm] = useState(30);
  const [accidentalDeath, setAccidentalDeath] = useState(false);
  const [criticalIllness, setCriticalIllness] = useState(false);
  const [waiver, setWaiver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sharePayload, setSharePayload] = useState<{
    shortCode: string;
    publicUrl: string;
  } | null>(null);

  const input: TermPlanInput = {
    customerName,
    customerAge,
    customerGender,
    smoker,
    sumAssured,
    policyTermYears: policyTerm,
    premiumPaymentTermYears: Math.min(premiumTerm, policyTerm),
    riders: {
      accidentalDeath,
      criticalIllness,
      waiverOfPremium: waiver,
    },
  };

  const { preview, output } = useMemo(() => {
    const out = computeTermPlan(input);
    const disclaimers = getDisclaimersForProduct("term_plan");
    return {
      output: out,
      preview: {
        sections: [
          {
            heading: "You Pay",
            rows: [
              { label: "Annual premium", value: `₹${out.annualPremium.toLocaleString("en-IN")}` },
              { label: "Monthly", value: `₹${out.monthlyPremium.toLocaleString("en-IN")}` },
              {
                label: "Cost per ₹1L of cover",
                value: `₹${out.costPerLakhPerYear}/yr`,
              },
              {
                label: "Total over term",
                value: `₹${out.totalPremiumPaid.toLocaleString("en-IN")}`,
              },
            ],
          },
          {
            heading: "You Get",
            rows: [
              {
                label: "Life cover",
                value: `₹${out.sumAssured.toLocaleString("en-IN")}`,
              },
              { label: "Term", value: `${policyTerm} years` },
              { label: "Premium paying term", value: `${premiumTerm} years` },
            ],
          },
        ],
        chartData: out.projection.map((p) => ({
          year: p.year,
          paid: p.cumulativePremiumPaid,
          value: p.deathBenefit,
        })),
        comparisons: out.comparison.map((c) => ({
          product: c.product,
          returns:
            c.returnAfterTerm !== null
              ? `₹${c.returnAfterTerm.toLocaleString("en-IN")}`
              : c.deathBenefit !== null
                ? `Family gets ₹${c.deathBenefit.toLocaleString("en-IN")}`
                : "—",
        })),
        disclaimers: disclaimers.disclaimers,
        regime: disclaimers.regime,
        assumptions: out.assumptions,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerName,
    customerAge,
    customerGender,
    smoker,
    sumAssured,
    policyTerm,
    premiumTerm,
    accidentalDeath,
    criticalIllness,
    waiver,
  ]);

  const generateAndShare = async (): Promise<void> => {
    if (!customerName.trim()) {
      toast.error("Customer name required");
      return;
    }
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
        body: JSON.stringify({
          productType: "term_plan",
          input,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Failed to generate");
      }
      const { data } = (await res.json()) as {
        data: { id: string; shortCode: string; publicUrl: string };
      };
      setSharePayload({ shortCode: data.shortCode, publicUrl: data.publicUrl });
      toast.success("Illustration generated. Share it with your customer.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* ─── Form ─── */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Term Insurance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real premium math calibrated to 2024 retail rates. Every number updates as you type.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="name">Customer name</Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={18}
                max={75}
                value={customerAge}
                onChange={(e) => setCustomerAge(parseInt(e.target.value || "30", 10))}
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="flex gap-1">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setCustomerGender(g)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize ${
                      customerGender === g
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smoker}
              onChange={(e) => setSmoker(e.target.checked)}
              className="h-4 w-4"
            />
            Tobacco user (premium ×1.6)
          </label>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="sa">
              Sum assured · ₹{(sumAssured / 100_000).toFixed(1)} L
            </Label>
            <input
              id="sa"
              type="range"
              min={2_500_000}
              max={100_000_000}
              step={500_000}
              value={sumAssured}
              onChange={(e) => setSumAssured(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>₹25 L</span>
              <span>₹10 Cr</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Policy term · {policyTerm} yrs</Label>
              <input
                type="range"
                min={10}
                max={40}
                value={policyTerm}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setPolicyTerm(v);
                  if (premiumTerm > v) setPremiumTerm(v);
                }}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <Label>Premium paying · {premiumTerm} yrs</Label>
              <input
                type="range"
                min={5}
                max={policyTerm}
                value={premiumTerm}
                onChange={(e) => setPremiumTerm(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Riders
          </h3>
          <RiderToggle
            label="Accidental death benefit"
            sub="+8% premium"
            checked={accidentalDeath}
            onChange={setAccidentalDeath}
          />
          <RiderToggle
            label="Critical illness"
            sub="+14% premium · covers cancer, heart attack, stroke"
            checked={criticalIllness}
            onChange={setCriticalIllness}
          />
          <RiderToggle
            label="Waiver of premium"
            sub="+3.5% · waives future premiums on disability"
            checked={waiver}
            onChange={setWaiver}
          />
        </div>

        <Button onClick={generateAndShare} disabled={submitting} className="w-full">
          {submitting ? "Generating…" : "Generate & share"}
        </Button>
      </div>

      {/* ─── Live preview ─── */}
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview — updates as you type
          </h2>
          <span className="text-[10px] text-muted-foreground">
            Base ₹{output.breakdown.baseAnnualPremium.toLocaleString("en-IN")} ·
            Smoker +₹{output.breakdown.smokerSurcharge.toLocaleString("en-IN")} ·
            Riders +₹{output.breakdown.riderTotal.toLocaleString("en-IN")}
          </span>
        </div>
        <IllustrationPreview productType="term_plan" payload={preview} />
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

function RiderToggle({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-accent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </label>
  );
}
