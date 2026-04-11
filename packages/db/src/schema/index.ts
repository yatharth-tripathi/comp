/**
 * SalesContent AI — Drizzle schema root
 * Every table in the PRD, grouped by module. Add new tables to their module
 * file and re-export here so drizzle-kit picks them up.
 */

export * from "./enums.js";
export * from "./tenants.js";
export * from "./users.js";
export * from "./content.js";
export * from "./share-events.js";
export * from "./reels.js";
export * from "./illustrations.js";
export * from "./copilot.js";
export * from "./learning.js";
export * from "./leads.js";
export * from "./whatsapp.js";
export * from "./admin.js";
export * from "./audit.js";
export * from "./notifications.js";
export * from "./api-keys.js";
