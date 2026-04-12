import { NEXUS_CORE_IDENTITY } from "./identity.js";
import { NEXUS_REGULATORY_KNOWLEDGE } from "./regulatory.js";
import { NEXUS_PRODUCT_KNOWLEDGE } from "./products.js";
import { NEXUS_CONVERSATION_SKILLS } from "./skills.js";
import type { NexusMessage, NexusSystemBlock } from "./prompts.js";

/**
 * Copilot prompt builders — PRD §7.
 *
 * The Copilot is not a chatbot. It is an ACTION-TAKING sales assistant
 * that has tools (illustrations, content lookup, battle cards). It
 * operates in one of five modes, each with a different persona:
 *
 *   pre_meeting  — "I'm about to meet <customer>. Brief me."
 *   during_meeting — "Customer is asking about <topic>. Help me."
 *   post_meeting — "Meeting done. Write the follow-up."
 *   manager — "Who on my team hasn't logged activity this week?"
 *   adhoc — open-ended sales Q&A
 *
 * All modes share the NEXUS_BASE cached block so the cost is near-zero
 * after the first query in a session.
 */

const NEXUS_BASE = `${NEXUS_CORE_IDENTITY}

${NEXUS_REGULATORY_KNOWLEDGE}

${NEXUS_PRODUCT_KNOWLEDGE}

${NEXUS_CONVERSATION_SKILLS}`;

// ---------------------------------------------------------------------------
// Tool definitions — the Copilot can invoke these during a conversation.
// The API layer maps tool calls to real service calls.
// ---------------------------------------------------------------------------
export const COPILOT_TOOLS = [
  {
    name: "generate_illustration",
    description:
      "Generate a personalized product illustration (term plan, SIP, home loan, health insurance) for a customer. Returns a shareable URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        productType: {
          type: "string",
          enum: ["term_plan", "sip", "home_loan", "health_insurance"],
        },
        customerName: { type: "string" },
        customerAge: { type: "number" },
        customerGender: { type: "string", enum: ["male", "female", "other"] },
        sumAssuredOrAmount: { type: "number", description: "Sum assured (insurance) or loan amount / SIP amount" },
        termYears: { type: "number" },
      },
      required: ["productType", "customerName"],
    },
  },
  {
    name: "search_content",
    description:
      "Search the content library for posters, battle cards, documents, or videos by keyword or product name. Returns top 5 matches.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        contentType: {
          type: "string",
          enum: ["poster", "document", "battle_card", "video", "any"],
        },
      },
      required: ["query"],
    },
  },
  {
    name: "draft_whatsapp_followup",
    description:
      "Draft a personalized WhatsApp follow-up message for a customer after a meeting. Include the key discussion points and next steps.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerName: { type: "string" },
        discussionSummary: { type: "string" },
        nextSteps: { type: "string" },
        illustrationUrl: { type: "string", description: "Optional URL to include" },
      },
      required: ["customerName", "discussionSummary"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Mode-specific system instructions
// ---------------------------------------------------------------------------
const MODE_INSTRUCTIONS: Record<string, string> = {
  pre_meeting: `MODE: PRE-MEETING BRIEFING.

The agent is about to walk into a customer meeting. Your job is to arm them with:
1. A suggested OPENING — the first 30 seconds of the conversation.
2. A PERSONA BRIEF — what this customer type typically cares about (based on age, income, life stage).
3. TOP 3 PRODUCTS to lead with and why (product names from the knowledge base, not generic).
4. MOST LIKELY OBJECTIONS this customer will raise and a 1-sentence handling for each.
5. SUGGESTED CONTENT — call the search_content tool to find the most relevant poster or battle card.
6. COMPLIANCE REMINDER — any recent regulatory rule relevant to the product.

Be concise. The agent is reading this on their phone in the parking lot before walking in. Bullet points, not essays.`,

  during_meeting: `MODE: DURING-MEETING ASSIST.

The agent is IN a customer meeting and needs real-time help. Respond in under 3 sentences. Be action-oriented:
- If they ask about a product feature → give the exact fact from the knowledge base.
- If the customer has an objection → give the ARE pattern response (Acknowledge-Reframe-Evidence).
- If they need an illustration → call generate_illustration and return the URL.
- If they need a comparison → call search_content for the relevant battle card.
- NEVER respond with a disclaimer wall during a meeting. One sentence max, then the answer.

Speed matters more than completeness here. 3 seconds to first useful word.`,

  post_meeting: `MODE: POST-MEETING WRAP-UP.

The agent just finished a meeting and is debriefing. Help them:
1. LOG a summary of what was discussed (ask them to describe it if they haven't).
2. DRAFT a personalized WhatsApp follow-up message using draft_whatsapp_followup tool — reference specific things the customer said, include the illustration URL if one was shared.
3. SUGGEST a follow-up date and what content to send next.
4. RECOMMEND the next piece of content to share in 2 days if no response.
5. Update the lead status mentally (the agent will do it in the UI, but you should suggest the right stage).

Tone: warm and organized. The agent is tired after a real conversation. Don't make them think hard.`,

  manager: `MODE: MANAGER ASSISTANT.

The user is a branch manager or team lead. They need team-level insights:
- "Who hasn't logged activity this week?" → answer from the data if available, or explain what data you'd need.
- "What product is my team struggling to sell?" → reference training completion and role-play scores.
- "Draft a Monday morning team briefing message" → write a WhatsApp broadcast that's motivating, specific, and includes a CTA.
- "What content should I push this week?" → use search_content to find relevant items.

Be data-driven. Name names if the data is there. Be honest about gaps.`,

  adhoc: `MODE: OPEN Q&A.

The agent has a general question about BFSI products, regulations, or sales techniques. Answer from the NEXUS knowledge base. If the question touches compliance, cite the regulator. If it touches a product, name the specific product category. Keep answers under 4 sentences unless the agent asks for detail.`,
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
export interface CopilotPromptInput {
  mode: string;
  customerContext?: {
    name?: string;
    age?: number;
    profession?: string;
    income?: string;
    lifeStage?: string;
    existingProducts?: string[];
  };
  productFocus?: string;
  conversationHistory: NexusMessage[];
}

export interface CopilotPrompt {
  system: NexusSystemBlock[];
  messages: NexusMessage[];
  tools: typeof COPILOT_TOOLS;
}

export function buildCopilotPrompt(input: CopilotPromptInput): CopilotPrompt {
  const modeInstructions = MODE_INSTRUCTIONS[input.mode] ?? MODE_INSTRUCTIONS.adhoc!;

  let contextBlock = "";
  if (input.customerContext) {
    const c = input.customerContext;
    const parts = [
      c.name && `Customer: ${c.name}`,
      c.age && `Age: ${c.age}`,
      c.profession && `Profession: ${c.profession}`,
      c.income && `Income: ${c.income}`,
      c.lifeStage && `Life stage: ${c.lifeStage}`,
      c.existingProducts?.length && `Existing products: ${c.existingProducts.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
    if (parts) contextBlock = `\n\nCUSTOMER CONTEXT:\n${parts}`;
  }
  if (input.productFocus) {
    contextBlock += `\n\nPRODUCT FOCUS: ${input.productFocus}`;
  }

  return {
    system: [
      {
        type: "text",
        text: NEXUS_BASE,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `${modeInstructions}${contextBlock}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: input.conversationHistory,
    tools: COPILOT_TOOLS,
  };
}
