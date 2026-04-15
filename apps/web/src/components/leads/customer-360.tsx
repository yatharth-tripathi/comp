"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  User2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LeadDetail {
  lead: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    age: number | null;
    gender: string | null;
    city: string | null;
    state: string | null;
    profession: string | null;
    incomeRange: string | null;
    existingInvestments: string[];
    dependents: number | null;
    riskAppetite: string | null;
    stage: string;
    source: string | null;
    lastActivityAt: string | null;
    nextFollowUpAt: string | null;
    aiSuggestedNextAction: string | null;
    closedAt: string | null;
    policyNumber: string | null;
    premiumValue: number | null;
    createdAt: string;
    agent: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
    activities: Array<{
      id: string;
      kind: string;
      notes: string | null;
      scheduledFor: string | null;
      completedAt: string | null;
      createdAt: string;
      metadata: Record<string, unknown>;
    }>;
  };
  contentShares: Array<{
    id: string;
    resourceKind: string;
    resourceTitle: string;
    channel: string;
    sharedAt: string;
    openCount: number;
    firstOpenedAt: string | null;
    shortCode: string;
  }>;
  illustrations: Array<{
    id: string;
    productType: string;
    shortCode: string;
    openCount: number;
    createdAt: string;
  }>;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-sky-500" },
  contacted: { label: "Contacted", color: "bg-blue-500" },
  interested: { label: "Interested", color: "bg-indigo-500" },
  meeting_scheduled: { label: "Meeting", color: "bg-violet-500" },
  proposal_sent: { label: "Proposal", color: "bg-purple-500" },
  under_consideration: { label: "Considering", color: "bg-amber-500" },
  closed_won: { label: "Closed Won", color: "bg-emerald-500" },
  closed_lost: { label: "Closed Lost", color: "bg-rose-500" },
  dormant: { label: "Dormant", color: "bg-gray-400" },
};

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  meeting: Calendar,
  content_share: FileText,
  illustration_share: Sparkles,
  note: FileText,
  follow_up: Clock,
  stage_change: CheckCircle2,
};

export function Customer360View({ data }: { data: LeadDetail }): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();
  const { lead, contentShares, illustrations } = data;
  const stageInfo = STAGE_LABELS[lead.stage] ?? STAGE_LABELS.new!;

  const [activityKind, setActivityKind] = useState("call");
  const [activityNotes, setActivityNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [logging, setLogging] = useState(false);

  const logActivity = async (): Promise<void> => {
    setLogging(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/leads/${lead.id}/activities`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: activityKind,
          notes: activityNotes || undefined,
          scheduledFor: followUpDate ? new Date(followUpDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed");
      }
      toast.success("Activity logged");
      setActivityNotes("");
      setFollowUpDate("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Main column */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-2xl font-bold text-white">
            {lead.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={`${stageInfo.color} text-white`}>{stageInfo.label}</Badge>
              {lead.source && <Badge variant="outline">{lead.source}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3 w-3" /> {lead.phone}
                </a>
              )}
              {lead.email && <span>{lead.email}</span>}
              {lead.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lead.city}{lead.state ? `, ${lead.state}` : ""}
                </span>
              )}
              {lead.profession && <span>{lead.profession}</span>}
              {lead.age && <span>{lead.age} yrs</span>}
            </div>
          </div>
        </div>

        {/* AI suggestion */}
        {lead.aiSuggestedNextAction && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" />
              AI suggested next action
            </div>
            <p className="mt-2 text-sm">{lead.aiSuggestedNextAction}</p>
          </div>
        )}

        {/* Quick activity logger */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Log activity</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["call", "whatsapp", "meeting", "note", "follow_up"].map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setActivityKind(kind)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                  activityKind === kind
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                {kind.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <Textarea
            className="mt-3"
            placeholder="Quick note…"
            value={activityNotes}
            onChange={(e) => setActivityNotes(e.target.value)}
            rows={2}
          />
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-[10px]">Schedule follow-up (optional)</Label>
              <Input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
            <Button onClick={logActivity} disabled={logging} className="mt-5">
              {logging ? "Logging…" : "Log"}
            </Button>
          </div>
        </div>

        {/* Activity timeline */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Timeline
          </h3>
          {lead.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities logged yet.</p>
          ) : (
            <div className="space-y-3">
              {lead.activities.map((act, idx) => {
                const Icon = ACTIVITY_ICONS[act.kind] ?? FileText;
                return (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex gap-3 rounded-xl border bg-card p-3"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {act.kind.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(act.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {act.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{act.notes}</p>
                      )}
                      {act.scheduledFor && (
                        <p className="mt-1 text-[10px] text-primary">
                          Scheduled: {new Date(act.scheduledFor).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="space-y-6">
        {/* Financial profile */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Financial profile
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <ProfileRow label="Income range" value={lead.incomeRange} />
            <ProfileRow label="Risk appetite" value={lead.riskAppetite} />
            <ProfileRow
              label="Dependents"
              value={lead.dependents !== null ? String(lead.dependents) : null}
            />
            {lead.existingInvestments.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Existing</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lead.existingInvestments.map((inv) => (
                    <Badge key={inv} variant="outline" className="text-[10px]">
                      {inv}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {lead.premiumValue !== null && lead.premiumValue > 0 && (
              <ProfileRow
                label="Premium value"
                value={`₹${lead.premiumValue.toLocaleString("en-IN")}`}
              />
            )}
            {lead.policyNumber && (
              <ProfileRow label="Policy #" value={lead.policyNumber} />
            )}
          </div>
        </div>

        {/* Content shared with this lead */}
        {contentShares.length > 0 && (
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Content shared
            </h3>
            <div className="mt-3 space-y-2">
              {contentShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{share.resourceTitle}</div>
                    <div className="text-muted-foreground">
                      {new Date(share.sharedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                      {share.openCount > 0 && (
                        <span className="ml-2 font-semibold text-emerald-600">
                          Opened {share.openCount}×
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/s/${share.shortCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Illustrations */}
        {illustrations.length > 0 && (
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Illustrations
            </h3>
            <div className="mt-3 space-y-2">
              {illustrations.map((ill) => (
                <div
                  key={ill.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-xs"
                >
                  <div>
                    <div className="font-medium capitalize">
                      {ill.productType.replace(/_/g, " ")}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(ill.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                      {ill.openCount > 0 && (
                        <span className="ml-2 font-semibold text-emerald-600">
                          Opened {ill.openCount}×
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/i/${ill.shortCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="space-y-2">
          {lead.phone && (
            <a
              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp {lead.fullName.split(" ")[0]}
            </a>
          )}
          <a
            href={`/copilot?customer=${encodeURIComponent(lead.fullName)}&mode=pre_meeting`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-accent"
          >
            <Sparkles className="h-4 w-4" />
            Brief me for this customer
          </a>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }): JSX.Element | null {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
