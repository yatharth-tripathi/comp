"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Building2,
  Calendar,
  FileText,
  Key,
  Plus,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  tenant: Record<string, unknown> | null;
  apiKeys: Array<Record<string, unknown>>;
  campaigns: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
}

export function AdminPanelView({ tenant, apiKeys, campaigns, auditLogs }: Props): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  const createApiKey = async (): Promise<void> => {
    if (!newKeyName.trim()) { toast.error("Key name required"); return; }
    setCreatingKey(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/api-keys`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed");
      }
      const { data } = (await res.json()) as { data: { rawKey: string } };
      setNewKeySecret(data.rawKey);
      toast.success("API key created. Copy it now — it won't be shown again.");
      setNewKeyName("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setCreatingKey(false);
    }
  };

  const tenantName = String((tenant as { name?: string })?.name ?? "Your workspace");
  const planTier = String((tenant as { planTier?: string })?.planTier ?? "—");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tenant settings, API keys, campaigns, user management, and audit trail.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tenant info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="secondary" className="capitalize">
                {planTier}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4" />
              API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {newKeySecret && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30"
              >
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Copy this key — it won&apos;t be shown again:
                </div>
                <code className="mt-1 block break-all font-mono text-emerald-900 dark:text-emerald-100">
                  {newKeySecret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(newKeySecret);
                    toast.success("Copied");
                  }}
                  className="mt-2 text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300"
                >
                  Copy to clipboard
                </button>
              </motion.div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">New API key</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Production integration"
                />
              </div>
              <Button size="sm" onClick={createApiKey} disabled={creatingKey}>
                <Plus className="h-3.5 w-3.5" />
                Create
              </Button>
            </div>

            {apiKeys.length > 0 && (
              <div className="divide-y rounded-md border text-xs">
                {apiKeys.map((key) => (
                  <div key={String(key.id)} className="flex items-center justify-between p-2.5">
                    <div>
                      <span className="font-medium">{String(key.name)}</span>
                      <span className="ml-2 font-mono text-muted-foreground">
                        {String(key.keyPrefix)}…{String(key.lastFour)}
                      </span>
                    </div>
                    <Badge variant={key.revoked ? "destructive" : "secondary"}>
                      {key.revoked ? "Revoked" : "Active"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No campaigns yet. Create one via the API: POST /api/admin/campaigns
              </p>
            ) : (
              <div className="divide-y rounded-md border text-xs">
                {campaigns.slice(0, 10).map((c) => (
                  <div key={String(c.id)} className="flex items-center justify-between p-2.5">
                    <span className="font-medium">{String(c.name)}</span>
                    <Badge variant="outline" className="capitalize">
                      {String(c.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit trail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Recent audit logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No audit events yet.</p>
            ) : (
              <div className="max-h-64 divide-y overflow-y-auto rounded-md border text-xs">
                {auditLogs.map((log) => (
                  <div key={String(log.id)} className="p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">
                        {String(log.action)} {String(log.resourceType).replace(/_/g, " ")}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(String(log.createdAt)).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
