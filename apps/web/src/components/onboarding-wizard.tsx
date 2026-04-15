"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-client";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "gu", label: "Gujarati" },
  { code: "bn", label: "Bengali" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
];

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  employeeCode: string;
  designation: string;
  preferredLanguages: string[];
  branchName: string;
  assignedProducts: string;
  assignedGeographies: string;
}

export function OnboardingWizard(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    phone: "",
    employeeCode: "",
    designation: "",
    preferredLanguages: ["en"],
    branchName: "",
    assignedProducts: "",
    assignedGeographies: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function hydrate(): Promise<void> {
      try {
        const token = await getToken();
        if (!token) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
        const res = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          data?: { user?: { firstName?: string | null; lastName?: string | null } };
        };
        if (cancelled) return;
        setForm((prev) => ({
          ...prev,
          firstName: prev.firstName || body.data?.user?.firstName || "",
          lastName: prev.lastName || body.data?.user?.lastName || "",
        }));
      } catch {
        // best-effort prefill
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleLanguage = (code: string): void =>
    setForm((prev) => ({
      ...prev,
      preferredLanguages: prev.preferredLanguages.includes(code)
        ? prev.preferredLanguages.filter((c) => c !== code)
        : [...prev.preferredLanguages, code],
    }));

  const submit = async (): Promise<void> => {
    if (!form.firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (form.preferredLanguages.length === 0) {
      toast.error("Pick at least one language");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired. Please sign in again.");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/onboarding`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile: {
            firstName: form.firstName,
            lastName: form.lastName || undefined,
            phone: form.phone || undefined,
            employeeCode: form.employeeCode || undefined,
            designation: form.designation || undefined,
            preferredLanguages: form.preferredLanguages,
          },
          work: {
            assignedProducts: form.assignedProducts
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            assignedGeographies: form.assignedGeographies
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            branchName: form.branchName || undefined,
          },
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? `Onboarding failed (${res.status})`);
      }

      toast.success("Welcome! Your workspace is ready.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Let&apos;s finish setting up</CardTitle>
        <CardDescription>
          Step {step} of 2 — {step === 1 ? "Your profile" : "Work scope"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (for WhatsApp sharing)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+91…"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employeeCode">Employee code (optional)</Label>
                <Input
                  id="employeeCode"
                  value={form.employeeCode}
                  onChange={(e) => update("employeeCode", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation (optional)</Label>
                <Input
                  id="designation"
                  value={form.designation}
                  onChange={(e) => update("designation", e.target.value)}
                  placeholder="Branch Manager"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Languages you work in</Label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      form.preferredLanguages.includes(lang.code)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch name (optional)</Label>
              <Input
                id="branchName"
                value={form.branchName}
                onChange={(e) => update("branchName", e.target.value)}
                placeholder="Andheri West Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedProducts">Products you sell (comma-separated)</Label>
              <Textarea
                id="assignedProducts"
                value={form.assignedProducts}
                onChange={(e) => update("assignedProducts", e.target.value)}
                placeholder="Term Insurance, ULIP, Health Insurance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedGeographies">Geographies (comma-separated)</Label>
              <Textarea
                id="assignedGeographies"
                value={form.assignedGeographies}
                onChange={(e) => update("assignedGeographies", e.target.value)}
                placeholder="Mumbai, Thane, Navi Mumbai"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Setting up…" : "Finish setup"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
