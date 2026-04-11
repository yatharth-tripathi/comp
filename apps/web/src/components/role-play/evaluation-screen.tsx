"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { SkillRadar } from "./skill-radar";

interface Props {
  evaluation: {
    skills: Array<{
      skill: string;
      score: number;
      maxScore: number;
      feedback: string;
      evidence: string;
    }>;
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade: string;
    overallFeedback: string;
    strengths: Array<{ technique: string; quote: string; whyItWorked: string }>;
    improvements: Array<{
      moment: string;
      whatTheySaid: string;
      whatIdealRmWouldSay: string;
      technique: string;
    }>;
    bestMoment: { quote: string; whyItWorked: string };
    worstMoment: { quote: string; whatShouldHaveBeenSaid: string };
    ghostResponses: Array<{
      round: number;
      actualResponse: string;
      idealResponse: string;
      techniqueUsedByIdeal: string;
    }>;
    complianceViolations: Array<{
      regulator: string;
      rule: string;
      quote: string;
      severity: "WARNING" | "MAJOR" | "FATAL";
    }>;
    moodAnalysis: string;
    nextRecommendation: {
      weakestSkill: string;
      suggestedScenarioCategory: string;
      rationale: string;
    };
    xpAwarded: number;
  };
  session: {
    id: string;
    scenarioId: string;
    scenarioTitle: string;
    moodTrajectory: number[];
  };
}

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  S: { text: "text-emerald-300", bg: "from-emerald-500 to-teal-500" },
  A: { text: "text-emerald-300", bg: "from-emerald-600 to-sky-500" },
  B: { text: "text-sky-300", bg: "from-sky-500 to-indigo-500" },
  C: { text: "text-amber-300", bg: "from-amber-500 to-orange-500" },
  D: { text: "text-orange-300", bg: "from-orange-500 to-rose-500" },
  F: { text: "text-rose-300", bg: "from-rose-600 to-rose-800" },
};

export function EvaluationScreen({ evaluation, session }: Props): JSX.Element {
  const router = useRouter();
  const gradeStyle = GRADE_COLORS[evaluation.grade] ?? GRADE_COLORS.C!;

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-black text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur">
        <Link href="/role-play" className="text-sm text-white/70 hover:text-white">
          ← Back to scenarios
        </Link>
        <div className="text-center">
          <div className="text-sm font-semibold">{session.scenarioTitle}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">
            Evaluation report
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/role-play/${session.scenarioId}/run?mode=test_me`)}
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-5 py-10">
        {/* Hero grade */}
        <motion.section
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradeStyle.bg} p-10 shadow-2xl`}
        >
          <div className="relative z-10 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/80">
              <Award className="h-4 w-4" />
              Your grade
            </div>
            <div className="text-[120px] font-bold leading-none tracking-tighter">
              {evaluation.grade}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tabular-nums">
                {evaluation.percentage}
              </span>
              <span className="text-2xl font-semibold text-white/70">%</span>
            </div>
            <div className="text-sm text-white/90">
              {evaluation.totalScore} / {evaluation.maxScore} points · +{evaluation.xpAwarded} XP awarded
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">
              {evaluation.overallFeedback}
            </p>
          </div>
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-black/20 blur-3xl" />
        </motion.section>

        {/* Compliance violations — top priority if any */}
        {evaluation.complianceViolations.length > 0 && (
          <section className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-rose-300">
              <ShieldAlert className="h-4 w-4" />
              Compliance violations detected
            </div>
            <div className="mt-4 space-y-3">
              {evaluation.complianceViolations.map((v, i) => (
                <div key={i} className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">
                      {v.severity}
                    </span>
                    <span className="text-rose-200">{v.regulator}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/90">{v.rule}</p>
                  <blockquote className="mt-2 rounded-md border-l-2 border-rose-400 bg-black/30 px-3 py-2 font-mono text-xs text-rose-100">
                    &ldquo;{v.quote}&rdquo;
                  </blockquote>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skill radar + per-skill breakdown */}
        <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
            <SkillRadar skills={evaluation.skills} />
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Per-skill breakdown
            </h3>
            {evaluation.skills.map((s) => {
              const pct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
              const barColor =
                pct >= 80
                  ? "bg-emerald-500"
                  : pct >= 60
                    ? "bg-sky-500"
                    : pct >= 40
                      ? "bg-amber-500"
                      : "bg-rose-500";
              return (
                <div key={s.skill}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{s.skill}</span>
                    <span className="text-white/60">
                      {s.score}/{s.maxScore}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className={`h-full ${barColor}`}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/60">
                    {s.feedback}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Strengths + Improvements */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-300">
              <TrendingUp className="h-4 w-4" />
              Strengths
            </div>
            {evaluation.strengths.length === 0 ? (
              <p className="text-xs text-white/60">
                No standout strengths identified in this session.
              </p>
            ) : (
              evaluation.strengths.map((s, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                    {s.technique}
                  </div>
                  <blockquote className="mt-1.5 text-sm font-medium text-white">
                    &ldquo;{s.quote}&rdquo;
                  </blockquote>
                  <p className="mt-2 text-[11px] leading-snug text-white/70">
                    {s.whyItWorked}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-300">
              <TrendingDown className="h-4 w-4" />
              Areas to improve
            </div>
            {evaluation.improvements.length === 0 ? (
              <p className="text-xs text-white/60">Nothing specific to fix.</p>
            ) : (
              evaluation.improvements.map((imp, i) => (
                <div key={i} className="rounded-xl bg-white/5 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                    {imp.technique} · {imp.moment}
                  </div>
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-[10px] text-white/50">You said</div>
                      <blockquote className="rounded-md border-l-2 border-rose-400 bg-rose-950/30 px-3 py-1.5 font-mono text-xs text-rose-100">
                        &ldquo;{imp.whatTheySaid}&rdquo;
                      </blockquote>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/50">Ideal RM would say</div>
                      <blockquote className="rounded-md border-l-2 border-emerald-400 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-100">
                        &ldquo;{imp.whatIdealRmWouldSay}&rdquo;
                      </blockquote>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Best + Worst moment */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Best moment
            </div>
            <blockquote className="mt-3 border-l-2 border-emerald-400 pl-3 text-sm font-medium italic">
              &ldquo;{evaluation.bestMoment.quote}&rdquo;
            </blockquote>
            <p className="mt-2 text-xs text-white/70">{evaluation.bestMoment.whyItWorked}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-300">
              <TrendingDown className="h-4 w-4" />
              Worst moment
            </div>
            <blockquote className="mt-3 border-l-2 border-rose-400 pl-3 text-sm font-medium italic">
              &ldquo;{evaluation.worstMoment.quote}&rdquo;
            </blockquote>
            <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                What you should have said
              </div>
              <p className="mt-1 text-xs italic text-white/90">
                &ldquo;{evaluation.worstMoment.whatShouldHaveBeenSaid}&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* Ghost responses — round-by-round */}
        {evaluation.ghostResponses.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Ghost responses — what you said vs what an ideal RM would have said
            </h3>
            <div className="space-y-4">
              {evaluation.ghostResponses.map((g) => (
                <div
                  key={g.round}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                    Round {g.round} · Technique: {g.techniqueUsedByIdeal}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] text-white/50">You said</div>
                      <blockquote className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-xs leading-snug text-rose-100">
                        &ldquo;{g.actualResponse}&rdquo;
                      </blockquote>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] text-white/50">Ideal RM would say</div>
                      <blockquote className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs leading-snug text-emerald-100">
                        &ldquo;{g.idealResponse}&rdquo;
                      </blockquote>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mood trajectory */}
        {session.moodTrajectory.length > 1 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Customer mood trajectory
            </h3>
            <p className="mt-1 text-xs text-white/70">{evaluation.moodAnalysis}</p>
            <div className="mt-5">
              <MoodTrajectoryChart trajectory={session.moodTrajectory} />
            </div>
          </section>
        )}

        {/* Next recommendation */}
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" />
            What to practice next
          </div>
          <p className="mt-2 text-lg font-semibold">
            Your weakest area: {evaluation.nextRecommendation.weakestSkill}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {evaluation.nextRecommendation.rationale}
          </p>
          <Link
            href="/role-play"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
          >
            Pick a {evaluation.nextRecommendation.suggestedScenarioCategory} scenario
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function MoodTrajectoryChart({ trajectory }: { trajectory: number[] }): JSX.Element {
  const width = 800;
  const height = 140;
  const padding = { top: 20, right: 20, bottom: 24, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const xStep = innerW / Math.max(1, trajectory.length - 1);
  const yScale = (v: number): number => innerH - ((v - 1) / 9) * innerH;

  const path = trajectory
    .map((v, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + yScale(v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const areaPath = `${path} L ${padding.left + (trajectory.length - 1) * xStep} ${padding.top + innerH} L ${padding.left} ${padding.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible">
      <defs>
        <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[1, 5, 10].map((mark) => (
        <g key={mark}>
          <line
            x1={padding.left}
            y1={padding.top + yScale(mark)}
            x2={width - padding.right}
            y2={padding.top + yScale(mark)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="3 4"
          />
          <text
            x={padding.left - 6}
            y={padding.top + yScale(mark) + 4}
            textAnchor="end"
            className="fill-current text-[10px] opacity-50"
          >
            {mark}
          </text>
        </g>
      ))}
      <motion.path
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        d={areaPath}
        fill="url(#moodGrad)"
      />
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
        d={path}
        fill="none"
        stroke="rgb(16, 185, 129)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {trajectory.map((v, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 + i * 0.08 }}
          cx={padding.left + i * xStep}
          cy={padding.top + yScale(v)}
          r={4}
          fill="rgb(16, 185, 129)"
        />
      ))}
    </svg>
  );
}
