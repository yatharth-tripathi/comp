import { ContentUploadForm } from "@/components/content-upload-form";
import { apiFetch } from "@/lib/api-client";

interface TagRow {
  id: string;
  dimension: string;
  value: string;
  displayLabel: string;
}

export const dynamic = "force-dynamic";

export default async function NewContentPage(): Promise<JSX.Element> {
  let tags: TagRow[] = [];
  try {
    tags = await apiFetch<TagRow[]>("/api/content-tags");
  } catch {
    tags = [];
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload new content</h1>
        <p className="text-sm text-muted-foreground">
          Upload directly to Cloudflare R2 via a presigned URL. No file ever touches our server.
        </p>
      </div>
      <ContentUploadForm existingTags={tags} />
    </div>
  );
}
