import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Eye, Flame, GraduationCap, Target } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api-client";

interface ScenarioDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  xpReward: number;
  tags: string[];
  personaJson: {
    name: string;
    age: number;
    profession: string;
    city: string;
    archetype: string;
    personality: string;
    goal: string;
    moodInitial: number;
    hotButtons: string[];
  };
  openingStatement: string;
  evaluationRulesJson: Array<{ skill: string; weight: number }>;
  complianceRulesJson: { hardBanned: string[]; violationPenalty: number };
}

export const dynamic = "force-dynamic";

export default async function ScenarioBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;

  let scenario: ScenarioDetail | null = null;
  try {
    scenario = await apiFetch<ScenarioDetail>(`/api/role-play/scenarios/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
  if (!scenario) notFound();

  const persona = scenario.personaJson;
  const totalMax = scenario.evaluationRulesJson.reduce((acc, r) => acc + r.weight, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link
          href="/role-play"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All scenarios
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{scenario.title}</h1>
        {scenario.description && (
          <p className="mt-3 text-sm text-muted-foreground">{scenario.description}</p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-4 w-4" />
              Who you&apos;re meeting
            </div>
            <div className="mt-4 flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-xl font-semibold text-white">
                {persona.name.charAt(0)}
              </div>
              <div>
                <div className="text-lg font-semibold">{persona.name}</div>
                <div className="text-sm text-muted-foreground">
                  {persona.age} · {persona.profession} · {persona.city}
                </div>
                <div className="mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {persona.archetype}
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Personality
                </div>
                <p className="mt-1 text-muted-foreground">{persona.personality}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Goal
                </div>
                <p className="mt-1 text-muted-foreground">{persona.goal}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Hot buttons
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {persona.hotButtons.map((hb) => (
                    <span
                      key={hb}
                      className="rounded-full border border-rose-300/60 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                      {hb}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Flame className="h-4 w-4" />
              Customer opens with
            </div>
            <blockquote className="mt-3 border-l-2 border-primary pl-4 text-sm italic text-foreground">
              &ldquo;{scenario.openingStatement}&rdquo;
            </blockquote>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Scoring
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalMax} pts</div>
            <div className="mt-3 space-y-1.5">
              {scenario.evaluationRulesJson.map((r) => (
                <div key={r.skill} className="flex items-center justify-between text-xs">
                  <span>{r.skill}</span>
                  <span className="text-muted-foreground">{r.weight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-300">
              Compliance watch
            </div>
            <p className="mt-1.5 text-[11px] text-amber-900 dark:text-amber-100">
              Each use of a banned phrase = −{scenario.complianceRulesJson.violationPenalty}{" "}
              points and an automatic minimum-grade cap.
            </p>
          </div>

          <Link
            href={`/role-play/${id}/run?mode=try_me`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-semibold hover:border-primary"
          >
            <GraduationCap className="h-4 w-4" />
            Try Me (hints on)
          </Link>
          <Link
            href={`/role-play/${id}/run?mode=test_me`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Test Me (live scoring)
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/role-play/${id}/show-me`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            <Eye className="h-4 w-4" />
            Show Me — watch a masterclass
          </Link>
        </aside>
      </div>
    </div>
  );
}
