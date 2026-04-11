"use client";

import { motion } from "framer-motion";
import {
  Bookmark,
  BarChart3,
  Heart,
  Info,
  Languages,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";

interface ActionsRailProps {
  liked: boolean;
  saved: boolean;
  muted: boolean;
  totalShares: number;
  totalViews: number;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onWhyThisReel: () => void;
  onAnalytics?: () => void;
}

/**
 * The vertical action rail on the right edge of each reel.
 *
 * Every action optimistically updates its own UI; upstream code writes
 * persistent state via API calls. This makes taps feel instant.
 */
export function ActionsRail({
  liked,
  saved,
  muted,
  totalShares,
  totalViews,
  onLike,
  onSave,
  onShare,
  onToggleMute,
  onToggleCaptions,
  onWhyThisReel,
  onAnalytics,
}: ActionsRailProps): JSX.Element {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-5">
      <ActionButton
        label="Like"
        active={liked}
        onClick={onLike}
        activeClass="text-rose-500"
        icon={<Heart className={liked ? "fill-current" : ""} />}
      />
      <ActionButton
        label={`${totalShares}`}
        onClick={onShare}
        icon={<Share2 />}
      />
      <ActionButton
        label="Save"
        active={saved}
        onClick={onSave}
        activeClass="text-amber-400"
        icon={<Bookmark className={saved ? "fill-current" : ""} />}
      />
      <ActionButton
        label="Captions"
        onClick={onToggleCaptions}
        icon={<Languages />}
      />
      <ActionButton
        label={muted ? "Unmute" : "Mute"}
        onClick={onToggleMute}
        icon={muted ? <VolumeX /> : <Volume2 />}
      />
      <ActionButton label={`${totalViews}`} disabled icon={<MessageCircle />} />
      <ActionButton label="Why?" onClick={onWhyThisReel} icon={<Info />} />
      {onAnalytics && (
        <ActionButton label="Stats" onClick={onAnalytics} icon={<BarChart3 />} />
      )}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  activeClass = "",
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  activeClass?: string;
}): JSX.Element {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.85 }}
      className="group flex flex-col items-center gap-1 disabled:opacity-60"
    >
      <div
        className={`grid h-11 w-11 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md transition-all [&_svg]:h-6 [&_svg]:w-6 ${
          active ? activeClass : ""
        } group-hover:bg-black/40`}
      >
        {icon}
      </div>
      <span className="text-[11px] font-medium text-white/90">{label}</span>
    </motion.button>
  );
}
