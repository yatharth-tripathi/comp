import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Lock,
  Sparkles,
  Swords,
} from "lucide-react";

export const metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

interface JourneyWithProgress {
  id: string;
  title: string;
  description: string | null;
  journeyType: string;
  durationDays: number;
  isSequential: boolean;
  isMandatory: boolean;
  totalModules: number;
  completedModules: number;
  progressPct: number;
  modules: Array<{
    id: string;
    title: string;
    format: string;
    durationMinutes: number;
    xpReward: number;
    completed: boolean;
    score: number | null;
  }>;
}

const JOURNEY_ICONS: Record<string, typeof BookOpenCheck> = {
  onboarding: GraduationCap,
  product: BookOpenCheck,
  skill: Swords,
  certification: GraduationCap,
  campaign: Sparkles,
};

const FORMAT_LABELS: Record<string, string> = {
  video_lesson: "Video",
  audio_clip: "Audio",
  flashcards: "Flashcards",
  quiz: "Quiz",
  scenario_case_study: "Case study",
  ai_role_play: "AI Role-Play",
  infographic: "Infographic",
  webinar: "Webinar",
};

export default async function LearningPage(): Promise<JSX.Element> {
  let journeys: JourneyWithProgress[] = [];
  try {
    journeys = await apiFetch<JourneyWithProgress[]>("/api/learning/journeys");
  } catch {
    journeys = [];
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured learning journeys + AI-powered role-play scenarios.
          </p>
        </div>
        <Link
          href="/role-play"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Swords className="mr-1.5 inline h-4 w-4" />
          Role-Play Arena
        </Link>
      </div>

      {journeys.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <BookOpenCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No learning journeys yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enterprise admins can create structured learning paths via the API or admin panel.
            In the meantime, try the{" "}
            <Link href="/role-play" className="font-medium text-primary hover:underline">
              Role-Play Arena
            </Link>{" "}
            for AI-powered practice sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {journeys.map((journey) => {
            const Icon = JOURNEY_ICONS[journey.journeyType] ?? BookOpenCheck;
            const isComplete = journey.progressPct === 100;
            return (
              <div
                key={journey.id}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm"
              >
                <div className="flex items-start gap-4 p-6">
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                      isComplete
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{journey.title}</h2>
                      {journey.isMandatory && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Required
                        </span>
                      )}
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                        {journey.journeyType}
                      </span>
                    </div>
                    {journey.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {journey.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {journey.durationDays} days
                      </span>
                      <span>
                        {journey.completedModules} / {journey.totalModules} modules
                      </span>
                      <span className="font-semibold text-foreground">
                        {journey.progressPct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          isComplete ? "bg-emerald-500" : "bg-primary"
                        }`}
                        style={{ width: `${journey.progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Module list */}
                <div className="border-t divide-y">
                  {journey.modules.map((mod, idx) => {
                    const locked =
                      journey.isSequential &&
                      idx > 0 &&
                      !journey.modules[idx - 1]?.completed;
                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-3 px-6 py-3 text-sm ${
                          locked ? "opacity-50" : ""
                        }`}
                      >
                        <div className="w-5 text-center">
                          {mod.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : locked ? (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{mod.title}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{FORMAT_LABELS[mod.format] ?? mod.format}</span>
                            <span>{mod.durationMinutes} min</span>
                            <span>+{mod.xpReward} XP</span>
                            {mod.score !== null && (
                              <span className="font-semibold text-foreground">
                                Score: {mod.score}%
                              </span>
                            )}
                          </div>
                        </div>
                        {!locked && !mod.completed && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
