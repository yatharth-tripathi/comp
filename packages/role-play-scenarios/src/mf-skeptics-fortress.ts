import type { SeedScenario } from "./types.js";

/**
 * THE SKEPTIC'S FORTRESS — Mutual Fund Advisory (EXPERT).
 *
 * Rajesh Sharma, 40, IT Manager, Pune. Has ₹10L rotting in FDs at 6%.
 * His friend lost 35% in the 2020 market crash and his wife is firmly
 * against mutual funds. He's here ONLY because his branch manager
 * personally asked him to meet the trainee. He is giving the trainee
 * exactly 5 minutes.
 *
 * This is the hardest scenario in the catalog. Every sentence is a
 * potential trust-breaker. The correct path requires genuine empathy
 * about his friend's loss, respect for his wife's viewpoint, and the
 * BAF / 3-bucket framework as the product recommendation — never a
 * guaranteed-return pitch.
 *
 * Ported and refined from the WISDORA simulator (Session 01 audit).
 */
export const MF_SKEPTICS_FORTRESS: SeedScenario = {
  slug: "mf-skeptics-fortress",
  title: "The Skeptic's Fortress — Mutual Fund Advisory",
  description:
    "Rajesh has ₹10L in FDs and is deeply hostile toward mutual funds after his friend lost 35% in the market. His wife is firmly against it. You have 5 minutes to earn his trust through cascading objections about risk, his friend's losses, commissions, and hidden charges — all while staying SEBI-compliant.",
  category: "sales",
  difficulty: "expert",
  xpReward: 200,
  language: "en",
  tags: [
    "mutual-funds",
    "objection-handling",
    "risk-profiling",
    "trust-building",
    "sebi-compliance",
    "commission-transparency",
    "behavioral-finance",
  ],
  persona: {
    name: "Rajesh Sharma",
    age: 40,
    profession: "IT Manager",
    city: "Pune",
    archetype: "SKEPTICAL_SAVER",
    personality:
      "Deeply skeptical and analytical. His friend lost money in markets so he distrusts financial advisors. His wife is firmly against mutual funds. Asks razor-sharp questions about commissions and hidden charges. Responds ONLY to data, honesty, and genuine empathy — never to sales pressure. Will walk out if he senses even a hint of manipulation.",
    goal: "Better returns than FD for daughter's college fund in 5 years, but cannot afford to lose principal.",
    moodInitial: 3,
    hotButtons: [
      "fees",
      "risk",
      "market crash",
      "commission",
      "hidden charges",
      "lock-in period",
      "guaranteed",
      "trust me",
      "better than FD",
    ],
    aiPersonaPrompt: `You are Rajesh Sharma, a 40-year-old IT Manager from Pune. You have ₹10 lakh in FDs earning 6%. Your friend Suresh invested ₹8 lakh in mutual funds in early 2020, panicked during the COVID crash, and lost 35% of his investment. Your wife Anita is firmly against mutual funds — she says "FD is safe, why gamble?" You are here ONLY because your branch manager personally requested this meeting. You are giving the RM exactly 5 minutes.

Your daughter Riya starts college in 5 years — this money is for her education. You CANNOT afford to lose it.

Behavior rules:
- Start cold and guarded. Arms crossed metaphorically.
- Do NOT volunteer information easily. Make the RM work for every detail.
- If the RM mentions "guaranteed returns" or sounds salesy, shut down immediately (mood -3).
- Warm up ONLY when you feel genuinely heard AND see honest, data-backed responses.
- When asked about your friend, get emotional — this is personal.
- Test the RM by asking about commissions — you've read articles about banks pushing MFs for commission.
- If the RM is transparent about fees, you'll respect that.
- In the final exchange, you're willing to try with ₹2 lakh (not the full 10) if genuinely convinced.
- Keep responses 1-3 sentences. Be direct, sometimes curt.
- Never say the words "as an AI" or break character.`,
  },
  openingStatement:
    "Look, I'll be direct. I have ₹10 lakh rotting in FDs at 6%. Everyone says mutual funds. But my friend Suresh invested ₹8 lakh in 2020 and lost 35% in three months. My wife says I'd be a fool to move our daughter's college fund into the market. Your branch manager insisted I meet you. So — you have five minutes.",
  steps: [
    // Round 1 — The Wall
    {
      speaker: "customer",
      text: "Look, I'll be direct. I have ₹10 lakh rotting in FDs at 6%. Everyone says mutual funds. But my friend Suresh invested ₹8 lakh in 2020 and lost 35% in three months. My wife says I'd be a fool to move our daughter's college fund into the market. Your branch manager insisted I meet you. So — you have five minutes.",
    },
    {
      speaker: "system",
      text: "Round 1 OBJECTIVE: Break through the wall. Do NOT pitch any product. Acknowledge his friend's loss (it's personal), respect his wife's concern, and ask about his daughter's college timeline. Show you're here to understand, not sell.",
      expectedAction:
        "Empathize with the friend's loss, acknowledge the wife's valid concern, ask about the daughter's education timeline and goals",
      hints: [
        "Lead with empathy about Suresh's loss — it's personal to him",
        "Don't dismiss his wife's viewpoint — say she has a valid point",
        "Ask about Riya's college timeline (5 years)",
        "Show curiosity, not salesmanship",
      ],
      idealKeywords: [
        "sorry to hear about Suresh",
        "your wife has a point",
        "daughter",
        "college",
        "timeline",
        "understand your concern",
        "what matters",
      ],
      bannedPhrases: [
        "guaranteed",
        "definitely will grow",
        "no risk at all",
        "trust me",
        "don't worry",
        "FD is bad",
        "you're making a mistake",
      ],
      scoring: { Empathy: 15, Discovery: 15, "Communication Clarity": 10 },
    },

    // Round 2 — The Guarantee Trap
    {
      speaker: "customer",
      text: "Riya starts college in 5 years. We need at least ₹12-15 lakh by then — tuition is insane now. But here's my question: can you GUARANTEE I won't lose my principal? Because if I lose even 20%, that's my daughter's future gone.",
    },
    {
      speaker: "system",
      text: "Round 2 OBJECTIVE: This is the guarantee trap. NEVER say 'guaranteed returns' on any market-linked product — SEBI violation. Honestly explain that no MF can guarantee, but introduce the Balanced Advantage Fund concept as capital protection-focused without over-promising.",
      expectedAction:
        "Refuse to promise guarantee. Explain that honesty is why you won't say 'guaranteed'. Introduce BAF or conservative hybrid as a risk-moderated category, with the SEBI risk-o-meter reference.",
      hints: [
        "NEVER say 'guaranteed'. Tell him that's by SEBI law and YOUR principle",
        "Introduce the Balanced Advantage Fund concept with honest framing",
        "Reference the SEBI risk-o-meter",
        "Mention the 5-year horizon is long enough for moderate equity exposure",
      ],
      idealKeywords: [
        "can't guarantee",
        "SEBI",
        "risk-o-meter",
        "balanced advantage",
        "BAF",
        "dynamically",
        "capital protection",
        "5-year horizon",
        "market-linked",
      ],
      bannedPhrases: [
        "guaranteed returns",
        "100% safe",
        "no risk",
        "assured maturity",
        "definitely",
        "cannot go down",
        "better than FD guaranteed",
      ],
      scoring: {
        Compliance: 25,
        "Product Knowledge": 15,
        "Objection Handling": 15,
      },
    },

    // Round 3 — The Commission Test
    {
      speaker: "customer",
      text: "Let me ask you something directly. How much commission do you make if I invest with you? I've read that banks push mutual funds because the commission is much higher than on FDs. Is that why you're here?",
    },
    {
      speaker: "system",
      text: "Round 3 OBJECTIVE: Transparency test. Don't dodge. Explain the commission structure honestly — trail commission on regular plans, lower on direct plans, and disclose that direct plans exist. This is a MAJOR trust moment.",
      expectedAction:
        "Explain trail commission structure honestly. Mention direct plan option (SEBI mandate). Acknowledge the bias concern.",
      hints: [
        "Be completely transparent about trail commission",
        "Mention that direct plans exist with lower expense ratios",
        "Acknowledge his concern is valid — banks DO have this incentive",
        "Tell him your job is not to make you buy — it's to make sure whatever you buy is right for you",
      ],
      idealKeywords: [
        "trail commission",
        "direct plan",
        "regular plan",
        "expense ratio",
        "transparency",
        "AMFI",
        "honest",
        "your concern is valid",
      ],
      bannedPhrases: ["no commission", "free service", "I don't benefit"],
      scoring: {
        Compliance: 20,
        Empathy: 10,
        "Communication Clarity": 10,
      },
    },

    // Round 4 — Friend's Loss, Reopened
    {
      speaker: "customer",
      text: "Thank you for being honest about that. But come back to Suresh. ₹8 lakh down to ₹5.2 lakh in three months. He cried at my house. How do I explain to Anita that the same thing won't happen to us?",
    },
    {
      speaker: "system",
      text: "Round 4 OBJECTIVE: The real emotional moment. Use LABELING for his feelings about Suresh. Then explain WHY Suresh's crash happened — he was in pure equity during a black swan event AND panic-sold at the bottom. BAF / conservative hybrid would have softened the blow. Show him the behavioral finance answer, not just a product.",
      expectedAction:
        "Label the emotion. Explain the 2020 crash as a specific-cause event (pure equity + panic selling). Introduce the 3-bucket framework or BAF as the structural answer to panic.",
      hints: [
        "Start with labeling: 'That sounds like it was really hard to watch'",
        "Explain that Suresh's crash was pure equity + panic selling — both avoidable",
        "Introduce the 3-bucket framework (emergency / medium / long)",
        "Show that with a 5-year horizon and BAF, the worst-case drawdown is dramatically smaller",
      ],
      idealKeywords: [
        "sounds like",
        "really hard",
        "pure equity",
        "panic",
        "3-bucket",
        "BAF",
        "dynamically",
        "5-year",
        "drawdown",
        "structural",
      ],
      bannedPhrases: ["never again", "won't happen to you", "Suresh was wrong"],
      scoring: { Empathy: 20, "Product Knowledge": 15, "Objection Handling": 10 },
    },

    // Round 5 — The Wife Test
    {
      speaker: "customer",
      text: "Alright. Say I start small. Not ₹10 lakh. Say ₹2 lakh as a test. But how do I explain this to Anita tonight? She's going to ask me the exact same questions you just answered, and if I stumble, we're done.",
    },
    {
      speaker: "system",
      text: "Round 5 OBJECTIVE: Equip him to win the household conversation. Don't try to bypass Anita — that would be disrespectful. Offer a 1-page summary or the KIM document so HE can walk her through it. Calendar the formal application for after she's agreed.",
      expectedAction:
        "Respect Anita's role. Offer a 1-page summary or KIM. Suggest he talk to her first, then come back.",
      hints: [
        "Don't try to close around Anita",
        "Offer a 1-pager or KIM document",
        "Suggest he present to her himself — you're giving him the tools",
        "Schedule a follow-up for after the household discussion",
      ],
      idealKeywords: [
        "your wife",
        "together",
        "1-page",
        "KIM",
        "take this home",
        "next week",
        "no pressure",
      ],
      bannedPhrases: [
        "don't need to tell her",
        "we can do it now",
        "trust me",
      ],
      scoring: {
        Empathy: 15,
        "Objection Handling": 15,
        Closing: 10,
      },
    },
  ],
  evaluationRules: [
    { skill: "Empathy", weight: 25, keywords: ["understand", "sounds like", "sorry", "your wife"] },
    {
      skill: "Discovery",
      weight: 15,
      keywords: ["timeline", "goal", "daughter", "college", "5 years", "how much"],
    },
    {
      skill: "Product Knowledge",
      weight: 15,
      keywords: ["BAF", "balanced advantage", "3-bucket", "conservative hybrid", "risk-o-meter"],
    },
    {
      skill: "Objection Handling",
      weight: 15,
      keywords: ["reframe", "acknowledge", "KIM", "summary", "direct plan"],
    },
    {
      skill: "Compliance",
      weight: 20,
      keywords: ["SEBI", "can't guarantee", "market risks", "trail commission", "direct plan"],
    },
    { skill: "Communication Clarity", weight: 10 },
  ],
  complianceRules: {
    hardBanned: [
      "guaranteed returns",
      "100% safe",
      "no risk",
      "assured maturity",
      "definitely will grow",
      "cannot go down",
      "better than FD guaranteed",
      "trust me",
      "I'll personally ensure",
    ],
    violationPenalty: 25,
    violationMessage:
      "SEBI violation: market-linked products cannot be pitched with guarantee language. Any use of this phrasing is a fail-condition in production.",
  },
};
