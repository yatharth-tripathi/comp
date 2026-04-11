/**
 * Thin shared type aliases for the API. We keep these out of middleware files
 * so a route importing a single type doesn't drag middleware code with it.
 */
export type AuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "publish"
  | "archive"
  | "share"
  | "login"
  | "logout"
  | "impersonate"
  | "export"
  | "bulk_import"
  | "approve"
  | "reject";

export type Role =
  | "super_admin"
  | "enterprise_admin"
  | "content_manager"
  | "branch_manager"
  | "senior_agent"
  | "sales_agent"
  | "trainee";
