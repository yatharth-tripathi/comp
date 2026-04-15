"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          tenantSlug: tenantSlug.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(body.error?.message ?? `Sign-in failed (${res.status})`);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-ink-line bg-ink-raised">
      <CardHeader>
        <CardTitle className="font-display text-display-md">Sign in</CardTitle>
        <CardDescription className="text-fog">
          Welcome back. Enter the credentials your admin provisioned.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant" className="flex items-center justify-between">
              <span>Workspace slug</span>
              <span className="label-mono text-fog-dim">OPTIONAL</span>
            </Label>
            <Input
              id="tenant"
              placeholder="hdfc-life"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
            />
            <p className="text-body-sm text-fog">
              Only needed if your email is active in more than one workspace.
            </p>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-body-sm text-fog">
            No workspace yet?{" "}
            <a href="/sign-up" className="text-saffron hover:underline">
              Create one
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
