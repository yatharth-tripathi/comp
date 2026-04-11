"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReelPlayer } from "./reel-player";
import type { FeedReel } from "./types";

interface ReelFeedProps {
  initialReels: FeedReel[];
}

const CAPTION_LANGUAGES = ["en", "hi", "mr", "ta", "te", "gu", "bn"] as const;

/**
 * Snap-scroll vertical feed. Each reel is a section that takes 100dvh;
 * the container has CSS scroll-snap so flicks land perfectly on a reel.
 *
 * Active reel detection uses IntersectionObserver with threshold 0.6 so we
 * start playback slightly before the reel is fully centered, which masks
 * the brief decode latency on slower connections.
 *
 * Keyboard: ↑/↓ to navigate, Space to toggle play, M to mute, C to cycle caption language.
 */
export function ReelFeed({ initialReels }: ReelFeedProps): JSX.Element {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [reels, setReels] = useState<FeedReel[]>(initialReels);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true); // autoplay must start muted per browser policy
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [captionLanguage, setCaptionLanguage] = useState<string>("en");
  const [whyPanel, setWhyPanel] = useState<FeedReel | null>(null);
  const [sharePanel, setSharePanel] = useState<FeedReel | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  // Load caption language from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("salescontent:reels:captionLang");
    if (saved && CAPTION_LANGUAGES.includes(saved as (typeof CAPTION_LANGUAGES)[number])) {
      setCaptionLanguage(saved);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("salescontent:reels:captionLang", captionLanguage);
  }, [captionLanguage]);

  // IntersectionObserver — determine which reel is currently active
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = sectionRefs.current.findIndex((el) => el === entry.target);
            if (idx >= 0) setActiveIndex(idx);
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    for (const el of sectionRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [reels]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.target && (e.target as HTMLElement).tagName?.match(/INPUT|TEXTAREA/)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        scrollTo(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        scrollTo(activeIndex - 1);
      } else if (e.key === "m" || e.key === "M") {
        setMuted((v) => !v);
      } else if (e.key === "c" || e.key === "C") {
        const idx = CAPTION_LANGUAGES.indexOf(captionLanguage as (typeof CAPTION_LANGUAGES)[number]);
        const next = CAPTION_LANGUAGES[(idx + 1) % CAPTION_LANGUAGES.length];
        setCaptionLanguage(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, captionLanguage]);

  const scrollTo = useCallback(
    (idx: number): void => {
      const clamped = Math.max(0, Math.min(reels.length - 1, idx));
      const el = sectionRefs.current[clamped];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [reels.length],
  );

  const languagesAvailable = useMemo(() => {
    const set = new Set<string>();
    set.add("en");
    for (const reel of reels) {
      for (const lang of Object.keys(reel.captions ?? {})) set.add(lang);
    }
    return Array.from(set);
  }, [reels]);

  // Pagination — load more when near the end
  const loadMore = useCallback(async (): Promise<void> => {
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/reels/feed?limit=10`, {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { data: FeedReel[] };
      // Dedupe by id
      setReels((prev) => {
        const existing = new Set(prev.map((r) => r.id));
        const next = body.data.filter((r) => !existing.has(r.id));
        return [...prev, ...next];
      });
    } catch {
      // Silent — feed already rendered
    }
  }, [getToken]);

  useEffect(() => {
    if (reels.length > 0 && activeIndex >= reels.length - 3) {
      void loadMore();
    }
  }, [activeIndex, reels.length, loadMore]);

  const openShareSheet = (reel: FeedReel): void => setSharePanel(reel);
  const openWhySheet = (reel: FeedReel): void => setWhyPanel(reel);
  const openAnalytics = (reel: FeedReel): void => router.push(`/reels/${reel.id}/analytics`);

  const handleShare = async (opts: {
    recipientName: string;
    recipientPhone: string;
  }): Promise<void> => {
    if (!sharePanel) return;
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(
        `${apiUrl}/api/content/${sharePanel.contentAssetId}/share`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            channel: "whatsapp",
            recipientName: opts.recipientName,
            recipientPhone: opts.recipientPhone || undefined,
            personalizationSnapshot: {
              agentName: user?.fullName ?? "",
              agentPhone: user?.primaryPhoneNumber?.phoneNumber ?? "",
            },
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Share failed");
      }
      const { data } = (await res.json()) as {
        data: { redirectUrl: string; shortCode: string };
      };
      const text = encodeURIComponent(
        `Hi ${opts.recipientName}, thought you'd find this useful: ${data.redirectUrl}`,
      );
      const waNumber = opts.recipientPhone.replace(/[^0-9]/g, "");
      window.open(
        waNumber ? `https://wa.me/${waNumber}?text=${text}` : `https://wa.me/?text=${text}`,
        "_blank",
      );
      toast.success("Opened WhatsApp. Tracking link active.");
      setSharePanel(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Share failed");
    }
  };

  if (reels.length === 0) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-black p-8 text-center text-white">
        <div className="max-w-sm space-y-3">
          <h2 className="text-2xl font-semibold">No reels yet</h2>
          <p className="text-sm text-white/70">
            Reels your team creates (or admins publish) will appear here in a vertical feed.
          </p>
          <button
            type="button"
            onClick={() => router.push("/reels/new")}
            className="mt-4 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
          >
            Create the first reel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <div
        ref={scrollerRef}
        className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
        style={{ scrollBehavior: "smooth" }}
      >
        {reels.map((reel, index) => (
          <div
            key={reel.id}
            ref={(el) => {
              sectionRefs.current[index] = el;
            }}
          >
            <ReelPlayer
              reel={reel}
              active={index === activeIndex}
              muted={muted}
              onMuteToggle={() => setMuted((v) => !v)}
              onShare={openShareSheet}
              onAnalytics={openAnalytics}
              onWhyThisReel={openWhySheet}
              captionLanguage={captionLanguage}
              captionsVisible={captionsVisible}
              onToggleCaptions={() => {
                if (captionsVisible && languagesAvailable.length > 1) {
                  const idx = languagesAvailable.indexOf(captionLanguage);
                  setCaptionLanguage(languagesAvailable[(idx + 1) % languagesAvailable.length] ?? "en");
                } else {
                  setCaptionsVisible((v) => !v);
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* Position indicator on the left */}
      <div className="pointer-events-none absolute left-3 top-1/2 z-30 -translate-y-1/2">
        <div className="flex flex-col gap-1">
          {reels.slice(0, 12).map((_, idx) => (
            <motion.div
              key={idx}
              className="h-6 w-[3px] rounded-full bg-white/30"
              animate={{
                backgroundColor:
                  idx === activeIndex ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.3)",
                scaleY: idx === activeIndex ? 1.2 : 1,
              }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>
      </div>

      {/* Swipe hint — shown briefly on first load */}
      {activeIndex === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -10] }}
          transition={{ duration: 3, times: [0, 0.15, 0.75, 1] }}
          className="pointer-events-none absolute bottom-32 left-1/2 z-40 -translate-x-1/2 text-white/70"
        >
          <ChevronDown className="mx-auto h-6 w-6 animate-bounce" />
          <p className="mt-1 text-xs font-medium tracking-wide">Swipe up for next</p>
        </motion.div>
      )}

      {/* Share sheet */}
      <AnimatePresence>
        {sharePanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/60"
              onClick={() => setSharePanel(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl bg-background p-6 shadow-2xl"
            >
              <SharePanel
                reel={sharePanel}
                onCancel={() => setSharePanel(null)}
                onShare={handleShare}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Why-this-reel sheet */}
      <AnimatePresence>
        {whyPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/60"
              onClick={() => setWhyPanel(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl bg-background p-6 shadow-2xl"
            >
              <div className="mx-auto max-w-md space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold">Why am I seeing this?</h3>
                  <button onClick={() => setWhyPanel(null)} aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This reel was ranked for you based on:
                </p>
                <ul className="space-y-2 text-sm">
                  {whyPanel.isMandatory && (
                    <li className="rounded-md bg-amber-500/10 p-3">
                      <strong>Mandatory training</strong> — required for your role
                    </li>
                  )}
                  <li className="rounded-md bg-muted p-3">
                    Rank score: <strong>{whyPanel.rankScore}</strong>
                  </li>
                  <li className="rounded-md bg-muted p-3">
                    {whyPanel.totalViews} total views · {whyPanel.totalShares} shares across
                    your tenant
                  </li>
                  {whyPanel.creator && (
                    <li className="rounded-md bg-muted p-3">
                      Created by <strong>{whyPanel.creator.displayName}</strong>
                    </li>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => setWhyPanel(null)}
                  className="mt-4 w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SharePanel({
  reel,
  onCancel,
  onShare,
}: {
  reel: FeedReel;
  onCancel: () => void;
  onShare: (opts: { recipientName: string; recipientPhone: string }) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Share with a customer</h3>
          <p className="text-xs text-muted-foreground">{reel.title}</p>
        </div>
        <button onClick={onCancel} aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Customer name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rohit Sharma"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">WhatsApp number (optional)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 9876543210"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => onShare({ recipientName: name, recipientPhone: phone })}
        className="w-full rounded-md bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        Share on WhatsApp (trackable)
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        The link you send is a unique short URL — you&apos;ll see when the customer opens it.
      </p>
    </div>
  );
}
