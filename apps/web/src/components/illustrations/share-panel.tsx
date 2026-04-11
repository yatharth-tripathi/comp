"use client";

import { motion } from "framer-motion";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  customerName: string;
  publicUrl: string;
  onClose: () => void;
  onContinue: () => void;
}

/**
 * Post-generation share drawer. The illustration already exists — this
 * panel just helps the agent get the link into the customer's hands.
 */
export function SharePanel({ customerName, publicUrl, onClose, onContinue }: Props): JSX.Element {
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const openWhatsApp = (): void => {
    const message = encodeURIComponent(
      `Hi ${customerName}, as discussed — here's your personalized illustration: ${publicUrl}`,
    );
    const number = phone.replace(/[^0-9]/g, "");
    window.open(
      number ? `https://wa.me/${number}?text=${message}` : `https://wa.me/?text=${message}`,
      "_blank",
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border bg-background p-6 shadow-2xl md:inset-x-auto md:left-1/2 md:bottom-8 md:w-[min(480px,calc(100%-2rem))] md:-translate-x-1/2 md:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Ready to share</h2>
            <p className="text-xs text-muted-foreground">
              Every open is tracked. You&apos;ll be notified when {customerName} views this.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <code className="flex-1 truncate font-mono">{publicUrl}</code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded p-1 hover:bg-background"
              aria-label="Copy link"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waphone">Customer WhatsApp (optional)</Label>
            <Input
              id="waphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={openWhatsApp}>
              <MessageCircle className="h-4 w-4" />
              Send on WhatsApp
            </Button>
            <Button variant="outline" onClick={onContinue}>
              Create another
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
