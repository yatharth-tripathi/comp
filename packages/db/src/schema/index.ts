/**
 * SalesContent AI — Drizzle schema root
 * Every table in the PRD, grouped by module. Add new tables to their module
 * file and re-export here so drizzle-kit picks them up.
 */

export * from "./enums";
export * from "./tenants";
export * from "./users";
export * from "./content";
export * from "./share-events";
export * from "./reels";
export * from "./illustrations";
export * from "./copilot";
export * from "./learning";
export * from "./leads";
export * from "./whatsapp";
export * from "./admin";
export * from "./audit";
export * from "./notifications";
export * from "./api-keys";
