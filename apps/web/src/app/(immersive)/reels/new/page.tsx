import { apiFetch } from "@/lib/api-client";
import { ReelCreator } from "@/components/reels/reel-creator";

interface TagRow {
  id: string;
  dimension: string;
  value: string;
  displayLabel: string;
}

export const metadata = { title: "Create a reel" };
export const dynamic = "force-dynamic";

export default async function NewReelPage(): Promise<JSX.Element> {
  let tags: TagRow[] = [];
  try {
    tags = await apiFetch<TagRow[]>("/api/content-tags");
  } catch {
    tags = [];
  }
  return <ReelCreator existingTags={tags} />;
}
