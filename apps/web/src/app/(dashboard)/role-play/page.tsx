import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import {
  ArrowRight,
  Brain,
  Flame,
  HeartPulse,
  PiggyBank,
  ShieldCheck,
  Swords,
} from "lucide-react";

export const metadata = { title: "Role-Play — NEXUS Training" };
export const dynamic = "force-dynamic";

interface ScenarioRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  xpReward: number;
  tags: string[];
}

const DIFFICULTY_STYLES: Record<string, { label: string; color: string }> = {
  easy: { label: "Trainee", color: "bg-emerald-500" },
  medium: { label: "Junior RM", color: "bg-sky-500" },
  hard: { label: "Senior RM", color: "bg-orange-500" },
  expert: { label: "Branch Head", color: "bg-rose-500" },
};

const CATEGORY_ICONS: Record<string, typeof Brain> = {
  sales: PiggyBank,
  compliance: ShieldCheck,
  customer_service: HeartPulse,
  discovery: Brain,
  objection_handling: Swords,
};

export default async function RolePlayPickerPage(): Promise<JSX.Element> {
  let scenarios: ScenarioRow[] = [];
  try {
    scenarios = await apiFetch<ScenarioRow[]>("/api/role-play/scenarios");
  } catch {
    scenarios = [];
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Brain className="h-4 w-4" />
          NEXUS Training · Role-Play Engine
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Practice real conversations. Get scored by the regulator&apos;s rulebook.
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Every scenario is a 15+ exchange live simulation. You talk to a customer played by
          Claude, trained on the full SEBI / IRDAI / RBI / AMFI / PFRDA rulebook. Your
          mood-tracking meter, compliance hit list, per-skill score, and ghost responses all
          come from the same NEXUS brain — the same one that audits conversations in production.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.length === 0 ? (
          <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Scenarios are being seeded. Refresh in a moment.
          </div>
        ) : (
          scenarios.map((s) => {
            const Icon = CATEGORY_ICONS[s.category] ?? Brain;
            const diff = DIFFICULTY_STYLES[s.difficulty] ?? DIFFICULTY_STYLES.medium!;
            return (
              <Link
                key={s.id}
                href={`/role-play/${s.id}`}
                className="group flex flex-col gap-3 rounded-3xl border bg-card p-6 shadow-sm transition hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full ${diff.color} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white`}
                    >
                      {diff.label}
                    </span>
                    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                      <Flame className="h-3 w-3" />
                      {s.xpReward}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold leading-snug">{s.title}</h3>
                  {s.description && (
                    <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-xs font-semibold text-primary">
                  <span className="capitalize text-muted-foreground">
                    {s.category.replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-1 transition group-hover:translate-x-0.5">
                    Start <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
