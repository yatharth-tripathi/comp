"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Customer message bubble with a subtle typewriter effect. Drops into the
 * conversation flow from below, character-by-character.
 *
 * The typewriter is capped at ~18ms per char so long messages still feel
 * reactive. For accessibility, we fully reveal the text when the user
 * scrolls the bubble off-screen or presses any key.
 */
interface CustomerBubbleProps {
  name: string;
  avatar: string;
  text: string;
  typewriter?: boolean;
}

export function CustomerBubble({
  name,
  avatar,
  text,
  typewriter = true,
}: CustomerBubbleProps): JSX.Element {
  const [visible, setVisible] = useState(typewriter ? 0 : text.length);

  useEffect(() => {
    if (!typewriter) {
      setVisible(text.length);
      return;
    }
    setVisible(0);
    let idx = 0;
    const step = (): void => {
      idx += 1;
      setVisible(idx);
      if (idx < text.length) timer = window.setTimeout(step, 18);
    };
    let timer = window.setTimeout(step, 120);
    const skip = (): void => {
      clearTimeout(timer);
      setVisible(text.length);
    };
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [text, typewriter]);

  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 24, stiffness: 260 }}
      className="flex items-start gap-3"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-semibold text-white">
        {avatar}
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-sm bg-white/8 p-4 text-white">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {name}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">
          {text.slice(0, visible)}
          {visible < text.length && (
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="ml-0.5 inline-block h-[1.1em] w-[2px] -mb-0.5 bg-white/70 align-middle"
            />
          )}
        </p>
      </div>
    </motion.div>
  );
}

export function TraineeBubble({ text }: { text: string }): JSX.Element {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-start justify-end gap-3"
    >
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-sky-600 p-4 text-white shadow-md">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          You
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">{text}</p>
      </div>
    </motion.div>
  );
}
