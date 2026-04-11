import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { EvaluationScreen } from "@/components/role-play/evaluation-screen";

interface SessionDetail {
  id: string;
  scenarioId: string;
  moodTrajectory: number[];
  evaluationJson: Record<string, unknown>;
  scenario: {
    id: string;
    title: string;
  };
}

export const metadata = { title: "Role-Play Report" };
export const dynamic = "force-dynamic";

export default async function RolePlayResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  let session: SessionDetail | null = null;
  try {
    session = await apiFetch<SessionDetail>(`/api/role-play/sessions/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
  if (!session || !session.evaluationJson) notFound();

  const evaluation = session.evaluationJson as unknown as Parameters<
    typeof EvaluationScreen
  >[0]["evaluation"];

  return (
    <EvaluationScreen
      evaluation={evaluation}
      session={{
        id: session.id,
        scenarioId: session.scenarioId,
        scenarioTitle: session.scenario.title,
        moodTrajectory: session.moodTrajectory,
      }}
    />
  );
}
