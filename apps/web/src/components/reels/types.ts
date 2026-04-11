export interface FeedReel {
  id: string;
  contentAssetId: string;
  title: string;
  description: string | null;
  hlsUrl: string | null;
  mp4Url: string | null;
  posterUrl: string | null;
  durationSeconds: number;
  aspectRatio: string;
  captions: Record<string, string>;
  isMandatory: boolean;
  mandatoryDueDate: string | null;
  viewerCompletionPct: number | null;
  totalViews: number;
  totalShares: number;
  creator: {
    id: string;
    displayName: string;
    designation: string | null;
    avatarUrl: string | null;
  } | null;
  rankScore: number;
}
