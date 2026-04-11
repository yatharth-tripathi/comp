import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { RolePlayRunner } from "@/components/role-play/runner";

interface ScenarioPayload {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  personaJson: {
    name: string;
    age: number;
    profession: string;
    city: string;
    archetype: string;
    hotButtons: string[];
  };
  openingStatement: string;
  stepsJson: Array<{
    speaker: string;
    text: string;
    expectedAction?: string;
    hints?: string[];
  }>;
}

interface StartSessionPayload {
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
    openingStatement: string;
    steps: Array<{
      speaker: string;
      text: string;
      expectedAction?: string;
      hints?: string[];
    }>;
  };
  firstCustomerMessage: string;
  initialMood: number;
}

export const metadata = { title: "Role-Play · Live session" };
export const dynamic = "force-dynamic";

export default async function RolePlayRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const sp = await searchParams;
  const mode = sp.mode === "test_me" ? "test_me" : "try_me";

  // Verify the scenario exists (for fast notFound)
  try {
    await apiFetch<ScenarioPayload>(`/api/role-play/scenarios/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }

  // Start the session on the server side so the first customer line + sessionId
  // are available before the client component mounts
  let session: StartSessionPayload;
  try {
    session = await apiFetch<StartSessionPayload>("/api/role-play/sessions/start", {
      method: "POST",
      body: { scenarioId: id },
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(`Failed to start session: ${error.message}`);
    }
    throw error;
  }

  return <RolePlayRunner session={session} mode={mode} />;
}
