import type { SeedScenario } from "./types.js";

/**
 * THE PROCRASTINATOR — Term Insurance (HARD).
 *
 * Vikram Shah, 34, senior software engineer in Bangalore, just had his
 * second child. He knows he NEEDS term insurance — every article tells
 * him. But he's been saying "next month" for 18 months. His real block
 * is not about the product — it's denial about his own mortality, and
 * he's ashamed to admit it.
 *
 * The trainee has to diagnose the REAL objection (not product, not
 * price, not clarity — it's discomfort with thinking about death) and
 * handle it with warmth and dignity. The closer here is a start-small
 * close: a 1 Cr term plan for ~₹12k a year, which is less than what
 * Vikram spends on his Netflix + Swiggy + Uber stack.
 */
export const TERM_PLAN_PROCRASTINATOR: SeedScenario = {
  slug: "term-plan-procrastinator",
  title: "The Procrastinator — Term Insurance",
  description:
    "Vikram knows he needs term insurance. Every article says so. But every time a colleague asks him, he says 'next month'. It's been 18 months. His second child was born last year. The real objection isn't money — it's something deeper he's not ready to say out loud.",
  category: "objection_handling",
  difficulty: "hard",
  xpReward: 150,
  language: "en",
  tags: ["term-insurance", "emotional-objection", "dependents", "discovery", "labeling"],
  persona: {
    name: "Vikram Shah",
    age: 34,
    profession: "Senior Software Engineer",
    city: "Bangalore",
    archetype: "RATIONAL_PROCRASTINATOR",
    personality:
      "Highly educated, reads financial content, knows all the right answers in theory. Defensive about being called out for procrastinating. Will deflect with technical questions about riders and claim settlement ratios. Actually scared to think about his family after he's gone — won't admit it unless the trainee creates a safe space.",
    goal: "Secure his family's future in case something happens to him — but only once he's emotionally ready to face that possibility.",
    moodInitial: 5,
    hotButtons: [
      "claim settlement ratio",
      "rider",
      "hidden exclusion",
      "surrender value",
      "ULIP",
      "wife's income",
      "too young for this",
    ],
    aiPersonaPrompt: `You are Vikram Shah, a 34-year-old senior software engineer in Bangalore. You earn ₹48 lakh per year. You have a wife (Meera, 32, marketing manager at a startup) and two children — 4 years old and 8 months old. You have a ₹2.4 crore home loan (₹31,000 EMI), and about ₹15 lakh in mutual funds.

You KNOW you need term insurance. Every Reddit thread, every Twitter thread, every finance podcast you listen to tells you so. You saved a calculator link 8 months ago. You even told your wife 3 times that you'd do it "this month". Every time, you find a reason to delay.

The real reason you delay is that the act of applying for term insurance requires you to fill out a form that asks questions like "What is your medical history?" and "Do you have any existing conditions?" and it makes you think — really think — about the possibility that you might not be here to raise your kids. You can't handle that thought. So you deflect.

Behavior rules:
- Start by SOUNDING interested and rational. Ask sharp questions: claim settlement ratio, rider design, exclusions.
- If the trainee gives you the textbook answer, nod and move to the NEXT objection — you're running out the clock.
- If the trainee pushes "so when shall we start the application?", DEFLECT: "Let me think about which insurer... I want to compare HDFC with ICICI first", "Send me the brochure I'll read it weekend", etc.
- The breakthrough comes ONLY if the trainee names what's really happening — LABELING that this is an emotional block, not a product block. Something like "It sounds like the hardest part isn't choosing a product — it's sitting with what the product is for."
- When labeled correctly, you soften dramatically (mood +3) and admit you've been avoiding it.
- Start-small close works: "Let's just start with ₹1 Cr cover at ₹12k a year — that's less than your weekly Swiggy spend. You can always increase it later."
- Keep responses 1-3 sentences. Indian English, slightly formal, occasional tech-worker self-deprecation.`,
  },
  openingStatement:
    "So, my friend has been telling me about term plans for over a year. I know I should probably do it. I just want to make sure I'm getting the right one. What's the claim settlement ratio of the one you'd recommend? And are there any exclusions I should worry about?",
  steps: [
    // Round 1 — The rational front
    {
      speaker: "customer",
      text: "So, my friend has been telling me about term plans for over a year. I know I should probably do it. I just want to make sure I'm getting the right one. What's the claim settlement ratio of the one you'd recommend? And are there any exclusions I should worry about?",
    },
    {
      speaker: "system",
      text: "Round 1 OBJECTIVE: Answer his product question honestly but DON'T get pulled into a rabbit hole of technical specs. Surface-level answer + redirect to discovery about his family and what the cover is actually protecting.",
      expectedAction:
        "Briefly answer the CSR question honestly, then redirect to discovery about his family situation",
      hints: [
        "Give a short honest answer on CSR (98%+ for top insurers)",
        "Don't linger on specs — this is a deflection",
        "Pivot to discovery: family, dependents, current commitments",
        "Ask about the home loan, the kids, his wife's income",
      ],
      idealKeywords: [
        "98",
        "CSR",
        "tell me about your family",
        "how old are your kids",
        "dependents",
        "home loan",
        "what you're protecting",
      ],
      bannedPhrases: ["guaranteed", "trust me", "don't worry about that"],
      scoring: { Discovery: 15, "Product Knowledge": 10 },
    },

    // Round 2 — The rider deflection
    {
      speaker: "customer",
      text: "Okay, yes — two kids, ₹2.4 crore home loan, wife has her own job but with equity not salary so uncertain. Tell me, what about riders? Accidental death, critical illness, waiver of premium — which ones actually matter? I've read mixed things.",
    },
    {
      speaker: "system",
      text: "Round 2 OBJECTIVE: He's in an information-gathering loop to avoid acting. Answer the rider question concisely but end with a calibrated question that makes him confront the purpose, not the specs.",
      expectedAction:
        "Recommend CI rider (he has young kids) and waiver of premium. Skip accidental death (unnecessary padding). Then ask a calibrated question about what he actually wants to protect.",
      hints: [
        "CI rider YES — with young kids, a major illness would be catastrophic financially",
        "Waiver of premium YES — locks the cover in place if disability",
        "Skip accidental death — it's not the main risk and adds cost",
        "Calibrated question: 'If you had to name the one thing you'd want your family to have if something happened tomorrow, what would it be?'",
      ],
      idealKeywords: [
        "critical illness",
        "waiver of premium",
        "young children",
        "what would you want",
        "protect",
        "if something happened",
      ],
      bannedPhrases: ["you must", "you have to", "all of them"],
      scoring: { "Product Knowledge": 10, "Discovery": 15, "Communication Clarity": 10 },
    },

    // Round 3 — The compare-shop deflection
    {
      speaker: "customer",
      text: "Hmm. Good advice. Let me think. I want to compare HDFC Click2Protect with ICICI iProtect Smart first — I've heard the claim process is different. Can you send me a comparison and I'll review this weekend?",
    },
    {
      speaker: "system",
      text: "Round 3 OBJECTIVE: He's about to ghost you. This is the moment of TRUTH — do you go along with the delay or do you gently name what's happening? Label the real objection with dignity. Don't accuse him. Just create space.",
      expectedAction:
        "Don't defend a specific insurer. Gently name the 18-month pattern: 'It sounds like the hardest part isn't choosing a product — it's sitting with what the product is for.'",
      hints: [
        "This is THE moment. Label the emotion, don't push a product",
        "Use dignified language — don't accuse him of procrastinating",
        "Try: 'I've been in this job long enough to recognize when the problem isn't the product'",
        "Or: 'If it's okay to say — it sounds like the hardest part isn't choosing the plan, it's thinking about what the plan is for.'",
        "Let him sit with the silence if needed",
      ],
      idealKeywords: [
        "hardest part",
        "what the product is for",
        "thinking about",
        "family",
        "if something happened",
        "you're protecting",
        "sit with",
      ],
      bannedPhrases: [
        "stop procrastinating",
        "you're making excuses",
        "just buy it",
        "time is running out",
      ],
      scoring: { Empathy: 30, "Objection Handling": 20 },
    },

    // Round 4 — The breakthrough
    {
      speaker: "customer",
      text: "...Okay. That's... yeah. That's fair. I'll admit — I've been putting this off for months. Every time I open the application form, the medical history section just... I don't want to think about it. How do people do this without freaking out?",
    },
    {
      speaker: "system",
      text: "Round 4 OBJECTIVE: He just opened up. Validate. Don't jump to closing. Normalize the feeling, frame the action as an act of love not fear, and offer a small first step.",
      expectedAction:
        "Normalize the feeling. Frame term insurance as 'the thing you do once, so you never have to think about it again.' Offer to walk him through the form together or schedule a short call for application.",
      hints: [
        "Normalize: 'Everyone feels this. Some people just never say it out loud'",
        "Reframe: 'Term insurance isn't about death. It's the one thing you do once so you never have to think about it again.'",
        "Offer a walk-through — 'I can sit with you for 20 minutes while you fill the form'",
        "Offer small: 'Let's just get the cover in place. You can always upgrade later.'",
      ],
      idealKeywords: [
        "everyone feels",
        "once and done",
        "walk you through",
        "sit with you",
        "20 minutes",
        "small first step",
        "upgrade later",
      ],
      bannedPhrases: ["nothing to be afraid of", "man up", "just do it"],
      scoring: { Empathy: 25, Closing: 15 },
    },

    // Round 5 — The start-small close
    {
      speaker: "customer",
      text: "Alright. I think I can do this. One more thing — my friend said ₹2 crore cover is the minimum for someone in my position. Is that right? It feels like a lot of money to commit to monthly.",
    },
    {
      speaker: "system",
      text: "Round 5 OBJECTIVE: Right-size the commitment. Use the start-small close. Give him a tangible comparison that makes the cost feel proportional.",
      expectedAction:
        "Right-size: 10x annual income is typical, so ₹4-5 Cr is technically correct for him, but start with ₹1 Cr at ~₹12k/year. Compare to his Swiggy or Netflix spend. Get him to commit to the first step.",
      hints: [
        "10x annual income is a good benchmark — he'd ideally want ₹4-5 Cr",
        "But start with ₹1 Cr at ~₹12k/year — less pressure, same psychological win",
        "Compare to daily coffee or weekly Swiggy — make it feel small",
        "Tell him he can always top up later (many insurers allow increases without re-underwriting at life events)",
      ],
      idealKeywords: [
        "₹1 Cr",
        "₹12k",
        "less than",
        "Swiggy",
        "coffee",
        "start small",
        "top up later",
        "life events",
      ],
      bannedPhrases: ["you must buy the full amount", "₹2 Cr minimum"],
      scoring: { Closing: 20, "Communication Clarity": 10 },
    },
  ],
  evaluationRules: [
    { skill: "Empathy", weight: 30, keywords: ["sounds like", "I hear you", "everyone feels"] },
    {
      skill: "Discovery",
      weight: 15,
      keywords: ["family", "dependents", "home loan", "kids", "wife"],
    },
    {
      skill: "Product Knowledge",
      weight: 10,
      keywords: ["CSR", "rider", "waiver", "critical illness", "10x"],
    },
    {
      skill: "Objection Handling",
      weight: 20,
      keywords: ["hardest part", "sit with", "small first step"],
    },
    {
      skill: "Compliance",
      weight: 10,
      keywords: ["free-look", "IRDAI", "disclosure"],
    },
    { skill: "Closing", weight: 15 },
  ],
  complianceRules: {
    hardBanned: [
      "guaranteed payout",
      "no questions asked",
      "automatic approval",
      "no medical check",
      "hide the medical history",
    ],
    violationPenalty: 20,
    violationMessage:
      "IRDAI violation: any suggestion of bypassing the medical history disclosure is a fatal mis-sale — it voids the policy at claim time and the insurer WILL reject the claim.",
  },
};
