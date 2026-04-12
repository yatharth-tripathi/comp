import { apiFetch } from "@/lib/api-client";
import { WhatsAppDashboard } from "@/components/whatsapp/whatsapp-dashboard";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
}

export default async function WhatsAppPage(): Promise<JSX.Element> {
  let templates: Template[] = [];
  try {
    templates = await apiFetch<Template[]>("/api/whatsapp/templates");
  } catch {
    templates = [];
  }

  return <WhatsAppDashboard templates={templates} />;
}
