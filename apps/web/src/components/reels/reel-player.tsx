"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionsRail } from "./actions-rail";
import { AgentCard } from "./agent-card";
import { CaptionsOverlay } from "./captions-overlay";
import { CompletionRing } from "./completion-ring";
import { MandatoryBadge } from "./mandatory-badge";
import type { FeedReel } from "./types";
import { useHlsVideo } from "./use-hls-video";
import { useViewBeacon } from "./use-view-beacon";

interface ReelPlayerProps {
  reel: FeedReel;
  active: boolean;
  muted: boolean;
  onMuteToggle: () => void;
  onShare: (reel: FeedReel) => void;
  onAnalytics?: (reel: FeedReel) => void;
  onWhyThisReel: (reel: FeedReel) => void;
  captionLanguage: string;
  captionsVisible: boolean;
  onToggleCaptions: () => void;
}

/**
 * The single reel. Responsible for:
 *   - HLS playback via hls.js
 *   - Autoplay when active, pause when not
 *   - Custom overlay (completion ring, captions, agent card, action rail)
 *   - Gestures: tap to toggle play, double-tap to like, hold to scrub
 *   - View beacons on progress milestones
 *
 * Ambient background: we render a copy of the current frame blurred behind
 * the main video for an immersive vertical-feed aesthetic you don't get
 * from a plain <video>.
 */
export function ReelPlayer({
  reel,
  active,
  muted,
  onMuteToggle,
  onShare,
  onAnalytics,
  onWhyThisReel,
  captionLanguage,
  captionsVisible,
  onToggleCaptions,
}: ReelPlayerProps): JSX.Element {
  const videoRef = useHlsVideo(reel.hlsUrl, reel.mp4Url);
  const { trackProgress } = useViewBeacon(reel.id);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(reel.viewerCompletionPct ?? 0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [heartBurst, setHeartBurst] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  // Autoplay orchestration — play when this is the active reel, pause otherwise
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.currentTime = 0;
      const maybePromise = video.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        // Autoplay can fail silently when muted is not yet applied — retry once muted.
        maybePromise.catch(() => {
          video.muted = true;
          video.play().catch(() => undefined);
        });
      }
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [active, videoRef]);

  // Keep muted state in sync with the top-level feed control
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, videoRef]);

  const handleTimeUpdate = useCallback((): void => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = video.currentTime / video.duration;
    setProgress(pct);
    trackProgress(video.currentTime, video.duration);
  }, [trackProgress, videoRef]);

  const toggle = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [videoRef]);

  // Tap gesture distinguishes single-tap (toggle) from double-tap (like)
  const lastTapRef = useRef(0);
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap — like burst at the tap coordinates
        const rect = e.currentTarget.getBoundingClientRect();
        setLiked(true);
        setHeartBurst(e.clientX - rect.left + (e.clientY - rect.top) * 0.001);
        setTimeout(() => setHeartBurst(null), 800);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
        setTimeout(() => {
          if (lastTapRef.current === now) toggle();
        }, 220);
      }
    },
    [toggle],
  );

  // Scrub handling on the invisible progress track at the bottom
  const barRef = useRef<HTMLDivElement | null>(null);
  const handleScrub = useCallback(
    (clientX: number): void => {
      const bar = barRef.current;
      const video = videoRef.current;
      if (!bar || !video || !video.duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      video.currentTime = pct * video.duration;
      setProgress(pct);
    },
    [videoRef],
  );

  const posterStyle = useMemo(() => {
    if (!reel.posterUrl) return undefined;
    return { backgroundImage: `url(${reel.posterUrl})` };
  }, [reel.posterUrl]);

  const completed = (reel.viewerCompletionPct ?? 0) >= 80;

  return (
    <section className="relative h-[100dvh] w-full snap-start overflow-hidden bg-black">
      {/* Ambient blurred background — poster first, then the video frame as it plays */}
      <div
        className="absolute inset-0 scale-125 bg-cover bg-center blur-3xl saturate-125 opacity-60"
        style={posterStyle}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      <div
        className="absolute inset-0 grid place-items-center"
        onClick={handleTap}
        role="button"
        tabIndex={0}
      >
        <video
          ref={videoRef}
          playsInline
          loop
          preload="metadata"
          muted={muted}
          poster={reel.posterUrl ?? undefined}
          className="h-full max-h-full w-full max-w-[min(100vw,560px)] object-contain"
          onTimeUpdate={handleTimeUpdate}
        />
      </div>

      {/* Top-left mandatory badge */}
      {reel.isMandatory && (
        <div className="pointer-events-none absolute left-4 top-4 z-30">
          <MandatoryBadge dueDate={reel.mandatoryDueDate} completed={completed} />
        </div>
      )}

      {/* Center play/pause + completion ring overlay (fades out during playback) */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <AnimatePresence>
          {(!isPlaying || scrubbing) && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CompletionRing
                progress={progress}
                isPlaying={isPlaying}
                isMandatory={reel.isMandatory}
                onToggle={toggle}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Double-tap heart burst */}
      <AnimatePresence>
        {heartBurst !== null && (
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.4, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <svg viewBox="0 0 24 24" width={160} height={160} fill="#f43f5e">
              <path d="M12 21s-7-4.5-9.5-9.5C.5 7.5 4 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3 0 6.5 3.5 4.5 7.5C19 16.5 12 21 12 21z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Captions */}
      <CaptionsOverlay
        captions={reel.captions}
        activeLanguage={captionLanguage}
        visible={captionsVisible}
      />

      {/* Right action rail */}
      <div className="pointer-events-none absolute bottom-24 right-3 z-30">
        <ActionsRail
          liked={liked}
          saved={saved}
          muted={muted}
          totalShares={reel.totalShares}
          totalViews={reel.totalViews}
          onLike={() => setLiked((v) => !v)}
          onSave={() => setSaved((v) => !v)}
          onShare={() => onShare(reel)}
          onToggleMute={onMuteToggle}
          onToggleCaptions={onToggleCaptions}
          onWhyThisReel={() => onWhyThisReel(reel)}
          onAnalytics={onAnalytics ? () => onAnalytics(reel) : undefined}
        />
      </div>

      {/* Bottom agent card + title */}
      <div className="pointer-events-none absolute inset-x-3 bottom-8 z-20 flex flex-col gap-3">
        {reel.creator && (
          <AgentCard
            name={reel.creator.displayName}
            designation={reel.creator.designation}
            avatarUrl={reel.creator.avatarUrl}
          />
        )}
        <div className="pointer-events-none max-w-[75%] space-y-1">
          <h2 className="text-[17px] font-semibold leading-tight text-white drop-shadow">
            {reel.title}
          </h2>
          {reel.description && (
            <p className="line-clamp-2 text-[13px] leading-snug text-white/80">
              {reel.description}
            </p>
          )}
        </div>
      </div>

      {/* Scrub bar (hidden until touched) */}
      <div
        ref={barRef}
        onPointerDown={(e) => {
          setScrubbing(true);
          handleScrub(e.clientX);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (scrubbing) handleScrub(e.clientX);
        }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        className="pointer-events-auto absolute inset-x-0 bottom-2 z-40 h-4 cursor-col-resize px-3"
      >
        <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/20">
          <motion.div
            className="h-full bg-white"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        </div>
      </div>
    </section>
  );
}
