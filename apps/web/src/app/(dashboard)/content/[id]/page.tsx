import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentDetailActions } from "@/components/content-detail-actions";

interface ContentAssetDetail {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  approvalStatus: string;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileBytes: number | null;
  complianceRegime: string;
  requiresExternalApproval: boolean;
  expiryDate: string | null;
  publishedAt: string | null;
  createdAt: string;
  shareCount: number;
  viewCount: number;
  tags: Array<{
    tag: { id: string; dimension: string; displayLabel: string };
  }>;
  approvalEvents: Array<{
    id: string;
    stepName: string;
    status: string;
    notes: string | null;
    createdAt: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;

  let asset: ContentAssetDetail | null = null;
  try {
    asset = await apiFetch<ContentAssetDetail>(`/api/content/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
  if (!asset) notFound();

  const isImage = asset.mimeType?.startsWith("image/");
  const isVideo = asset.mimeType?.startsWith("video/");
  const isPdf = asset.mimeType === "application/pdf";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/content" className="text-xs text-muted-foreground hover:underline">
            ← Content Library
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{asset.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {asset.contentType.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant={asset.approvalStatus === "published" ? "success" : "secondary"}
              className="capitalize"
            >
              {asset.approvalStatus.replace(/_/g, " ")}
            </Badge>
            {asset.complianceRegime !== "none" && (
              <Badge variant="warning">{asset.complianceRegime.toUpperCase()}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-0">
              {asset.fileUrl ? (
                isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.fileUrl}
                    alt={asset.title}
                    className="max-h-[600px] w-full object-contain"
                  />
                ) : isVideo ? (
                  <video src={asset.fileUrl} controls className="w-full" />
                ) : isPdf ? (
                  <iframe src={asset.fileUrl} className="h-[600px] w-full" title={asset.title} />
                ) : (
                  <div className="flex h-48 items-center justify-center p-6 text-sm text-muted-foreground">
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Open file in new tab
                    </a>
                  </div>
                )
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No file attached
                </div>
              )}
            </CardContent>
          </Card>

          {asset.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {asset.description}
                </p>
              </CardContent>
            </Card>
          )}

          {asset.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map(({ tag }) => (
                    <Badge key={tag.id} variant="outline">
                      <span className="mr-1 text-muted-foreground">
                        {tag.dimension.replace(/_/g, " ")}:
                      </span>
                      {tag.displayLabel}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {asset.approvalEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {asset.approvalEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {event.stepName.replace(/_/g, " ")}
                        </span>
                        <Badge variant="secondary" className="capitalize">
                          {event.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {event.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Views</span>
                <span className="font-medium">{asset.viewCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-medium">{asset.shareCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">File size</span>
                <span className="font-medium">
                  {asset.fileBytes
                    ? `${(asset.fileBytes / 1024 / 1024).toFixed(2)} MB`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </span>
              </div>
              {asset.publishedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Published</span>
                  <span className="font-medium">
                    {new Date(asset.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <ContentDetailActions
            contentId={asset.id}
            approvalStatus={asset.approvalStatus}
            complianceRegime={asset.complianceRegime}
          />
        </div>
      </div>
    </div>
  );
}
