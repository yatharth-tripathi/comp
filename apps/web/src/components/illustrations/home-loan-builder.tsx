"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  computeHomeLoan,
  getDisclaimersForProduct,
  type HomeLoanInput,
} from "@salescontent/finance";
import { IllustrationPreview } from "./illustration-preview";
import { SharePanel } from "./share-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function HomeLoanBuilder(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [customerName, setCustomerName] = useState("Amit Desai");
  const [propertyValue, setPropertyValue] = useState(10_000_000);
  const [loanAmount, setLoanAmount] = useState(8_000_000);
  const [tenure, setTenure] = useState(20);
  const [rate, setRate] = useState(8.65);

  const [submitting, setSubmitting] = useState(false);
  const [sharePayload, setSharePayload] = useState<{ publicUrl: string } | null>(null);

  const input: HomeLoanInput = {
    customerName,
    propertyValue,
    loanAmount,
    tenureYears: tenure,
    interestRatePct: rate,
    processingFeePct: 0.5,
  };

  const preview = useMemo(() => {
    const out = computeHomeLoan(input);
    const disclaimers = getDisclaimersForProduct("home_loan");
    return {
      sections: [
        {
          heading: "Monthly burden",
          rows: [
            { label: "EMI", value: `₹${out.emi.toLocaleString("en-IN")}` },
            { label: "Interest rate", value: `${out.interestRatePct.toFixed(2)}% p.a.` },
            { label: "Loan-to-value", value: `${out.ltv}%` },
          ],
        },
        {
          heading: "Total outgo",
          rows: [
            {
              label: "Total payment",
              value: `₹${out.totalPayment.toLocaleString("en-IN")}`,
            },
            {
              label: "Total interest",
              value: `₹${out.totalInterest.toLocaleString("en-IN")}`,
            },
            {
              label: "Processing fee",
              value: `₹${out.processingFee.toLocaleString("en-IN")}`,
            },
            {
              label: `If you prepay ₹${out.prepaymentBenefit.lumpSumAmount.toLocaleString("en-IN")} at year ${out.prepaymentBenefit.lumpSumAtYear}`,
              value: `Save ₹${out.prepaymentBenefit.interestSaved.toLocaleString("en-IN")}`,
            },
          ],
        },
      ],
      chartData: out.amortization.map((a) => ({
        year: a.year,
        paid: a.principalPaid,
        value: a.interestPaid,
      })),
      comparisons: out.rateSensitivity.map((rs) => ({
        product: rs.label,
        returns: `EMI ₹${rs.emi.toLocaleString("en-IN")}`,
      })),
      disclaimers: disclaimers.disclaimers,
      regime: disclaimers.regime,
      assumptions: out.assumptions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName, propertyValue, loanAmount, tenure, rate]);

  const generate = async (): Promise<void> => {
    if (!customerName.trim()) { toast.error("Customer name required"); return; }
    if (loanAmount > propertyValue) { toast.error("Loan amount cannot exceed property value"); return; }
    setSubmitting(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/illustrations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ productType: "home_loan", input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed");
      }
      const { data } = (await res.json()) as { data: { publicUrl: string } };
      setSharePayload({ publicUrl: data.publicUrl });
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
          <h1 className="text-2xl font-semibold tracking-tight">Home Loan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Exact EMI math with month-by-month amortization, rate-sensitivity table, and a
            prepayment-benefit simulation.
          </p>
        </div>
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="space-y-2">
            <Label>Customer name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Property value · ₹{(propertyValue / 100_000).toFixed(1)} L</Label>
            <input
              type="range"
              min={500_000}
              max={100_000_000}
              step={250_000}
              value={propertyValue}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setPropertyValue(v);
                if (loanAmount > v) setLoanAmount(Math.floor(v * 0.8));
              }}
              className="w-full accent-primary"
            />
          </div>
          <div className="space-y-2">
            <Label>Loan amount · ₹{(loanAmount / 100_000).toFixed(1)} L</Label>
            <input
              type="range"
              min={100_000}
              max={propertyValue}
              step={100_000}
              value={loanAmount}
              onChange={(e) => setLoanAmount(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tenure · {tenure} yrs</Label>
              <input
                type="range"
                min={1}
                max={30}
                value={tenure}
                onChange={(e) => setTenure(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <Label>Rate · {rate.toFixed(2)}%</Label>
              <input
                type="range"
                min={6}
                max={14}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
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
          productType="home_loan"
          payload={preview}
          chartLabels={{ paid: "Principal paid", value: "Interest paid" }}
          comparisonTitle="What if the rate changes"
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
