import Image from "next/image";
import { notFound } from "next/navigation";
import { IllustrationPreview } from "@/components/illustrations/illustration-preview";
import { ShareCallbackButton } from "@/components/share-callback-button";

interface IllustrationDetail {
  id: string;
  productType: string;
  customerName: string | null;
  outputJson: {
    sections: Array<{ heading: string; rows: Array<{ label: string; value: string }> }>;
    chartData: Array<{ year: number; paid: number; value: number }>;
    comparisons: Array<{ product: string; returns: string }>;
    disclaimers: string[];
    regime: string;
    assumptions?: string[];
  };
  agent: {
    displayName: string;
    displayPhone: string | null;
    displayEmail: string | null;
    designation: string | null;
    photoUrl: string | null;
  };
}

const PRODUCT_LABELS: Record<string, string> = {
  term_plan: "Term Insurance",
  sip: "Systematic Investment Plan",
  home_loan: "Home Loan",
  health_insurance: "Health Insurance",
  ulip: "Unit Linked Insurance Plan",
  mutual_fund: "Mutual Fund",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server-fetches the illustration payload by short code. This call is what
 * increments the open counter on the server — so tracking works even if
 * the customer has JavaScript disabled.
 */
async function fetchPublicIllustration(shortCode: string): Promise<IllustrationDetail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const res = await fetch(`${apiUrl}/public/illustrations/${shortCode}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data: IllustrationDetail };
  return body.data;
}

export default async function PublicIllustrationPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}): Promise<JSX.Element> {
  const { shortCode } = await params;
  const payload = await fetchPublicIllustration(shortCode);
  if (!payload) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        {/* Agent card */}
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          {payload.agent.photoUrl ? (
            <Image
              src={payload.agent.photoUrl}
              alt={payload.agent.displayName}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-lg font-semibold text-white">
              {payload.agent.displayName.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Personalized for you by</div>
            <div className="truncate text-base font-semibold">{payload.agent.displayName}</div>
            {payload.agent.designation && (
              <div className="truncate text-xs text-muted-foreground">
                {payload.agent.designation}
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {payload.agent.displayPhone && <span>{payload.agent.displayPhone}</span>}
              {payload.agent.displayEmail && <span>{payload.agent.displayEmail}</span>}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {PRODUCT_LABELS[payload.productType] ?? payload.productType}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {payload.customerName
              ? `${payload.customerName}'s personalized plan`
              : "Your personalized plan"}
          </h1>
        </div>

        <IllustrationPreview
          productType={payload.productType}
          payload={payload.outputJson}
        />

        <div className="flex flex-col items-center gap-3 py-6">
          <ShareCallbackButton shortCode={shortCode} />
          <p className="text-center text-[11px] text-muted-foreground">
            Have questions? Tap above and your agent will call you back.
          </p>
        </div>

        <footer className="border-t pt-6 text-center text-xs text-muted-foreground">
          Illustration generated via SalesContent AI · PitchWiz
        </footer>
      </div>
    </main>
  );
}
