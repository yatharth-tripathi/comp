"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface TagRow {
  id: string;
  dimension: string;
  value: string;
  displayLabel: string;
}

const CONTENT_TYPES = [
  { value: "poster", label: "Poster", accept: "image/jpeg,image/png,image/webp" },
  {
    value: "reel",
    label: "Reel (short video)",
    accept: "video/mp4,video/quicktime,video/webm",
  },
  {
    value: "presentation",
    label: "Presentation",
    accept:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/pdf",
  },
  {
    value: "document",
    label: "Document",
    accept: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  { value: "infographic", label: "Infographic", accept: "image/jpeg,image/png,image/webp,image/svg+xml" },
  { value: "battle_card", label: "Battle Card", accept: "image/jpeg,image/png,image/webp,application/pdf" },
  { value: "gif", label: "GIF", accept: "image/gif,image/webp" },
  { value: "audio", label: "Audio", accept: "audio/mpeg,audio/mp4,audio/aac,audio/webm" },
] as const;

const COMPLIANCE_REGIMES = [
  "none",
  "irdai",
  "sebi",
  "rbi",
  "amfi",
  "pfrda",
  "trai",
  "dpdp",
] as const;

export function ContentUploadForm({ existingTags }: { existingTags: TagRow[] }): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]["value"]>(
    "poster",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [complianceRegime, setComplianceRegime] =
    useState<(typeof COMPLIANCE_REGIMES)[number]>("none");
  const [requiresExternalApproval, setRequiresExternalApproval] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  const acceptAttr = useMemo(
    () => CONTENT_TYPES.find((c) => c.value === contentType)?.accept ?? "*/*",
    [contentType],
  );

  const tagsByDimension = useMemo(() => {
    const map = new Map<string, TagRow[]>();
    for (const tag of existingTags) {
      const bucket = map.get(tag.dimension) ?? [];
      bucket.push(tag);
      map.set(tag.dimension, bucket);
    }
    return map;
  }, [existingTags]);

  const toggleTag = (id: string): void =>
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const chosen = e.target.files?.[0];
    if (chosen) {
      setFile(chosen);
      if (!title) setTitle(chosen.name.replace(/\.[^.]+$/, ""));
    }
  };

  const upload = async (): Promise<void> => {
    if (!file) {
      toast.error("Pick a file first");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setUploading(true);
    setProgress(10);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      };

      // Step 1: presigned URL
      const uploadRes = await fetch(`${apiUrl}/api/content/upload-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          contentType,
        }),
      });
      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Failed to get upload URL");
      }
      const { data: upload } = (await uploadRes.json()) as {
        data: {
          contentAssetId: string;
          uploadUrl: string;
          objectKey: string;
          publicUrl: string;
          requiredHeaders: Record<string, string>;
        };
      };
      setProgress(25);

      // Step 2: upload to R2 via XHR so we get progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", upload.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setProgress(25 + Math.round((evt.loaded / evt.total) * 60));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error uploading to R2"));
        xhr.send(file);
      });
      setProgress(90);

      // Step 3: persist metadata
      const persistRes = await fetch(`${apiUrl}/api/content`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contentAssetId: upload.contentAssetId,
          title,
          description: description || undefined,
          contentType,
          fileUrl: upload.publicUrl,
          fileBytes: file.size,
          mimeType: file.type,
          complianceRegime,
          requiresExternalApproval,
          mandatoryDisclaimers: [],
          tagIds: selectedTagIds,
          expiryDate: expiryDate || undefined,
          visibilityScope: { allAgents: true },
        }),
      });
      if (!persistRes.ok) {
        const body = (await persistRes.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Failed to persist content");
      }
      setProgress(100);

      toast.success("Upload complete. Ready for review.");
      router.push(`/content/${upload.contentAssetId}`);
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Asset details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Content type</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setContentType(t.value)}
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    contentType === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="file"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/50"
              >
                <UploadCloud className="h-5 w-5" />
                Drop a file or click to select
              </label>
            )}
            <input
              id="file"
              type="file"
              accept={acceptAttr}
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="HDFC Click2Protect — 1Cr cover poster"
              disabled={uploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of when and how agents should use this"
              disabled={uploading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="regime">Compliance regime</Label>
              <select
                id="regime"
                value={complianceRegime}
                onChange={(e) =>
                  setComplianceRegime(e.target.value as (typeof COMPLIANCE_REGIMES)[number])
                }
                disabled={uploading}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm uppercase shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {COMPLIANCE_REGIMES.map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry date (optional)</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={uploading}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresExternalApproval}
              onChange={(e) => setRequiresExternalApproval(e.target.checked)}
              disabled={uploading}
              className="h-4 w-4"
            />
            Requires external (IRDAI/SEBI/RBI) approval before agents can share
          </label>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tagsByDimension.size === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tags yet. Create tags under Settings → Taxonomy so teammates can filter by
                product, stage, and language.
              </p>
            ) : (
              [...tagsByDimension.entries()].map(([dimension, tags]) => (
                <div key={dimension}>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {dimension.replace(/_/g, " ")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className="focus:outline-none"
                      >
                        <Badge
                          variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                        >
                          {tag.displayLabel}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploading && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{progress}%</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            <Button className="w-full" onClick={upload} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The file uploads straight to R2 via a presigned URL — it never hits our API.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
