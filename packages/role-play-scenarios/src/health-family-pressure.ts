import type { SeedScenario } from "./types.js";

/**
 * THE FAMILY PRESSURE — Health Insurance (MEDIUM).
 *
 * Anjali Kulkarni, 28, works at a consulting firm in Mumbai. Her parents
 * (father 62, mother 58) have been asking her to get them health cover
 * because theirs expired when her father retired. She WANTS to help, but
 * her company's cover is ₹3L — nowhere near enough — and she's stressed
 * because she doesn't understand how floater vs individual works, what
 * sum insured is appropriate, and how to handle her father's diabetes
 * disclosure.
 *
 * This scenario is a DISCOVERY + EDUCATION challenge. There's no hostile
 * customer. There's a customer who needs the trainee to walk her through
 * the decision, clearly, without jargon, respecting her fear about her
 * parents' health. The trainee must NOT push expensive add-ons she doesn't
 * need, and must be crystal clear about the 36-month pre-existing waiting
 * period — which is the single most claim-time heartbreak in health
 * insurance.
 */
export const HEALTH_FAMILY_PRESSURE: SeedScenario = {
  slug: "health-family-pressure",
  title: "The Family Pressure — Health Insurance for Parents",
  description:
    "Anjali's parents need health cover. Her father has diabetes. She has a stressful job and doesn't understand floater vs individual, doesn't know what sum insured is appropriate, and is terrified of claim rejection. Walk her through the decision without jargon.",
  category: "discovery",
  difficulty: "medium",
  xpReward: 120,
  language: "en",
  tags: [
    "health-insurance",
    "family-floater",
    "pre-existing",
    "discovery",
    "education",
    "parents",
  ],
  persona: {
    name: "Anjali Kulkarni",
    age: 28,
    profession: "Consulting Associate",
    city: "Mumbai",
    archetype: "CONCERNED_PLANNER",
    personality:
      "Smart, earnest, anxious. Knows the basics but doesn't trust herself on specifics. Asks a lot of 'what if' questions. Highly sensitive to claim-rejection stories. Will NOT buy the same day — needs to think and discuss with her parents, which is a FEATURE not a bug of this scenario.",
    goal: "Get her parents adequate health cover in Mumbai at a price she can sustain from her own salary, without risking claim rejection because of her father's diabetes.",
    moodInitial: 6,
    hotButtons: [
      "claim rejection",
      "pre-existing",
      "waiting period",
      "father's diabetes",
      "room rent",
      "co-pay",
      "sub-limit",
    ],
    aiPersonaPrompt: `You are Anjali Kulkarni, 28, working at a management consulting firm in Mumbai. You earn ₹18 lakh per year. Your parents — father Ramesh (62, retired schoolteacher) and mother Sunita (58, homemaker) — live in Pune in your family home. Your father's employer cover lapsed when he retired last year. Your father was diagnosed with type 2 diabetes 7 years ago and is on metformin.

You've been saving for 8 months to buy health insurance for them. You have ₹85k set aside. You know the basics (family floater vs individual, sum insured, deductible) but you DON'T trust yourself on the details. You have two colleagues who had claims REJECTED at the hospital because of "non-disclosure" issues — that terrifies you.

Behavior rules:
- Start calm, respectful. You've come prepared with questions.
- You'll listen carefully and take mental notes.
- You'll ask detailed follow-ups about pre-existing diseases and the waiting period — this is your biggest fear.
- If the trainee uses jargon (like 'sub-limit', 'room rent cap', 'OPD rider') WITHOUT explaining, you'll politely ask them to explain.
- If the trainee tries to push you on the same day, you'll politely say you want to discuss with your parents first — this is non-negotiable and CORRECT behavior for the trainee to respect.
- You'll warm up significantly when the trainee PROACTIVELY mentions the 36-month pre-existing waiting period without you asking.
- If the trainee glosses over the diabetes disclosure, you'll get noticeably cooler (mood -2).
- Keep responses 2-4 sentences. Slightly anxious, careful, asks follow-up questions.`,
  },
  openingStatement:
    "Hi — thank you for making time. I need to get a health policy for my parents in Pune. My father's cover lapsed when he retired and he's diabetic. I've been reading online but I'm honestly a bit overwhelmed. Can you help me figure out what's right for them?",
  steps: [
    // Round 1 — Discovery
    {
      speaker: "customer",
      text: "Hi — thank you for making time. I need to get a health policy for my parents in Pune. My father's cover lapsed when he retired and he's diabetic. I've been reading online but I'm honestly a bit overwhelmed. Can you help me figure out what's right for them?",
    },
    {
      speaker: "system",
      text: "Round 1 OBJECTIVE: Proper discovery. Ask about ages, city of residence, existing conditions, budget, any hospitals they prefer. Do NOT jump to a product recommendation.",
      expectedAction:
        "Thank her for coming prepared. Ask the discovery ladder: ages, existing conditions, preferred hospital network, her budget, city (affects premium), who else might be covered",
      hints: [
        "Ask parents' ages",
        "Ask about the diabetes specifically — how long, on medication, any complications",
        "Ask about city (Pune vs Mumbai matters for premium)",
        "Ask her monthly budget for this",
        "Ask if she wants to include herself (you could suggest her own employer cover is enough)",
      ],
      idealKeywords: [
        "ages",
        "how long",
        "diabetes",
        "controlled",
        "Pune",
        "budget",
        "hospitals",
        "yourself",
      ],
      bannedPhrases: ["don't worry", "we have the best plan", "trust me"],
      scoring: { Discovery: 25, Empathy: 10 },
    },

    // Round 2 — The diabetes question
    {
      speaker: "customer",
      text: "Father is 62, mother 58. Dad's been on metformin for 7 years, blood sugar is well controlled, no complications. Our budget for the whole thing is about ₹40,000 a year if possible. But — here's what I'm really worried about. I've heard of people being rejected at the hospital because of 'pre-existing disease'. How do I make sure that doesn't happen to us?",
    },
    {
      speaker: "system",
      text: "Round 2 OBJECTIVE: The KILLER question. She's asking about pre-existing waiting period. You MUST explain clearly: the 36-month waiting period for disclosed pre-existing conditions, and the critical importance of full disclosure on the application form.",
      expectedAction:
        "Explain the 36-month waiting period clearly. Explain that the DIABETES MUST be fully disclosed on the application form — under-disclosure is the #1 cause of claim rejection. Reassure her that disclosure is her safety, not her enemy.",
      hints: [
        "Explain 36-month pre-existing disease waiting period clearly",
        "Explain: disclose EVERYTHING on the form — diabetes, medication, any hospital visits",
        "Tell her: 'Non-disclosure, not disclosure, is what gets claims rejected'",
        "Reassure: for anything UNRELATED to diabetes (an accident, a surgery for something else), there's only a 30-day initial waiting period",
      ],
      idealKeywords: [
        "36 months",
        "pre-existing",
        "disclose",
        "full disclosure",
        "application form",
        "30 days",
        "unrelated",
        "diabetes",
        "metformin",
      ],
      bannedPhrases: [
        "don't mention the diabetes",
        "just say it's under control",
        "we can work around",
        "hide",
      ],
      scoring: { Compliance: 25, "Product Knowledge": 15, Empathy: 15 },
    },

    // Round 3 — Floater vs individual
    {
      speaker: "customer",
      text: "Okay, that's actually reassuring. So full disclosure. Now — floater or individual? My friend said floater is cheaper, but I don't know the trade-off.",
    },
    {
      speaker: "system",
      text: "Round 3 OBJECTIVE: Explain floater vs individual HONESTLY for her parents' specific case. Two senior citizens where one has a chronic condition — individual is usually better because one major claim doesn't exhaust the floater for the other parent.",
      expectedAction:
        "Explain: floater is a SHARED pool, individual is per-person. For two seniors with one chronic condition, individual is often better because Dad's claim doesn't eat into Mom's cover.",
      hints: [
        "Floater = shared pool, cheaper upfront",
        "Individual = per person, more expensive but each parent has their own cover",
        "For their specific case: Dad's diabetes means he's more likely to claim, so individual is safer for Mom",
        "Use a concrete example: 'If Dad has a ₹6L claim on a ₹10L floater, Mom only has ₹4L left for the rest of the year'",
      ],
      idealKeywords: [
        "floater",
        "individual",
        "shared pool",
        "per person",
        "diabetes",
        "higher claim risk",
        "safer",
        "Mom's cover",
      ],
      bannedPhrases: ["whatever you want", "same same", "doesn't matter"],
      scoring: { "Product Knowledge": 20, "Communication Clarity": 15 },
    },

    // Round 4 — Sum insured sizing
    {
      speaker: "customer",
      text: "Individual makes sense, thank you. So what sum insured should I pick for each of them? Mumbai hospital bills scare me — I know a basic bypass can be ₹8 lakh.",
    },
    {
      speaker: "system",
      text: "Round 4 OBJECTIVE: Right-size the cover. In a metro like Mumbai, ₹10L per senior is the realistic floor. Propose ₹10L base + super top-up rider for the father given diabetes, or ₹15L base if the budget allows.",
      expectedAction:
        "Explain that ₹10L is the metro floor for seniors. Propose ₹10L individual for each OR ₹10L base + ₹15L super top-up for the father. Stay within her ₹40k budget.",
      hints: [
        "₹10L is the metro floor for seniors — ₹5L is inadequate",
        "Super top-up is a clever way to increase effective cover without paying full premium — explain it",
        "For her ₹40k/year budget, ₹10L individual each is realistic for ~₹32-36k/year (indicative)",
        "Mention that the premium will be higher for the father due to age + diabetes disclosure",
      ],
      idealKeywords: [
        "₹10 lakh",
        "metro",
        "super top-up",
        "higher for dad",
        "diabetes",
        "40,000",
        "within budget",
      ],
      bannedPhrases: ["₹3 lakh is enough", "don't need that much"],
      scoring: { "Product Knowledge": 15, "Discovery": 10, "Communication Clarity": 10 },
    },

    // Round 5 — The respect close
    {
      speaker: "customer",
      text: "This has been so helpful. I need to think about it and discuss with my parents before I commit — they're the ones who'll be using this cover. Can you send me a short summary I can show them?",
    },
    {
      speaker: "system",
      text: "Round 5 OBJECTIVE: She's asking for the right thing. Respect the household conversation. Offer the Customer Information Sheet (CIS) which is the IRDAI-mandated summary. Schedule a follow-up without pressure.",
      expectedAction:
        "Agree warmly. Offer to send the CIS + a 1-page summary. Schedule a follow-up in 3-5 days. No pressure.",
      hints: [
        "Respect the family discussion — it's correct behavior",
        "Offer the Customer Information Sheet (CIS) — IRDAI requires every insurer to provide this",
        "Offer a 1-page comparison summary as well",
        "Schedule a follow-up call or meeting in 3-5 days",
        "Tell her to feel free to call with any question between now and then",
      ],
      idealKeywords: [
        "CIS",
        "Customer Information Sheet",
        "IRDAI",
        "1-page",
        "summary",
        "follow up",
        "no pressure",
        "any question",
      ],
      bannedPhrases: [
        "we need to close today",
        "special offer expires",
        "you'll lose the rate",
      ],
      scoring: { Empathy: 15, Closing: 15, Compliance: 10 },
    },
  ],
  evaluationRules: [
    { skill: "Empathy", weight: 20, keywords: ["sounds like", "understand", "respect"] },
    {
      skill: "Discovery",
      weight: 15,
      keywords: ["ages", "diabetes", "controlled", "hospitals", "budget"],
    },
    {
      skill: "Product Knowledge",
      weight: 20,
      keywords: [
        "36 months",
        "floater",
        "individual",
        "super top-up",
        "metro floor",
        "₹10 lakh",
      ],
    },
    { skill: "Objection Handling", weight: 10, keywords: ["disclosure", "non-disclosure"] },
    {
      skill: "Compliance",
      weight: 20,
      keywords: ["disclose", "36 months", "CIS", "IRDAI", "free-look"],
    },
    { skill: "Communication Clarity", weight: 15 },
  ],
  complianceRules: {
    hardBanned: [
      "don't disclose",
      "hide the diabetes",
      "say it's under control only",
      "guaranteed claim",
      "no rejection",
      "no waiting period",
      "we skip the medicals",
    ],
    violationPenalty: 25,
    violationMessage:
      "IRDAI violation: any suggestion of under-disclosure is fatal. It voids the policy at claim time, the insurer will reject under Section 45, and the family will be financially and emotionally devastated.",
  },
};
