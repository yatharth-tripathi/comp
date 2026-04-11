"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Circle, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TeleprompterRecorderProps {
  initialScript: string;
  onScriptChange: (script: string) => void;
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

/**
 * Teleprompter recording mode.
 *
 * - The script scrolls up the screen while the front camera records
 * - The scroll speed is fixed but the user can press Space to pause/resume
 * - Recording uses MediaRecorder (webm/vp9, or falls back to default)
 * - On stop we hand the blob back to the parent creator component which
 *   uploads it via the Mux direct-upload flow.
 *
 * This is the feature Instagram doesn't have that meaningfully lifts
 * agent-generated content quality.
 */
export function TeleprompterRecorder({
  initialScript,
  onScriptChange,
  onComplete,
  onCancel,
}: TeleprompterRecorderProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<"script" | "preview" | "recording" | "done">("script");
  const [script, setScript] = useState(initialScript);
  const [elapsed, setElapsed] = useState(0);
  const [scrollSpeed, setScrollSpeed] = useState(28); // px per second
  const [scrollY, setScrollY] = useState(0);
  const [paused, setPaused] = useState(false);

  // ---- Camera lifecycle ----
  const acquireStream = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("preview");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Camera access denied: ${error.message}`
          : "Camera access denied",
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
    };
  }, []);

  // ---- Recording control ----
  const startRecording = (): void => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];

    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((t) => MediaRecorder.isTypeSupported(t));

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, videoBitsPerSecond: 3_500_000 } : undefined,
    );
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setPhase("done");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onComplete(blob);
    };

    recorder.start();
    setPhase("recording");
    setElapsed(0);
    setScrollY(0);
  };

  const stopRecording = (): void => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  };

  // ---- Elapsed + scroll animation loop ----
  useEffect(() => {
    if (phase !== "recording" || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      setElapsed((e) => e + dt);
      setScrollY((y) => y + dt * scrollSpeed);
      // Stop automatically at 90 seconds — PRD max reel length
      setElapsed((e) => {
        if (e >= 90) {
          stopRecording();
          return e;
        }
        return e;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, paused, scrollSpeed]);

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === " ") {
        e.preventDefault();
        if (phase === "recording") setPaused((p) => !p);
      } else if (e.key === "Escape") {
        if (phase === "recording") stopRecording();
      } else if (e.key === "ArrowUp") {
        setScrollSpeed((s) => Math.min(80, s + 4));
      } else if (e.key === "ArrowDown") {
        setScrollSpeed((s) => Math.max(10, s - 4));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const saveScript = (value: string): void => {
    setScript(value);
    onScriptChange(value);
  };

  // ---- Script-writing phase ----
  if (phase === "script") {
    return (
      <div className="min-h-[100dvh] overflow-y-auto bg-black text-white">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-base font-semibold">Write your script</h1>
          <div className="w-16" />
        </header>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <p className="text-sm text-white/70">
            Write a 60–90 second script. It will scroll up the screen while you record — so
            write it the way you&apos;d say it, in short sentences.
          </p>
          <textarea
            value={script}
            onChange={(e) => saveScript(e.target.value)}
            rows={14}
            placeholder={
              "Hi, I'm [your name], and today I want to talk about term insurance…\n\nShort sentences work best. Natural pauses help.\n\nEnd with a clear call to action."
            }
            className="mt-6 w-full rounded-xl border border-white/20 bg-black/40 p-5 text-lg leading-relaxed text-white outline-none focus:border-white/40"
          />
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-white/50">
              {script.trim().split(/\s+/).filter(Boolean).length} words · ~
              {Math.max(0, Math.round(script.trim().split(/\s+/).filter(Boolean).length / 2.5))}s
              at natural pace
            </span>
            <button
              type="button"
              disabled={!script.trim()}
              onClick={acquireStream}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              Continue to camera
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Camera preview + recording phase ----
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50" />

      {/* Teleprompter rail — centered, above the camera */}
      <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center">
        <div className="relative h-72 w-[min(92vw,600px)] overflow-hidden rounded-2xl bg-black/55 p-5 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
          <motion.div
            animate={{ y: -scrollY }}
            transition={{ type: "tween", ease: "linear", duration: 0.1 }}
            className="whitespace-pre-wrap text-center text-[22px] font-medium leading-[1.45] text-white"
          >
            {script}
          </motion.div>
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onCancel();
          }}
          className="rounded-full bg-black/50 p-2.5 text-white backdrop-blur"
          aria-label="Cancel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          Speed
          <input
            type="range"
            min={10}
            max={80}
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(parseInt(e.target.value, 10))}
            className="w-24 accent-white"
          />
        </div>
        {phase === "recording" && (
          <div className="rounded-full bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white">
            ● REC {Math.floor(elapsed)}s
          </div>
        )}
      </div>

      {/* Bottom control */}
      <div className="absolute inset-x-0 bottom-10 z-30 flex flex-col items-center gap-3">
        {phase === "preview" && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={startRecording}
            className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-white/10 backdrop-blur"
            aria-label="Start recording"
          >
            <Circle className="h-14 w-14 fill-rose-500 text-rose-500" />
          </motion.button>
        )}
        {phase === "recording" && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={stopRecording}
            className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-white/10 backdrop-blur"
            aria-label="Stop recording"
          >
            <Square className="h-10 w-10 fill-white text-white" />
          </motion.button>
        )}
        <p className="text-xs font-medium text-white/80">
          {phase === "preview"
            ? "Tap to start · Space pauses teleprompter · ↑↓ speed"
            : paused
              ? "Paused — space to resume"
              : "Recording — Esc to stop"}
        </p>
      </div>
    </div>
  );
}
