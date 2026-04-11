import { pgEnum } from "drizzle-orm/pg-core";

// ---- Roles (PRD §3.4) ----
export const roleEnum = pgEnum("role", [
  "super_admin",
  "enterprise_admin",
  "content_manager",
  "branch_manager",
  "senior_agent",
  "sales_agent",
  "trainee",
]);

// ---- Tenant plan tiers (PRD §14.1) ----
export const planTierEnum = pgEnum("plan_tier", ["starter", "growth", "professional", "enterprise"]);

// ---- Content types (PRD §4.1) ----
export const contentTypeEnum = pgEnum("content_type", [
  "reel",
  "poster",
  "presentation",
  "document",
  "illustration",
  "battle_card",
  "audio",
  "infographic",
  "email_template",
  "whatsapp_template",
  "gif",
  "certificate",
]);

// ---- Content approval state (PRD §4.6) ----
export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",
  "pending_internal",
  "pending_compliance",
  "pending_legal",
  "approved",
  "rejected",
  "published",
  "archived",
  "expired",
]);

// ---- Tag dimensions (PRD §4.2.1 primary + §4.2.2 secondary) ----
export const tagDimensionEnum = pgEnum("tag_dimension", [
  "industry",
  "product_category",
  "specific_product",
  "sales_stage",
  "customer_persona",
  "language",
  "campaign",
  "geography",
  "channel",
  "compliance_status",
  "difficulty",
]);

// ---- Share channels (PRD §10) ----
export const shareChannelEnum = pgEnum("share_channel", [
  "whatsapp",
  "email",
  "sms",
  "copy_link",
  "in_app",
]);

// ---- Reel creator type (PRD §5.2) ----
export const reelCreatorEnum = pgEnum("reel_creator_type", ["admin", "agent", "ai_generated"]);

// ---- Reel review state (PRD §5.2.1 step 18) ----
export const reelReviewEnum = pgEnum("reel_review_state", [
  "private",
  "pending_review",
  "team_published",
  "company_published",
  "rejected",
]);

// ---- Lead lifecycle stages (PRD §9.1) ----
export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "contacted",
  "interested",
  "meeting_scheduled",
  "proposal_sent",
  "under_consideration",
  "closed_won",
  "closed_lost",
  "dormant",
]);

// ---- Lead activity kinds (PRD §9.1 agent actions) ----
export const leadActivityKindEnum = pgEnum("lead_activity_kind", [
  "call",
  "whatsapp",
  "sms",
  "email",
  "meeting",
  "content_share",
  "illustration_share",
  "note",
  "follow_up",
  "stage_change",
]);

// ---- Learning journey types (PRD §8.1.1) ----
export const journeyTypeEnum = pgEnum("journey_type", [
  "onboarding",
  "product",
  "skill",
  "certification",
  "campaign",
]);

// ---- Learning module formats (PRD §8.1.2) ----
export const moduleFormatEnum = pgEnum("module_format", [
  "video_lesson",
  "audio_clip",
  "flashcards",
  "quiz",
  "scenario_case_study",
  "ai_role_play",
  "infographic",
  "webinar",
]);

// ---- Copilot meeting modes (PRD §7) ----
export const copilotModeEnum = pgEnum("copilot_mode", [
  "pre_meeting",
  "during_meeting",
  "post_meeting",
  "manager",
  "adhoc",
]);

// ---- Copilot message role ----
export const copilotMessageRoleEnum = pgEnum("copilot_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

// ---- Illustration product types (PRD §6) ----
export const illustrationProductEnum = pgEnum("illustration_product", [
  "term_plan",
  "ulip",
  "health_insurance",
  "home_loan",
  "sip",
  "mutual_fund",
  "credit_card",
  "auto_loan",
  "personal_loan",
]);

// ---- WhatsApp message direction / status ----
export const whatsappDirectionEnum = pgEnum("whatsapp_direction", ["inbound", "outbound"]);
export const whatsappStatusEnum = pgEnum("whatsapp_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "received",
]);
export const whatsappMessageTypeEnum = pgEnum("whatsapp_message_type", [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "template",
  "interactive",
  "sticker",
  "location",
  "contacts",
]);

// ---- Notification kinds ----
export const notificationTypeEnum = pgEnum("notification_type", [
  "content_published",
  "content_assigned",
  "reel_assigned",
  "mandatory_training_due",
  "lead_opened_content",
  "lead_requested_callback",
  "manager_announcement",
  "campaign_started",
  "approval_requested",
  "approval_approved",
  "approval_rejected",
  "system",
]);

// ---- Audit actions ----
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "read",
  "update",
  "delete",
  "publish",
  "archive",
  "share",
  "login",
  "logout",
  "impersonate",
  "export",
  "bulk_import",
  "approve",
  "reject",
]);

// ---- Compliance regimes tracked per asset ----
export const complianceRegimeEnum = pgEnum("compliance_regime", [
  "irdai",
  "sebi",
  "rbi",
  "amfi",
  "pfrda",
  "dpdp",
  "trai",
  "none",
]);

// ---- Personalization zone types (PRD §4.5.2) ----
export const personalizationZoneEnum = pgEnum("personalization_zone", [
  "fixed",
  "agent_personalizable",
  "customer_data_input",
  "brand_locked",
]);

// ---- Campaign state (PRD §12.3) ----
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
]);
