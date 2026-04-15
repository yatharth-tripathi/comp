"use client";

import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Flag, Lightbulb, Send } from "lucide-react";
import { ComplianceAlert } from "./compliance-alert";
import { CustomerBubble, TraineeBubble } from "./customer-bubble";
import { MoodMeter } from "./mood-meter";

interface ScenarioStep {
  speaker: string;
  text: string;
  expectedAction?: string;
  hints?: string[];
}

interface SessionState {
  sessionId: string;
  scenario: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    difficulty: string;
    persona: {
      name: string;
      age: number;
      profession: string;
      city: string;
      archetype: string;
      hotButtons: string[];
    };
    steps: ScenarioStep[];
  };
  firstCustomerMessage: string;
  initialMood: number;
}

interface ConversationEntry {
  speaker: "customer" | "trainee";
  text: string;
}

interface RunnerProps {
  session: SessionState;
  mode: "try_me" | "test_me";
}

/**
 * The role-play runner. This is the showpiece component for Session 06.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [top bar: back · title · mode · timer · end session]    │
 *   ├──────────┬───────────────────────────────┬───────────────┤
 *   │          │                               │               │
 *   │  Mood    │  Conversation scroll          │  Hints        │
 *   │  meter   │                               │  (Try Me)     │
 *   │          │                               │               │
 *   │  Persona │  [customer bubble]            │  Next         │
 *   │  card    │  [trainee bubble]             │  expected     │
 *   │          │  [customer bubble]            │  action       │
 *   │          │                               │               │
 *   │          ├───────────────────────────────┤               │
 *   │          │ [ input: write your response ]│               │
 *   └──────────┴───────────────────────────────┴───────────────┘
 */
export function RolePlayRunner({ session, mode }: RunnerProps): JSX.Element {
  const { getToken } = useAuth();
  const router = useRouter();

  const [mood, setMood] = useState(session.initialMood);
  const [moodDelta, setMoodDelta] = useState<number | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([
    { speaker: "customer", text: session.firstCustomerMessage },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [violations, setViolations] = useState<string[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [isFinalTurn, setIsFinalTurn] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showHints, setShowHints] = useState(mode === "try_me");

  const conversationEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll when conversation grows
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation]);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Current step hint (Try Me mode)
  const currentStepHint = session.scenario.steps.find(
    (s, i) => s.speaker === "system" && Math.floor(i / 2) === turnIndex,
  );

  const submit = useCallback(async (): Promise<void> => {
    if (!input.trim() || busy) return;
    if (busy) return;
    const userText = input.trim();
    setBusy(true);
    setInput("");

    // Optimistic UI — show the trainee's bubble immediately
    setConversation((prev) => [...prev, { speaker: "trainee", text: userText }]);

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(
        `${apiUrl}/api/role-play/sessions/${session.sessionId}/respond`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ response: userText }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Failed to submit response");
      }
      const { data } = (await res.json()) as {
        data: {
          customerMessage: string;
          currentMood: number;
          moodDelta: number;
          violations: string[];
          turnIndex: number;
          isFinalTurn: boolean;
        };
      };

      setMood(data.currentMood);
      setMoodDelta(data.moodDelta);
      setTurnIndex(data.turnIndex);
      setIsFinalTurn(data.isFinalTurn);
      if (data.violations.length > 0) setViolations(data.violations);

      setConversation((prev) => [
        ...prev,
        { speaker: "customer", text: data.customerMessage },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unknown error");
      // Roll back optimistic bubble on error
      setConversation((prev) => prev.slice(0, -1));
      setInput(userText);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [busy, getToken, input, session.sessionId]);

  const endSession = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(
        `${apiUrl}/api/role-play/sessions/${session.sessionId}/evaluate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Evaluation failed");
      }
      toast.success("Session complete. Generating your report…");
      router.push(`/role-play/sessions/${session.sessionId}/result`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [getToken, router, session.sessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="flex h-[100dvh] flex-col bg-black text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("End session without evaluating?")) router.push("/role-play");
          }}
          className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold">{session.scenario.title}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            {mode === "try_me" ? "Try Me — hints on" : "Test Me — live scoring"} · Round{" "}
            {turnIndex + 1} · {timeDisplay}
          </div>
        </div>
        <button
          type="button"
          onClick={endSession}
          disabled={busy || turnIndex === 0}
          className="rounded-md bg-amber-500/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <Flag className="mr-1 inline h-3.5 w-3.5" />
          End & score
        </button>
      </header>

      <div className="relative grid flex-1 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        {/* Left rail — mood meter + persona */}
        <aside className="hidden border-r border-white/10 bg-black/60 p-5 lg:block">
          <MoodMeter mood={mood} moodDelta={moodDelta} />
          <div className="mt-6 space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
              Customer
            </div>
            <div className="text-sm font-semibold text-white">
              {session.scenario.persona.name}
            </div>
            <div className="text-white/70">
              {session.scenario.persona.age} · {session.scenario.persona.profession}
            </div>
            <div className="text-white/70">{session.scenario.persona.city}</div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Archetype
            </div>
            <div className="text-[11px] text-white/80">
              {session.scenario.persona.archetype}
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Hot buttons
            </div>
            <div className="flex flex-wrap gap-1">
              {session.scenario.persona.hotButtons.slice(0, 5).map((hb) => (
                <span
                  key={hb}
                  className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200"
                >
                  {hb}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* Center — conversation + input */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <AnimatePresence initial={false}>
              {conversation.map((entry, idx) =>
                entry.speaker === "customer" ? (
                  <CustomerBubble
                    key={idx}
                    name={session.scenario.persona.name}
                    avatar={session.scenario.persona.name.charAt(0)}
                    text={entry.text}
                    typewriter={idx === conversation.length - 1}
                  />
                ) : (
                  <TraineeBubble key={idx} text={entry.text} />
                ),
              )}
              {busy && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-white/50"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-semibold text-white">
                    {session.scenario.persona.name.charAt(0)}
                  </span>
                  <span className="flex gap-1">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                    />
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }}
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                    />
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }}
                      className="h-1.5 w-1.5 rounded-full bg-white/70"
                    />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={conversationEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 bg-black/50 p-4 backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response… (Enter to send, Shift+Enter for newline)"
                disabled={busy}
                rows={1}
                className="max-h-36 min-h-[48px] flex-1 resize-none rounded-xl border border-white/15 bg-white/5 p-3 text-[15px] leading-snug text-white outline-none placeholder:text-white/30 focus:border-primary"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy || !input.trim()}
                className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-30"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            {isFinalTurn && (
              <p className="mt-2 text-center text-[11px] text-amber-400">
                This is your last round. Tap &ldquo;End & score&rdquo; to finish.
              </p>
            )}
          </div>
        </div>

        {/* Right rail — hints (Try Me mode only) */}
        <aside className="hidden border-l border-white/10 bg-black/60 p-5 lg:block">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/60">
              <Lightbulb className="h-3.5 w-3.5" />
              {mode === "try_me" ? "Coaching hints" : "Scoring rubric"}
            </div>
            {mode === "try_me" && (
              <button
                type="button"
                onClick={() => setShowHints((s) => !s)}
                className="text-[10px] uppercase tracking-wider text-white/50 hover:text-white"
              >
                {showHints ? "Hide" : "Show"}
              </button>
            )}
          </div>
          {mode === "try_me" && showHints && currentStepHint && (
            <motion.div
              key={turnIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 space-y-4"
            >
              {currentStepHint.expectedAction && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-sky-300">
                    Objective this round
                  </div>
                  <p className="mt-1 text-xs leading-snug text-white/80">
                    {currentStepHint.expectedAction}
                  </p>
                </div>
              )}
              {currentStepHint.hints && currentStepHint.hints.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    What an ideal RM would do
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {currentStepHint.hints.map((hint) => (
                      <li
                        key={hint}
                        className="flex gap-2 text-[11px] leading-snug text-white/70"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                        <span>{hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
          {mode === "test_me" && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] leading-snug text-white/60">
                Scoring is live. Every response is being analyzed against {session.scenario.steps.filter((s) => s.speaker === "system").length} scoring dimensions. Your grade, strengths, ghost responses, and next-scenario recommendation come after you end the session.
              </p>
            </div>
          )}
        </aside>
      </div>

      <ComplianceAlert violations={violations} onDismiss={() => setViolations([])} />
    </div>
  );
}
