import { HEALTH_FAMILY_PRESSURE } from "./health-family-pressure.js";
import { MF_SKEPTICS_FORTRESS } from "./mf-skeptics-fortress.js";
import { TERM_PLAN_PROCRASTINATOR } from "./term-plan-procrastinator.js";
import type { SeedScenario } from "./types.js";

/**
 * The built-in scenario catalog. On first visit to /api/role-play/scenarios
 * for a tenant, the API copies these rows into the tenant's
 * role_play_scenarios table. Tenants can then edit, clone, or add their own.
 *
 * The catalog is intentionally small but deep — three scenarios, each a
 * 15+ exchange ladder with full compliance rules, scoring weights, and
 * ideal-keyword lists. Quality over quantity is the product principle.
 */
export const SEED_SCENARIOS: readonly SeedScenario[] = [
  MF_SKEPTICS_FORTRESS,
  TERM_PLAN_PROCRASTINATOR,
  HEALTH_FAMILY_PRESSURE,
];

export { HEALTH_FAMILY_PRESSURE, MF_SKEPTICS_FORTRESS, TERM_PLAN_PROCRASTINATOR };
export type { SeedScenario, ScenarioStep } from "./types.js";
