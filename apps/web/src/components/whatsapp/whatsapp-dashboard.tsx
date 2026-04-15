"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Bot,
  MessageCircle,
  Phone,
  Send,
  Smartphone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
}

interface Props {
  templates: Template[];
}

/**
 * WhatsApp admin dashboard — templates, quick send, broadcast, and bot info.
 *
 * Three sections:
 *   1. Bot status + intents overview — what agents can text the bot
 *   2. Quick send — send a text or template to a specific number
 *   3. Templates — list of synced Meta-approved templates
 */
export function WhatsAppDashboard({ templates }: Props): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [sendPhone, setSendPhone] = useState("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);

  const [bcTemplateId, setBcTemplateId] = useState(templates[0]?.id ?? "");
  const [bcPhones, setBcPhones] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  const quickSend = async (): Promise<void> => {
    if (!sendPhone.trim() || !sendText.trim()) {
      toast.error("Phone and message are required");
      return;
    }
    setSending(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/whatsapp/send-text`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ toPhone: sendPhone, text: sendText }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Send failed");
      }
      toast.success("Message sent");
      setSendText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const broadcast = async (): Promise<void> => {
    if (!bcTemplateId || !bcPhones.trim()) {
      toast.error("Select a template and enter phone numbers");
      return;
    }
    const phones = bcPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      toast.error("No valid phone numbers");
      return;
    }
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/whatsapp/broadcast`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          templateId: bcTemplateId,
          recipientPhones: phones,
          variables: {},
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Broadcast failed");
      }
      const { data } = (await res.json()) as {
        data: { sent: number; failed: number; total: number };
      };
      setBroadcastResult(data);
      toast.success(`Broadcast complete: ${data.sent} sent, ${data.failed} failed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent bot, outbound sends, templates, and broadcasts — all via Meta Cloud API.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bot info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Agent WhatsApp Bot — 5 intents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Agents text the SalesContent AI number and get content, illustrations, leads,
              reels, and objection handlers without opening the app. Intent parsing by Claude Haiku — works in English, Hindi, and Hinglish.
            </p>
            <div className="grid gap-3 md:grid-cols-5">
              {[
                {
                  icon: <MessageCircle className="h-4 w-4" />,
                  label: "Content search",
                  example: '"Send me LIC poster Hindi"',
                },
                {
                  icon: <Smartphone className="h-4 w-4" />,
                  label: "Illustration",
                  example: '"Create illustration term plan 35 male 1cr"',
                },
                {
                  icon: <Users className="h-4 w-4" />,
                  label: "My leads",
                  example: '"My leads today"',
                },
                {
                  icon: <Phone className="h-4 w-4" />,
                  label: "New reel",
                  example: '"New reel"',
                },
                {
                  icon: <Send className="h-4 w-4" />,
                  label: "Objection",
                  example: '"Objection: too expensive"',
                },
              ].map((intent) => (
                <motion.div
                  key={intent.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border bg-muted/30 p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {intent.icon}
                    {intent.label}
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {intent.example}
                  </p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick send */}
        <Card>
          <CardHeader>
            <CardTitle>Quick send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input
                value={sendPhone}
                onChange={(e) => setSendPhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                placeholder="Hi, here's the illustration you asked about…"
                rows={3}
              />
            </div>
            <Button onClick={quickSend} disabled={sending} className="w-full">
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : "Send via WhatsApp"}
            </Button>
          </CardContent>
        </Card>

        {/* Broadcast */}
        <Card>
          <CardHeader>
            <CardTitle>Broadcast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates synced yet. Enterprise admins can add them via the API.
                </p>
              ) : (
                <select
                  value={bcTemplateId}
                  onChange={(e) => setBcTemplateId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language}) — {t.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phone numbers (one per line or comma-separated)</Label>
              <Textarea
                value={bcPhones}
                onChange={(e) => setBcPhones(e.target.value)}
                placeholder={"+919876543210\n+919876543211\n+919876543212"}
                rows={4}
              />
            </div>
            <Button
              onClick={broadcast}
              disabled={broadcasting || templates.length === 0}
              className="w-full"
            >
              <Users className="h-4 w-4" />
              {broadcasting ? "Broadcasting…" : "Send broadcast"}
            </Button>
            {broadcastResult && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="font-semibold text-emerald-600">{broadcastResult.sent} sent</span>
                {broadcastResult.failed > 0 && (
                  <span className="ml-2 font-semibold text-rose-600">
                    {broadcastResult.failed} failed
                  </span>
                )}
                <span className="ml-2 text-muted-foreground">
                  of {broadcastResult.total} total
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Templates list */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Synced templates
          </h2>
          <div className="divide-y rounded-2xl border bg-card">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {t.bodyText}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t.language}</Badge>
                  <Badge variant="outline">{t.category}</Badge>
                  <Badge
                    variant={t.status === "APPROVED" ? "success" : "secondary"}
                  >
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
