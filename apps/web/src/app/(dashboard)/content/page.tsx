import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";

interface ContentAssetListItem {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  approvalStatus: string;
  thumbnailUrl: string | null;
  shareCount: number;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  tags: Array<{ tag: { id: string; dimension: string; displayLabel: string } }>;
}

export const dynamic = "force-dynamic";

export default async function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; contentType?: string; status?: string }>;
}): Promise<JSX.Element> {
  const params = await searchParams;
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.contentType) search.set("contentType", params.contentType);
  if (params.status) search.set("approvalStatus", params.status);
  search.set("pageSize", "50");

  let items: ContentAssetListItem[] = [];
  let total = 0;
  let errorMessage: string | null = null;
  try {
    const result = await apiFetch<ContentAssetListItem[]>(`/api/content?${search.toString()}`);
    items = result;
  } catch (error) {
    if (error instanceof ApiClientError) errorMessage = error.message;
    else errorMessage = "Failed to load content";
  }

  void total;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Library</h1>
          <p className="text-sm text-muted-foreground">
            Every poster, reel, document, and battle card your team uses with customers.
          </p>
        </div>
        <Link href="/content/new">
          <Button>
            <Plus className="h-4 w-4" />
            Upload new asset
          </Button>
        </Link>
      </div>

      {errorMessage ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {errorMessage}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-base font-medium">No content yet</p>
              <p className="text-sm text-muted-foreground">
                Upload your first asset to start sharing with your team.
              </p>
            </div>
            <Link href="/content/new">
              <Button>Upload your first asset</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Link key={item.id} href={`/content/${item.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="line-clamp-1 text-base">{item.title}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="capitalize">
                      {item.contentType.replace(/_/g, " ")}
                    </Badge>
                    <Badge
                      variant={item.approvalStatus === "published" ? "success" : "secondary"}
                      className="capitalize"
                    >
                      {item.approvalStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.description ?? "No description"}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.shareCount} shares</span>
                    <span>{item.viewCount} views</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
