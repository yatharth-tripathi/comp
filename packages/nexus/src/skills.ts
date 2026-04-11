/**
 * NEXUS conversation skills — the lexicon of named techniques the
 * evaluator references when scoring a trainee's conversation.
 *
 * When the trainee says "I understand that's a big concern for you" — the
 * evaluator recognizes it as LABELING and awards empathy points. When the
 * trainee parrots back the customer's last phrase — it's MIRRORING. Named
 * techniques are what turn a generic "you handled it well" into actionable
 * coaching.
 */

export const NEXUS_CONVERSATION_SKILLS = `CONVERSATION SKILLS LADDER:

════════════════════════════════════════════════════════════
DISCOVERY TECHNIQUES (phase 1: before any recommendation)
════════════════════════════════════════════════════════════

Open-ended questions:
  "Tell me about…" / "Walk me through…" / "What does your current… look like?"
  NEVER ask yes/no questions during discovery. You get nothing back.

The Discovery Ladder (ask in order):
  1. Situation: What is their current financial reality?
  2. Objective: What do they actually want to achieve?
  3. Timeline: When do they need to achieve it?
  4. Risk tolerance: How would they feel if it lost 20% in a year?
  5. Constraints: What's non-negotiable? (Liquidity, existing commitments, spouse approval)

Mirroring:
  Repeat the last 1-3 words of what the customer said, as a question.
  Customer: "I'm worried about losing my principal."
  RM: "Losing your principal?"
  Effect: customer elaborates without pressure.

Labeling:
  Name the emotion you're hearing.
  "It sounds like you've had a painful experience with markets before."
  "It seems like safety matters a lot to you."
  Effect: customer feels heard, resistance drops.

Calibrated questions:
  "What about this feels right to you?"
  "How would you know if this investment was working?"
  Effect: customer talks themselves into clarity.

════════════════════════════════════════════════════════════
OBJECTION HANDLING
════════════════════════════════════════════════════════════

The Acknowledge-Reframe-Evidence (ARE) pattern:
  1. Acknowledge the objection in your own words (proves you heard it).
  2. Reframe the concern as a shared goal.
  3. Evidence — bring data, never opinion.

Example — "Mutual funds lost my friend money":
  Acknowledge: "That's painful to watch, and I completely understand why you'd be cautious."
  Reframe: "What I'm hearing is that you want growth WITHOUT the risk of principal loss — is that right?"
  Evidence: "That's exactly what a Balanced Advantage Fund is built for. Let me show you how it dynamically reduces equity when valuations spike, so you're protected in a downturn."

The "expensive" objection:
  NEVER defend price. Reframe to value and opportunity cost.
  "₹10,000 a month feels like a lot. What does it feel like if you compare it to the ₹30 lakh you'd need at 60 without this?"

The "I need to ask my spouse" objection:
  NEVER try to bypass it. Respect it.
  "Of course. This is a decision you should make together. May I send a 1-page summary you can show them tonight?"
  Effect: you stay in the deal instead of being ghosted.

The "guaranteed returns" trap:
  Customer asks: "What return will I definitely get?"
  Wrong answer: "Around 12%" (mis-selling).
  Right answer: "Mutual funds can't give guaranteed returns — that's by law. But let me show you three scenarios — 4%, 8%, 12% — so you can see the range we're planning for."

════════════════════════════════════════════════════════════
COMPLIANCE-SAFE LANGUAGE
════════════════════════════════════════════════════════════

Safe phrasings for common situations:

Instead of "guaranteed returns":
  "Historically, similar funds have delivered X-Y% over rolling 5-year periods, but returns are not guaranteed and depend on market conditions."

Instead of "no risk":
  "This category is considered Low-to-Moderate risk on the SEBI risk-o-meter. Let me explain what that means."

Instead of "better than FD":
  "FD gives you certainty. This gives you a different risk-return profile — let me explain how they differ."

Instead of "trust me":
  "Don't take my word for it — here's the KIM document and you can verify everything I'm saying."

Instead of "I'll definitely make sure":
  "Here's what I can commit to, and here's what depends on market conditions."

════════════════════════════════════════════════════════════
CLOSING TECHNIQUES
════════════════════════════════════════════════════════════

Assumptive close (use only after real need alignment):
  "So — shall we start the KYC process today, or would you prefer to come back tomorrow with your spouse?"

Calendar close:
  "I can block 3pm on Saturday for the application. Does that work?"

Start-small close (for hesitant customers):
  "Let's start with ₹5,000 a month. If it feels right in 6 months, we can increase it. If not, you can stop anytime. Fair?"

Education-first close:
  "Let me send you the 2-page summary. Read it over the weekend, and if it makes sense, we'll do the application Monday."

NEVER use:
  - Pressure close ("This offer ends today")
  - Fear close ("If you don't buy this, your family will suffer")
  - Fake scarcity ("Only 5 slots left this quarter")
  These all trigger IRDAI/SEBI complaints.`;
