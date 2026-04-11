import { NEXUS_CORE_IDENTITY } from "./identity.js";
import { NEXUS_REGULATORY_KNOWLEDGE } from "./regulatory.js";
import { NEXUS_PRODUCT_KNOWLEDGE } from "./products.js";
import { NEXUS_CONVERSATION_SKILLS } from "./skills.js";
import { NEXUS_SCORING_PHILOSOPHY } from "./scoring.js";

/**
 * Prompt builders for Claude.
 *
 * The key design choice: the ~5k token NEXUS base block is ALWAYS the first
 * system block, and is marked with `cache_control: { type: "ephemeral" }`.
 * Anthropic prompt caching gives us a ~90% discount on reads after the
 * first cache-write. A single role-play session with 15 turns becomes
 * fundamentally cheap after the first turn.
 *
 * Each builder returns an `AnthropicMessageInput` shape that the api
 * service layer passes straight into `anthropic.messages.create()`.
 */

// ---------------------------------------------------------------------------
// Types — intentionally narrow so the api layer can't accidentally drop
// cache markers or swap the order of blocks.
// ---------------------------------------------------------------------------
export interface NexusSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export interface NexusMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NexusPrompt {
  system: NexusSystemBlock[];
  messages: NexusMessage[];
}

export interface ScenarioPersona {
  name: string;
  age: number;
  profession: string;
  city: string;
  personality: string;
  goal: string;
  archetype: string;
  moodInitial: number;
  hotButtons: string[];
  aiPersonaPrompt: string;
}

export interface ScoringRule {
  skill: string;
  weight: number;
  keywords?: string[];
}

export interface ComplianceRules {
  hardBanned: string[];
  violationPenalty: number;
  violationMessage: string;
}

// ---------------------------------------------------------------------------
// Shared base — the cached block. This is the ~5k token regulatory brain
// that every mode reuses.
// ---------------------------------------------------------------------------
const NEXUS_BASE = `${NEXUS_CORE_IDENTITY}

${NEXUS_REGULATORY_KNOWLEDGE}

${NEXUS_PRODUCT_KNOWLEDGE}

${NEXUS_CONVERSATION_SKILLS}`;

// ---------------------------------------------------------------------------
// Mode 1: CUSTOMER TURN
// The LLM plays the customer in a live role-play conversation. Mood is
// tracked implicitly and reported as MOOD_DELTA at the end of each turn.
// ---------------------------------------------------------------------------
export interface CustomerTurnInput {
  persona: ScenarioPersona;
  currentMood: number;
  conversationHistory: NexusMessage[];
  /** Current step text from the scenario ladder — guides the customer's next beat. */
  stepContext?: string;
  complianceRules?: ComplianceRules;
}

export function buildCustomerTurnPrompt(input: CustomerTurnInput): NexusPrompt {
  const hotButtonsText =
    input.persona.hotButtons.length > 0
      ? `Hot buttons (topics that trigger an emotional reaction): ${input.persona.hotButtons.join(", ")}`
      : "";

  const complianceHint = input.complianceRules?.hardBanned.length
    ? `\n\nIf the RM uses any of these banned phrases, shut down emotionally and briefly call it out as a customer would (don't cite the regulator — you're a customer, not a compliance officer):\n${input.complianceRules.hardBanned.map((p) => `  - "${p}"`).join("\n")}`
    : "";

  const personaBlock = `MODE: ROLE-PLAY CUSTOMER SIMULATION.

You are playing the CUSTOMER in a training simulation for a new Relationship Manager (RM). The RM is a trainee — your job is to be a realistic, challenging, but fair customer. Never break character. Never mention that you are an AI. Never coach the trainee inside the conversation — the trainee will be scored separately afterwards.

CUSTOMER IDENTITY:
Name: ${input.persona.name}
Age: ${input.persona.age}
Profession: ${input.persona.profession}
City: ${input.persona.city}
Archetype: ${input.persona.archetype}

Personality: ${input.persona.personality}

Primary goal: ${input.persona.goal}

Current mood: ${input.currentMood}/10 (1 = hostile, 10 = delighted).

${hotButtonsText}

Deep persona instructions:
${input.persona.aiPersonaPrompt}

${input.stepContext ? `\nCurrent scenario beat: ${input.stepContext}` : ""}
${complianceHint}

RESPONSE FORMAT — critical:
  1. Respond in 1-3 sentences as the customer. Natural Indian English. Never narrate your thoughts or emotions in brackets. Never describe what you're doing ("*crosses arms*"). Speak as the customer would speak.
  2. On the very last line, append: MOOD_DELTA: <signed integer -3..+3>
     - Positive delta = RM earned trust or gave you real value this turn.
     - Zero = neutral turn, nothing moved.
     - Negative = RM pushed, mis-sold, ignored your concerns, or used a banned phrase.
  3. Never wrap your response in quotes.
  4. Never include the string "[CUSTOMER]:" or similar labels — just say the line.

Your mood must drift over the conversation based on what the RM actually does. If they listen, you warm up. If they push, you cool. If they mis-sell, you shut down.`;

  return {
    system: [
      {
        type: "text",
        text: NEXUS_BASE,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: personaBlock,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: input.conversationHistory,
  };
}

// ---------------------------------------------------------------------------
// Mode 2: EVALUATOR
// The LLM scores the full conversation against the scenario rubric and
// returns a structured JSON payload.
// ---------------------------------------------------------------------------
export interface EvaluatorInput {
  scenarioTitle: string;
  scenarioCategory: string;
  difficulty: string;
  persona: ScenarioPersona;
  evaluationRules: ScoringRule[];
  complianceRules: ComplianceRules;
  conversationHistory: NexusMessage[];
  userResponses: string[];
  moodTrajectory: number[];
}

export function buildEvaluatorPrompt(input: EvaluatorInput): NexusPrompt {
  const skillsList = input.evaluationRules
    .map((r) => `  - ${r.skill} (max ${r.weight} points)`)
    .join("\n");
  const bannedList = input.complianceRules.hardBanned
    .map((p) => `  - "${p}"`)
    .join("\n");

  const moodLine = input.moodTrajectory.length
    ? `Mood trajectory across the session: ${input.moodTrajectory.join(" → ")}`
    : "Mood trajectory: not recorded";

  const conversationText = input.conversationHistory
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n");

  const responsesText = input.userResponses
    .map((r, i) => `Response ${i + 1}: "${r}"`)
    .join("\n");

  const rubricBlock = `${NEXUS_SCORING_PHILOSOPHY}

═══════════════════════════════════════════════════════════
SCENARIO CONTEXT FOR THIS EVALUATION
═══════════════════════════════════════════════════════════

Scenario: ${input.scenarioTitle}
Category: ${input.scenarioCategory}
Difficulty: ${input.difficulty}

Customer persona:
  Name: ${input.persona.name}
  Profession: ${input.persona.profession} · Age ${input.persona.age} · ${input.persona.city}
  Archetype: ${input.persona.archetype}
  Goal: ${input.persona.goal}
  Personality: ${input.persona.personality}

SCORING DIMENSIONS (per scenario config):
${skillsList}

COMPLIANCE HARD-BAN LIST (each use = violation, see compliance override rule):
${bannedList}
Violation penalty per instance: -${input.complianceRules.violationPenalty} points.

${moodLine}

═══════════════════════════════════════════════════════════
FULL CONVERSATION TO EVALUATE
═══════════════════════════════════════════════════════════
${conversationText}

═══════════════════════════════════════════════════════════
THE TRAINEE'S EXACT RESPONSES (the lines you are scoring)
═══════════════════════════════════════════════════════════
${responsesText}

EVALUATE NOW. Return ONLY the JSON object specified in the NEXUS scoring philosophy above. No markdown fences. No preamble. No trailing commentary.`;

  return {
    system: [
      {
        type: "text",
        text: NEXUS_BASE,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: rubricBlock,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          "Score the RM's performance on the conversation above. Return the JSON object only.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mode 3: SHOW ME
// The LLM generates an ideal 15+ exchange masterclass conversation for a
// given scenario — the trainee watches it like a film before attempting
// the scenario themselves.
// ---------------------------------------------------------------------------
export interface ShowMeInput {
  scenarioTitle: string;
  scenarioCategory: string;
  difficulty: string;
  persona: ScenarioPersona;
  evaluationRules: ScoringRule[];
  complianceRules: ComplianceRules;
  openingStatement: string;
}

export function buildShowMePrompt(input: ShowMeInput): NexusPrompt {
  const skillsList = input.evaluationRules.map((r) => `  - ${r.skill}`).join("\n");
  const bannedList = input.complianceRules.hardBanned.map((p) => `  - "${p}"`).join("\n");

  const block = `MODE: SHOW ME — MASTERCLASS DEMONSTRATION.

Generate a COMPLETE model conversation between an ideal Relationship Manager and the customer described below. The trainee will watch this as a 15-exchange masterclass. Make every RM response name the technique it uses.

SCENARIO:
Title: ${input.scenarioTitle}
Category: ${input.scenarioCategory}
Difficulty: ${input.difficulty}

Customer persona:
  Name: ${input.persona.name}
  Profession: ${input.persona.profession}, age ${input.persona.age}, ${input.persona.city}
  Personality: ${input.persona.personality}
  Goal: ${input.persona.goal}
  Archetype: ${input.persona.archetype}
  Starting mood: ${input.persona.moodInitial}/10

CUSTOMER OPENS WITH:
"${input.openingStatement}"

COMPLIANCE HARD-BAN LIST (the ideal RM NEVER uses these):
${bannedList}

SCORING DIMENSIONS this conversation should demonstrate:
${skillsList}

Return ONLY this JSON, no markdown fences, no preamble:
{
  "title": "${input.scenarioTitle}",
  "customerProfile": "One-line summary of the customer",
  "objective": "What the ideal RM must achieve in this conversation",
  "complianceWatch": "Key compliance traps specific to this scenario",
  "exchanges": [
    { "speaker": "customer", "text": "...", "technique": null },
    { "speaker": "rm", "text": "...", "technique": "Named technique and why it works" },
    ...
  ],
  "debrief": [
    { "skill": "<skill name>", "demonstrated": true, "where": "Step N" }
  ]
}

RULES:
  - MINIMUM 15 exchanges alternating customer/rm. This is a full masterclass, not a summary.
  - The ideal RM is human-excellent: warm without fake, confident without pushy. Never robotic-perfect.
  - Never let the RM mis-sell, over-promise, or skip discovery.
  - The customer is REALISTIC — at least 3 genuine objections and 1 emotional turning point.
  - Show the full arc: rapport → discovery → education → objection handling → recommendation → compliance disclosure → close.
  - Use natural Indian English.
  - Every RM line must name the conversation technique it uses (mirroring, labeling, ARE, calibrated questions, etc.).`;

  return {
    system: [
      {
        type: "text",
        text: NEXUS_BASE,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: block,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          "Generate the complete SHOW ME masterclass for the scenario described above. Return JSON only.",
      },
    ],
  };
}
