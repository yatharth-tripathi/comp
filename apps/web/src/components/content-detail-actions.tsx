"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, ThumbsDown, ThumbsUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  contentId: string;
  approvalStatus: string;
  complianceRegime: string;
}

async function authedPost(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export function ContentDetailActions({
  contentId,
  approvalStatus,
  complianceRegime,
}: Props): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [rejectNotes, setRejectNotes] = useState("");
  const [shareRecipient, setShareRecipient] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);

  const needsCompliance = complianceRegime !== "none";

  const run = async (
    fn: (token: string) => Promise<{ ok: boolean; status: number; json: unknown }>,
    successMessage: string,
  ): Promise<void> => {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      const res = await fn(token);
      if (!res.ok) {
        const message =
          (res.json as { error?: { message?: string } }).error?.message ??
          `Failed (${res.status})`;
        throw new Error(message);
      }
      toast.success(successMessage);
      router.refresh();
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = (): Promise<void> =>
    run(
      (token) => authedPost(`/api/content/${contentId}/submit`, {}, token),
      "Submitted for review",
    );

  const approve = (stepName: "internal_review" | "compliance_review"): Promise<void> =>
    run(
      (token) => authedPost(`/api/content/${contentId}/approve`, { stepName }, token),
      "Approved",
    );

  const reject = (): Promise<void> =>
    run(
      (token) =>
        authedPost(
          `/api/content/${contentId}/reject`,
          { stepName: needsCompliance ? "compliance_review" : "internal_review", notes: rejectNotes },
          token,
        ),
      "Rejected",
    );

  const share = async (): Promise<void> => {
    if (!shareRecipient.trim()) {
      toast.error("Enter the recipient's name");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");
      const res = await authedPost(
        `/api/content/${contentId}/share`,
        {
          channel: "whatsapp",
          recipientName: shareRecipient,
          recipientPhone: sharePhone || undefined,
          personalizationSnapshot: {},
        },
        token,
      );
      if (!res.ok) {
        throw new Error(
          (res.json as { error?: { message?: string } }).error?.message ?? "Share failed",
        );
      }
      const data = (res.json as { data: { redirectUrl: string; shortCode: string } }).data;
      setShareLink(data.redirectUrl);
      toast.success("Share link ready. Opening WhatsApp…");
      if (sharePhone) {
        const waMessage = encodeURIComponent(
          `Hi ${shareRecipient}, here's the information you asked about: ${data.redirectUrl}`,
        );
        const waNumber = sharePhone.replace(/[^0-9]/g, "");
        window.open(`https://wa.me/${waNumber}?text=${waMessage}`, "_blank");
      } else {
        const waMessage = encodeURIComponent(
          `Hi ${shareRecipient}, here's the information you asked about: ${data.redirectUrl}`,
        );
        window.open(`https://wa.me/?text=${waMessage}`, "_blank");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Share failed");
    } finally {
      setBusy(false);
    }
  };

  const isDraftOrRejected = approvalStatus === "draft" || approvalStatus === "rejected";
  const isPendingReview =
    approvalStatus === "pending_internal" || approvalStatus === "pending_compliance";
  const isPublished = approvalStatus === "published";

  return (
    <>
      {isDraftOrRejected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit for review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Kicks off the approval workflow. Agents won&apos;t see this until it&apos;s
              approved.
            </p>
            <Button className="w-full" onClick={submit} disabled={busy}>
              <Upload className="h-4 w-4" />
              Submit for review
            </Button>
          </CardContent>
        </Card>
      )}

      {isPendingReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() =>
                approve(
                  approvalStatus === "pending_compliance"
                    ? "compliance_review"
                    : "internal_review",
                )
              }
              disabled={busy}
            >
              <ThumbsUp className="h-4 w-4" />
              Approve
            </Button>
            <div className="space-y-2">
              <Label htmlFor="reject">Reject with notes</Label>
              <Textarea
                id="reject"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection"
              />
              <Button
                variant="destructive"
                className="w-full"
                onClick={reject}
                disabled={busy || !rejectNotes.trim()}
              >
                <ThumbsDown className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPublished && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share with customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="recipient">Customer name</Label>
              <Input
                id="recipient"
                value={shareRecipient}
                onChange={(e) => setShareRecipient(e.target.value)}
                placeholder="Rohit Sharma"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp number (optional)</Label>
              <Input
                id="phone"
                value={sharePhone}
                onChange={(e) => setSharePhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
            <Button className="w-full" onClick={share} disabled={busy}>
              <MessageCircle className="h-4 w-4" />
              Share on WhatsApp
            </Button>
            {shareLink && (
              <div className="space-y-1 rounded-md border bg-muted/40 p-2 text-xs">
                <div className="text-muted-foreground">Trackable link</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate">{shareLink}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareLink);
                      toast.success("Link copied");
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
