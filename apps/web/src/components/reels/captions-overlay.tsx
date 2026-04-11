"use client";

import { AnimatePresence, motion } from "framer-motion";

interface CaptionsOverlayProps {
  captions: Record<string, string>;
  activeLanguage: string;
  visible: boolean;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  ta: "தமிழ்",
  te: "తెలుగు",
  gu: "ગુજરાતી",
  bn: "বাংলা",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  pa: "ਪੰਜਾਬੀ",
};

/**
 * Burned-in caption layer. Switches languages instantly using
 * `reels.captionsByLanguage`. Typography is tuned for over-video readability:
 * large-ish line height, a backdrop-blur strip, no shadow on the glyphs.
 */
export function CaptionsOverlay({
  captions,
  activeLanguage,
  visible,
}: CaptionsOverlayProps): JSX.Element | null {
  const text = captions[activeLanguage] ?? captions["en"] ?? "";
  if (!visible || !text) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={activeLanguage}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="pointer-events-none absolute bottom-28 left-4 right-20 z-20"
      >
        <div className="rounded-2xl bg-black/40 px-4 py-2.5 text-center backdrop-blur-xl">
          <p className="text-[15px] font-medium leading-snug text-white">{text}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
            {LANGUAGE_LABELS[activeLanguage] ?? activeLanguage}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
