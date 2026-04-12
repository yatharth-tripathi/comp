"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  User2,
} from "lucide-react";

interface Exchange {
  speaker: "customer" | "rm";
  text: string;
  technique: string | null;
}

interface Debrief {
  skill: string;
  demonstrated: boolean;
  where: string;
}

interface ShowMeData {
  title: string;
  customerProfile: string;
  objective: string;
  complianceWatch: string;
  exchanges: Exchange[];
  debrief: Debrief[];
}

interface Props {
  data: ShowMeData;
  customerName: string;
  customerAvatar: string;
}

/**
 * Show Me masterclass viewer.
 *
 * The exchanges reveal ONE AT A TIME, alternating customer and RM, with
 * a 1.2-second auto-advance interval that feels like watching a real
 * conversation unfold. The user can pause, resume, or skip forward.
 *
 * Each RM exchange has a technique annotation below it in a muted badge.
 *
 * After all exchanges have played, a debrief panel appears showing which
 * skills were demonstrated and where.
 *
 * The user's explicit instruction: "exchanges will come one by one once
 * the AI once the RM, then once the AI then once" — no batch render,
 * no cutoff.
 */
export function ShowMeViewer({ data, customerName, customerAvatar }: Props): JSX.Element {
  const [visibleCount, setVisibleCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showDebrief, setShowDebrief] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const total = data.exchanges.length;
  const allRevealed = visibleCount >= total;

  // Auto-advance timer
  useEffect(() => {
    if (!playing || allRevealed) return;
    const timer = setTimeout(
      () => {
        setVisibleCount((c) => c + 1);
      },
      visibleCount === 0 ? 600 : 1800,
    );
    return () => clearTimeout(timer);
  }, [playing, visibleCount, allRevealed]);

  // Show debrief when all exchanges revealed
  useEffect(() => {
    if (allRevealed && !showDebrief) {
      const timer = setTimeout(() => setShowDebrief(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [allRevealed, showDebrief]);

  // Auto-scroll to latest exchange
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleCount, showDebrief]);

  const skipForward = useCallback(() => {
    setVisibleCount((c) => Math.min(total, c + 1));
  }, [total]);

  const replay = useCallback(() => {
    setVisibleCount(0);
    setShowDebrief(false);
    setPlaying(true);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col bg-black text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Show Me — Masterclass
          </div>
          <div className="mt-0.5 text-sm font-semibold">{data.title}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">
            {visibleCount} / {total} exchanges
          </span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing && !allRevealed ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          {!allRevealed && (
            <button
              type="button"
              onClick={skipForward}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Next exchange"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
          {allRevealed && (
            <button
              type="button"
              onClick={replay}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay
            </button>
          )}
        </div>
      </header>

      {/* Context banner */}
      <div className="border-b border-white/5 bg-white/[0.03] px-6 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
          <div>
            <span className="font-semibold text-white/80">Customer:</span> {data.customerProfile}
          </div>
          <div>
            <span className="font-semibold text-white/80">Objective:</span> {data.objective}
          </div>
          <div>
            <span className="font-semibold text-amber-300">Compliance:</span>{" "}
            {data.complianceWatch}
          </div>
        </div>
      </div>

      {/* Conversation scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <AnimatePresence initial={false}>
            {data.exchanges.slice(0, visibleCount).map((exchange, idx) => {
              const isCustomer = exchange.speaker === "customer";
              return (
                <motion.div
                  key={idx}
                  initial={{ y: 20, opacity: 0, scale: 0.97 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    damping: 22,
                    stiffness: 280,
                    delay: 0.05,
                  }}
                  className={`flex gap-3 ${isCustomer ? "items-start" : "items-start justify-end"}`}
                >
                  {isCustomer && (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-semibold text-white">
                      {customerAvatar}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      isCustomer
                        ? "rounded-2xl rounded-tl-sm bg-white/8"
                        : "rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-800/40 to-emerald-900/30 border border-emerald-500/20"
                    } p-4`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                      {isCustomer ? customerName : "Ideal RM"}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">
                      {exchange.text}
                    </p>
                    {exchange.technique && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {exchange.technique}
                      </motion.div>
                    )}
                  </div>
                  {!isCustomer && (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white">
                      <User2 className="h-5 w-5" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Thinking indicator while waiting for next exchange */}
          {!allRevealed && playing && visibleCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-white/30"
            >
              <span className="flex gap-1">
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="h-1.5 w-1.5 rounded-full bg-white/50"
                />
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }}
                  className="h-1.5 w-1.5 rounded-full bg-white/50"
                />
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }}
                  className="h-1.5 w-1.5 rounded-full bg-white/50"
                />
              </span>
            </motion.div>
          )}
        </div>

        {/* Debrief */}
        <AnimatePresence>
          {showDebrief && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="mx-auto mt-12 max-w-3xl space-y-6"
            >
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-8">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Masterclass debrief
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  Skills demonstrated in this ideal conversation:
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {data.debrief.map((d) => (
                    <div
                      key={d.skill}
                      className={`rounded-xl border p-4 ${
                        d.demonstrated
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{d.skill}</span>
                        {d.demonstrated ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] text-white/40">Not shown</span>
                        )}
                      </div>
                      {d.demonstrated && (
                        <p className="mt-1 text-xs text-white/60">{d.where}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <a
                  href="../"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
                >
                  Now try it yourself
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar at bottom */}
      <div className="h-1 bg-white/5">
        <motion.div
          className="h-full bg-emerald-500"
          animate={{ width: `${total > 0 ? (visibleCount / total) * 100 : 0}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
