"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Mic, Upload, Video, X } from "lucide-react";
import { TeleprompterRecorder } from "./teleprompter-recorder";

interface TagRow {
  id: string;
  dimension: string;
  value: string;
  displayLabel: string;
}

type Mode = "pick" | "upload" | "record";

/**
 * Reel creator — two modes:
 *   1. Upload — pick a file, uploads straight to Mux via direct upload URL
 *   2. Record — in-browser MediaRecorder with a scrolling teleprompter overlay
 *      (the AI script generator wires in Session 07; for now the script is
 *       user-authored)
 */
export function ReelCreator({ existingTags }: { existingTags: TagRow[] }): JSX.Element {
  const router = useRouter();
  const { getToken } = useAuth();
  const [mode, setMode] = useState<Mode>("pick");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [teleprompterScript, setTeleprompterScript] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);

  const [file, setFile] = useState<File | Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const tagsByDimension = useMemo(() => {
    const map = new Map<string, TagRow[]>();
    for (const tag of existingTags) {
      const bucket = map.get(tag.dimension) ?? [];
      bucket.push(tag);
      map.set(tag.dimension, bucket);
    }
    return map;
  }, [existingTags]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    if (!title) setTitle(chosen.name.replace(/\.[^.]+$/, ""));
  };

  const handleRecordComplete = useCallback((blob: Blob): void => {
    setFile(blob);
    setMode("upload"); // flip to metadata step
  }, []);

  const publish = async (): Promise<void> => {
    if (!file) {
      toast.error("Pick a file or record a video first");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setUploading(true);
    setProgress(5);

    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

      // Step 1: create Mux direct upload (server reserves reel + content_asset)
      const uploadRes = await fetch(`${apiUrl}/api/reels/upload`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          creatorType: "agent",
        }),
      });
      if (!uploadRes.ok) {
        const body = (await uploadRes.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Failed to reserve upload");
      }
      const {
        data: { reelId, uploadUrl },
      } = (await uploadRes.json()) as {
        data: { reelId: string; uploadUrl: string };
      };
      setProgress(15);

      // Step 2: upload the video blob to Mux via XHR (for progress events)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setProgress(15 + Math.round((evt.loaded / evt.total) * 75));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Mux upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error uploading to Mux"));
        xhr.send(file);
      });
      setProgress(92);

      // Step 3: finalize metadata (the webhook will swap upload id for asset id later)
      const finalizeRes = await fetch(`${apiUrl}/api/reels/${reelId}/finalize`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          language: "en",
          teleprompterScript: teleprompterScript || undefined,
          tagIds: selectedTags,
          isMandatory,
          mandatoryForRoles: [],
          mandatoryForTeamIds: [],
        }),
      });
      if (!finalizeRes.ok) {
        const body = (await finalizeRes.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Finalize failed");
      }
      setProgress(100);

      toast.success("Reel uploaded. Mux is processing — it'll appear in the feed shortly.");
      router.push("/reels");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (mode === "record") {
    return (
      <TeleprompterRecorder
        initialScript={teleprompterScript}
        onScriptChange={setTeleprompterScript}
        onComplete={handleRecordComplete}
        onCancel={() => setMode("pick")}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => router.push("/reels")}
          className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </button>
        <h1 className="text-base font-semibold">Create a reel</h1>
        <div className="w-20" />
      </header>

      <div className="mx-auto max-w-xl space-y-6 px-5 py-8">
        {mode === "pick" && !file && (
          <>
            <p className="text-sm text-white/70">
              Pick how you want to create this reel.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-6 text-center transition hover:bg-white/10"
              >
                <div className="grid h-14 w-14 place-items-center rounded-full bg-sky-500/20">
                  <Upload className="h-7 w-7 text-sky-300" />
                </div>
                <div>
                  <div className="font-semibold">Upload a video</div>
                  <div className="mt-1 text-xs text-white/60">MP4, MOV, WebM up to 500 MB</div>
                </div>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setMode("record")}
                className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-6 text-center transition hover:bg-white/10"
              >
                <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-500/20">
                  <Video className="h-7 w-7 text-rose-300" />
                </div>
                <div>
                  <div className="font-semibold">Record with teleprompter</div>
                  <div className="mt-1 text-xs text-white/60">
                    Read a script while the camera rolls
                  </div>
                </div>
              </motion.button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFilePick}
              className="hidden"
            />
          </>
        )}

        {(file || mode === "upload") && file && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium">
                    {"name" in file ? (file as File).name : "Recording.webm"}
                  </div>
                  <div className="mt-0.5 text-xs text-white/60">
                    {((file.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                  className="rounded-full p-2 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                placeholder="ULIP objection handling — the 'it's too complex' reframe"
                className="w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                rows={3}
                placeholder="Short description. What situation is this reel useful for?"
                className="w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
              />
            </div>

            {tagsByDimension.size > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Tags</label>
                {[...tagsByDimension.entries()].map(([dimension, tags]) => (
                  <div key={dimension}>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-white/60">
                      {dimension.replace(/_/g, " ")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          disabled={uploading}
                          onClick={() =>
                            setSelectedTags((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((t) => t !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            selectedTags.includes(tag.id)
                              ? "border-sky-300 bg-sky-400/20 text-sky-100"
                              : "border-white/20 text-white/70 hover:border-white/40"
                          }`}
                        >
                          {tag.displayLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-3 rounded-md bg-white/5 p-3 text-sm">
              <input
                type="checkbox"
                checked={isMandatory}
                disabled={uploading}
                onChange={(e) => setIsMandatory(e.target.checked)}
                className="h-4 w-4 accent-amber-400"
              />
              Mark as mandatory training (requires enterprise_admin to take effect)
            </label>

            {uploading && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Uploading to Mux…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-400 to-indigo-500"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={publish}
              disabled={!title.trim() || uploading}
              className="w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {uploading ? "Publishing…" : "Publish reel"}
            </button>
          </div>
        )}
      </div>

      {/* Prevent-linting helper: Mic is used when the teleprompter route loads */}
      <Mic className="hidden" />
    </div>
  );
}
