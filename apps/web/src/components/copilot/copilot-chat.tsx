"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Briefcase,
  Clock,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type CopilotMode = "pre_meeting" | "during_meeting" | "post_meeting" | "manager" | "adhoc";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolsUsed?: Array<{ name: string; result: unknown }>;
}

const MODES: Array<{ key: CopilotMode; label: string; icon: typeof Briefcase; description: string }> = [
  {
    key: "pre_meeting",
    label: "Pre-meeting",
    icon: Briefcase,
    description: "Get briefed before walking in. Opening pitch, objection prep, content suggestions.",
  },
  {
    key: "during_meeting",
    label: "During meeting",
    icon: MessageSquare,
    description: "Live assist. Product facts, objection handles, instant illustrations.",
  },
  {
    key: "post_meeting",
    label: "Post-meeting",
    icon: Clock,
    description: "Log what happened. Get a WhatsApp follow-up draft and next-step recommendations.",
  },
  {
    key: "adhoc",
    label: "Quick question",
    icon: Sparkles,
    description: "Ask anything about BFSI products, regulations, or sales techniques.",
  },
];

export function CopilotChat(): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<CopilotMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [productFocus, setProductFocus] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startSession = useCallback(
    async (selectedMode: CopilotMode): Promise<void> => {
      setBusy(true);
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
        const res = await fetch(`${apiUrl}/api/copilot/start`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mode: selectedMode,
            customerName: customerName || undefined,
            productFocus: productFocus || undefined,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Failed to start");
        }
        const { data } = (await res.json()) as {
          data: { sessionId: string; greeting: string };
        };
        setSessionId(data.sessionId);
        setMode(selectedMode);
        setMessages([{ role: "assistant", content: data.greeting }]);
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed");
      } finally {
        setBusy(false);
      }
    },
    [customerName, getToken, productFocus],
  );

  const sendMessage = useCallback(async (): Promise<void> => {
    if (!input.trim() || !sessionId || busy) return;
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setBusy(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiUrl}/api/copilot/query`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, content: userText }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Failed");
      }
      const { data } = (await res.json()) as {
        data: { response: string; toolsUsed: Array<{ name: string; result: unknown }> };
      };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, toolsUsed: data.toolsUsed },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
      setMessages((prev) => prev.slice(0, -1));
      setInput(userText);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [busy, getToken, input, sessionId]);

  // Mode picker
  if (!mode) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            AI Sales Copilot
          </div>
          <div className="w-20" />
        </header>

        <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              What are you working on?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a mode. The Copilot adjusts its behaviour, tools, and depth accordingly.
            </p>
          </div>

          <div className="w-full space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Customer name (optional)
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Rohit Sharma"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Product focus (optional)
                </label>
                <input
                  value={productFocus}
                  onChange={(e) => setProductFocus(e.target.value)}
                  placeholder="Term Insurance"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={busy}
                    onClick={() => startSession(m.key)}
                    className="group flex flex-col items-start gap-2 rounded-2xl border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-md disabled:opacity-50"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  const currentModeInfo = MODES.find((m) => m.key === mode) ?? MODES[3]!;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Copilot · {currentModeInfo.label}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {customerName || "General"}
              {productFocus ? ` · ${productFocus}` : ""}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMode(null);
            setSessionId(null);
            setMessages([]);
          }}
          className="rounded-md bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-accent"
        >
          <X className="inline h-3.5 w-3.5 mr-1" />
          End session
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm border bg-card"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t pt-2">
                    {msg.toolsUsed.map((tool, ti) => (
                      <div
                        key={ti}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                      >
                        <Sparkles className="h-3 w-3 text-primary" />
                        Used <span className="font-semibold">{tool.name.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {busy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Bot className="h-4 w-4 text-primary" />
              <span className="flex gap-1">
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-primary" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }} className="h-1.5 w-1.5 rounded-full bg-primary" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }} className="h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={
              mode === "pre_meeting"
                ? "Describe the customer you're about to meet…"
                : mode === "during_meeting"
                  ? "Ask a product question or say 'create an illustration'…"
                  : mode === "post_meeting"
                    ? "Describe what happened in the meeting…"
                    : "Ask anything…"
            }
            disabled={busy}
            rows={1}
            className="max-h-32 min-h-[48px] flex-1 resize-none rounded-xl border border-input bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={busy || !input.trim()}
            className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-30"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
