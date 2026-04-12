import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { Customer360View } from "@/components/leads/customer-360";
import { ArrowLeft } from "lucide-react";

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
      avatarUrl: string | null;
      designation: string | null;
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

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  let data: LeadDetail | null = null;
  try {
    data = await apiFetch<LeadDetail>(`/api/leads/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to pipeline
      </Link>
      <Customer360View data={data} />
    </div>
  );
}
