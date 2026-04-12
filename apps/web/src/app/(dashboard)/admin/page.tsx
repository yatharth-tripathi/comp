import { apiFetch } from "@/lib/api-client";
import { AdminPanelView } from "@/components/admin/admin-panel-view";

export const metadata = { title: "Admin Panel" };
export const dynamic = "force-dynamic";

export default async function AdminPage(): Promise<JSX.Element> {
  const [tenant, apiKeys, campaigns, auditLogs] = await Promise.all([
    apiFetch("/api/tenants/me").catch(() => null),
    apiFetch("/api/api-keys").catch(() => null),
    apiFetch("/api/admin/campaigns").catch(() => null),
    apiFetch("/api/admin/audit-logs?limit=20").catch(() => null),
  ]);

  return (
    <AdminPanelView
      tenant={tenant as Record<string, unknown> | null}
      apiKeys={(apiKeys ?? []) as Array<Record<string, unknown>>}
      campaigns={(campaigns ?? []) as Array<Record<string, unknown>>}
      auditLogs={(auditLogs ?? []) as Array<Record<string, unknown>>}
    />
  );
}
