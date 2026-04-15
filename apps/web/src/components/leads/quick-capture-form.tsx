"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Quick capture form — designed for speed. Name + phone creates the lead.
 * Everything else (age, income, profession, risk) is optional and can be
 * filled later from the Customer 360 view.
 *
 * This is the "salesman in the field" form: you just met someone at a
 * seminar, they handed you a business card, and you need to log them
 * before the next person walks up.
 */
export function QuickCaptureForm(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [profession, setProfession] = useState("");
  const [source, setSource] = useState("manual");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    if (!fullName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/leads`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone || undefined,
          email: email || undefined,
          city: city || undefined,
          profession: profession || undefined,
          source,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed");
      }
      const { data } = (await res.json()) as { data: { id: string } };
      toast.success("Lead captured. You can add details later.");
      router.push(`/leads/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New lead</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ravi Kumar"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ravi@email.com"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Mumbai"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profession">Profession</Label>
            <Input
              id="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="IT Manager"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Source</Label>
          <div className="flex flex-wrap gap-1.5">
            {["manual", "card_scan", "campaign", "qr", "web_form"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                  source === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Capture lead"}
        </Button>
      </CardContent>
    </Card>
  );
}
