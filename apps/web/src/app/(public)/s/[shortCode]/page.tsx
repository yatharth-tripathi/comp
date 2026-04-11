import Image from "next/image";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareCallbackButton } from "@/components/share-callback-button";

interface ResolvePayload {
  kind: "content_share" | "illustration";
  title?: string;
  productType?: string;
  renderedUrl?: string | null;
  asset?: {
    id: string;
    title: string;
    contentType: string;
    fileUrl: string | null;
    thumbnailUrl: string | null;
    description: string | null;
  } | null;
  agent?: {
    displayName: string;
    displayPhone: string | null;
    displayEmail: string | null;
    designation: string | null;
    photoUrl: string | null;
  } | null;
  personalization?: Record<string, string>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveShare(shortCode: string): Promise<ResolvePayload | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  const res = await fetch(`${apiUrl}/public/shares/${shortCode}/resolve`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data: ResolvePayload };
  return body.data;
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}): Promise<JSX.Element> {
  const { shortCode } = await params;
  const payload = await resolveShare(shortCode);
  if (!payload) notFound();

  if (payload.kind === "illustration") {
    return (
      <main className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight capitalize">
            {payload.productType?.replace(/_/g, " ")}
          </h1>
          {payload.renderedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.renderedUrl} alt="Illustration" className="rounded-md" />
          ) : (
            <p className="text-sm text-muted-foreground">Illustration preview unavailable.</p>
          )}
          <ShareCallbackButton shortCode={shortCode} />
        </div>
      </main>
    );
  }

  const asset = payload.asset;
  const agent = payload.agent;
  const isImage = asset?.fileUrl && /\.(jpe?g|png|gif|webp|svg)$/i.test(asset.fileUrl);
  const isVideo = asset?.fileUrl && /\.(mp4|mov|webm)$/i.test(asset.fileUrl);
  const isPdf = asset?.fileUrl && /\.pdf$/i.test(asset.fileUrl);

  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {agent && (
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              {agent.photoUrl ? (
                <Image
                  src={agent.photoUrl}
                  alt={agent.displayName}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {agent.displayName.charAt(0) || "?"}
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium">{agent.displayName}</div>
                {agent.designation && (
                  <div className="text-sm text-muted-foreground">{agent.designation}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {agent.displayPhone && <span>{agent.displayPhone}</span>}
                  {agent.displayEmail && <span>{agent.displayEmail}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{asset?.title ?? payload.title ?? "Shared document"}</CardTitle>
          </CardHeader>
          <CardContent>
            {asset?.description && (
              <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {asset.description}
              </p>
            )}
            {asset?.fileUrl ? (
              isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.fileUrl} alt={asset.title} className="w-full rounded-md" />
              ) : isVideo ? (
                <video src={asset.fileUrl} controls className="w-full rounded-md" />
              ) : isPdf ? (
                <iframe src={asset.fileUrl} className="h-[70vh] w-full rounded-md" title={asset.title} />
              ) : (
                <a
                  href={asset.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open file
                </a>
              )
            ) : (
              <p className="text-sm text-muted-foreground">File unavailable.</p>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <ShareCallbackButton shortCode={shortCode} />
        </div>

        <footer className="text-center text-xs text-muted-foreground">
          Shared via SalesContent AI
        </footer>
      </div>
    </main>
  );
}
