import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { ShowMeViewer } from "@/components/role-play/show-me-viewer";

interface ScenarioPayload {
  personaJson: { name: string };
}

interface ShowMePayload {
  title: string;
  customerProfile: string;
  objective: string;
  complianceWatch: string;
  exchanges: Array<{
    speaker: "customer" | "rm";
    text: string;
    technique: string | null;
  }>;
  debrief: Array<{ skill: string; demonstrated: boolean; where: string }>;
}

export const metadata = { title: "Show Me · Masterclass" };
export const dynamic = "force-dynamic";

export default async function ShowMePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;

  let scenario: ScenarioPayload | null = null;
  try {
    scenario = await apiFetch<ScenarioPayload>(`/api/role-play/scenarios/${id}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }
  if (!scenario) notFound();

  let showMeData: ShowMePayload;
  try {
    showMeData = await apiFetch<ShowMePayload>(
      `/api/role-play/scenarios/${id}/show-me`,
      { method: "POST" },
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw new Error(`Show Me generation failed: ${error.message}`);
    }
    throw error;
  }

  return (
    <ShowMeViewer
      data={showMeData}
      customerName={scenario.personaJson.name}
      customerAvatar={scenario.personaJson.name.charAt(0)}
    />
  );
}
