"use client";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import Image from "next/image";

interface AgentCardProps {
  name: string;
  designation: string | null;
  avatarUrl: string | null;
  onContact?: () => void;
}

/**
 * Bottom-left agent attribution card. Shows who made this reel.
 * Tapping the WhatsApp icon opens a direct-message deep link.
 */
export function AgentCard({
  name,
  designation,
  avatarUrl,
  onContact,
}: AgentCardProps): JSX.Element {
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/30 py-1.5 pl-1.5 pr-4 backdrop-blur-xl"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-cover ring-2 ring-white/30"
          unoptimized
        />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 text-left">
        <div className="text-sm font-semibold leading-tight text-white">{name}</div>
        {designation && (
          <div className="text-[11px] leading-tight text-white/70">{designation}</div>
        )}
      </div>
      {onContact && (
        <button
          type="button"
          onClick={onContact}
          className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/90 text-white hover:bg-emerald-400"
          aria-label="Contact creator on WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}
