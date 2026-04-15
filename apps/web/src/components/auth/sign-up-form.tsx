"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PLAN_TIERS = ["starter", "growth", "professional", "enterprise"] as const;

export function SignUpForm(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    companyName: "",
    planTier: "growth" as (typeof PLAN_TIERS)[number],
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          company: {
            name: form.companyName.trim(),
            planTier: form.planTier,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(body.error?.message ?? `Sign-up failed (${res.status})`);
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-xl border-ink-line bg-ink-raised">
      <CardHeader>
        <CardTitle className="font-display text-display-md">Create your workspace</CardTitle>
        <CardDescription className="text-fog">
          One tenant, one admin. You can invite your team from the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                required
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
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
            <p className="text-body-sm text-fog">Minimum 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              required
              placeholder="HDFC Life Insurance"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Plan tier</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {PLAN_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => update("planTier", tier)}
                  className={`rounded-sm border px-3 py-2 text-body-sm capitalize transition ${
                    form.planTier === tier
                      ? "border-saffron bg-saffron/10 text-saffron"
                      : "border-ink-line hover:border-fog"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating workspace…" : "Create workspace"}
          </Button>
          <p className="text-center text-body-sm text-fog">
            Already have one?{" "}
            <a href="/sign-in" className="text-saffron hover:underline">
              Sign in
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
