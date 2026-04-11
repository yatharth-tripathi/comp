import { apiFetch } from "@/lib/api-client";
import { ReelFeed } from "@/components/reels/reel-feed";
import type { FeedReel } from "@/components/reels/types";

export const metadata = {
  title: "Reels — SalesContent AI",
};

export const dynamic = "force-dynamic";

export default async function ReelsFeedPage(): Promise<JSX.Element> {
  let initialReels: FeedReel[] = [];
  try {
    initialReels = await apiFetch<FeedReel[]>("/api/reels/feed?limit=10");
  } catch {
    initialReels = [];
  }
  return <ReelFeed initialReels={initialReels} />;
}
