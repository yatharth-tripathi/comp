"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  computeHealthInsurance,
  getDisclaimersForProduct,
  type HealthInsuranceInput,
  type Relation,
} from "@salescontent/finance";
import { IllustrationPreview } from "./illustration-preview";
import { SharePanel } from "./share-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Member {
  relation: Relation;
  age: number;
}

const RELATION_LABELS: Record<Relation, string> = {
  self: "Self",
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
};

export function HealthInsuranceBuilder(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [customerName, setCustomerName] = useState("Sunita Iyer");
  const [policyType, setPolicyType] = useState<"individual" | "floater">("floater");
  const [sumInsured, setSumInsured] = useState(1_000_000);
  const [family, setFamily] = useState<Member[]>([
    { relation: "self", age: 38 },
    { relation: "spouse", age: 36 },
    { relation: "child", age: 8 },
  ]);
  const [opd, setOpd] = useState(false);
  const [maternity, setMaternity] = useState(false);
  const [criticalIllness, setCriticalIllness] = useState(false);
  const [roomUpgrade, setRoomUpgrade] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sharePayload, setSharePayload] = useState<{ publicUrl: string } | null>(null);

  const input: HealthInsuranceInput = {
    customerName,
    policyType,
    family,
    sumInsured,
    addons: { opd, maternity, criticalIllness, roomUpgrade },
  };

  const preview = useMemo(() => {
    const out = computeHealthInsurance(input);
    const disclaimers = getDisclaimersForProduct("health_insurance");
    return {
      sections: [
        {
          heading: "You Pay",
          rows: [
            {
              label: "Annual premium (incl. GST)",
              value: `₹${out.premiumWithGst.toLocaleString("en-IN")}`,
            },
            { label: "Monthly", value: `₹${out.monthlyPremium.toLocaleString("en-IN")}` },
            { label: "Base premium", value: `₹${out.annualPremium.toLocaleString("en-IN")}` },
            { label: "GST (18%)", value: `₹${out.gstAmount.toLocaleString("en-IN")}` },
          ],
        },
        {
          heading: "You Get",
          rows: [
            {
              label: "Sum insured",
              value: `₹${(out.sumInsured / 100_000).toFixed(0)} L`,
            },
            {
              label: "Policy type",
              value: out.policyType === "floater" ? "Family floater" : "Individual",
            },
            { label: "Members covered", value: String(out.memberCount) },
            { label: "Cashless hospitals", value: `${out.coverage.cashlessHospitals}+` },
            {
              label: "Room rent limit",
              value: out.coverage.roomRentLimit,
            },
          ],
        },
      ],
      chartData: out.scenarioComparisons.map((s, i) => ({
        year: i,
        paid: s.sumInsured,
        value: s.annualPremium,
      })),
      comparisons: out.breakdown.baseByMember.map((m) => ({
        product: `${RELATION_LABELS[m.relation]} · age ${m.age}`,
        returns: `₹${m.premium.toLocaleString("en-IN")}`,
      })),
      disclaimers: disclaimers.disclaimers,
      regime: disclaimers.regime,
      assumptions: out.assumptions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerName,
    policyType,
    sumInsured,
    family,
    opd,
    maternity,
    criticalIllness,
    roomUpgrade,
  ]);

  const generate = async (): Promise<void> => {
    if (!customerName.trim()) return toast.error("Customer name required");
    if (family.length === 0) return toast.error("Add at least one member");
    setSubmitting(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/illustrations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ productType: "health_insurance", input }),
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

  const addMember = (): void =>
    setFamily((f) => [...f, { relation: "child", age: 10 }]);
  const removeMember = (idx: number): void =>
    setFamily((f) => f.filter((_, i) => i !== idx));
  const updateMember = (idx: number, patch: Partial<Member>): void =>
    setFamily((f) => f.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Health Insurance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Family-floater vs individual, age-banded per-member premiums, add-on stacking.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="space-y-2">
            <Label>Customer name</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Policy type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["floater", "individual"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPolicyType(t)}
                  className={`rounded-md border px-3 py-2 text-sm capitalize ${
                    policyType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Sum insured · ₹{(sumInsured / 100_000).toFixed(0)} L
            </Label>
            <input
              type="range"
              min={300_000}
              max={10_000_000}
              step={100_000}
              value={sumInsured}
              onChange={(e) => setSumInsured(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Family members
            </h3>
            <button
              type="button"
              onClick={addMember}
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {family.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={m.relation}
                onChange={(e) =>
                  updateMember(i, { relation: e.target.value as Relation })
                }
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {(Object.keys(RELATION_LABELS) as Relation[]).map((r) => (
                  <option key={r} value={r}>
                    {RELATION_LABELS[r]}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                max={100}
                value={m.age}
                onChange={(e) =>
                  updateMember(i, { age: parseInt(e.target.value || "0", 10) })
                }
                className="w-20"
              />
              <button
                type="button"
                onClick={() => removeMember(i)}
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Remove member"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-2xl border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add-ons
          </h3>
          <AddonToggle label="OPD cover (+26%)" checked={opd} onChange={setOpd} />
          <AddonToggle
            label="Maternity (+18%)"
            checked={maternity}
            onChange={setMaternity}
          />
          <AddonToggle
            label="Critical illness (+21%)"
            checked={criticalIllness}
            onChange={setCriticalIllness}
          />
          <AddonToggle
            label="Single private room, no rent cap (+9%)"
            checked={roomUpgrade}
            onChange={setRoomUpgrade}
          />
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
          productType="health_insurance"
          payload={preview}
          comparisonTitle="Per-member base premium breakdown"
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

function AddonToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md p-1 text-sm hover:bg-accent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
