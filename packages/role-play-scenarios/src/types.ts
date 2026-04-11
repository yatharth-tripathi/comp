import type {
  ComplianceRules,
  ScenarioPersona,
  ScoringRule,
} from "@salescontent/nexus";

/**
 * Seed scenario definition — authored at build time, loaded into a
 * tenant's `role_play_scenarios` table on first access.
 *
 * This is intentionally a superset of what the DB schema stores, so a
 * seed can carry additional metadata (hints, category icons, localized
 * titles) that get dropped at seed time but are useful to keep in code.
 */
export interface ScenarioStep {
  speaker: "customer" | "system";
  text: string;
  expectedAction?: string;
  hints?: string[];
  idealKeywords?: string[];
  bannedPhrases?: string[];
  scoring?: Record<string, number>;
}

export interface SeedScenario {
  slug: string;
  title: string;
  description: string;
  category: "sales" | "compliance" | "customer_service" | "discovery" | "objection_handling";
  difficulty: "easy" | "medium" | "hard" | "expert";
  xpReward: number;
  language: string;
  tags: string[];
  persona: ScenarioPersona;
  openingStatement: string;
  steps: ScenarioStep[];
  evaluationRules: ScoringRule[];
  complianceRules: ComplianceRules;
}
