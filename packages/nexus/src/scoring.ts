/**
 * NEXUS scoring philosophy — the rubric the evaluator uses when scoring
 * a role-play session.
 *
 * Core principle: scores are HONEST. A 60% is a 60%. Inflated scores
 * destroy the trainee's learning curve and the platform's credibility.
 *
 * One violation rule that overrides everything: a mis-sold scenario is a
 * FAIL regardless of tone. A perfectly warm, empathetic, well-structured
 * conversation that sells a guaranteed-returns mutual fund is STILL a FAIL.
 */

export const NEXUS_SCORING_PHILOSOPHY = `SCORING PHILOSOPHY AND RUBRIC:

════════════════════════════════════════════════════════════
CORE PRINCIPLES
════════════════════════════════════════════════════════════

1. HONEST SCORING. 60% is 60%. Never inflate.
2. COMPLIANCE OVERRIDE. A mis-sold conversation FAILS regardless of every other score.
3. EVIDENCE-BASED. Every score must be justified by a specific quote from the trainee's actual words.
4. TECHNIQUE NAMING. Every positive moment names the conversation technique used (mirroring / labeling / ARE / etc.).
5. SPECIFIC COACHING. Every improvement points to what the trainee should have said instead, as an actual phrase.

════════════════════════════════════════════════════════════
SKILL DIMENSIONS (per-scenario weights provided in scenario config)
════════════════════════════════════════════════════════════

Empathy:
  - Did the trainee LISTEN before selling?
  - Did they acknowledge the customer's emotional state with labeling?
  - Did they avoid jumping to solutions?
  - Signal: customer mood rises across the conversation.

Discovery:
  - Did the trainee climb the discovery ladder (situation → objective → timeline → risk → constraints)?
  - Did they ask OPEN-ended questions, not yes/no?
  - Did they discover the customer's real concern before recommending?

Product Knowledge:
  - Did the trainee accurately describe the product category?
  - Did they avoid mixing up categories (ULIP vs term, FD vs debt fund)?
  - Did they reference the SEBI risk-o-meter or IRDAI free-look period when relevant?

Objection Handling:
  - Did they use ARE (acknowledge-reframe-evidence)?
  - Did they defend against the "guaranteed returns" trap?
  - Did they respect "let me ask my spouse" instead of trying to close around it?

Compliance:
  - Did they avoid every banned phrase on the scenario's hard-banned list?
  - Did they include required disclosures?
  - Did they name the regulator when citing a rule?
  - ONE violation = automatic C grade minimum.
  - TWO violations = automatic F.

Communication Clarity:
  - Was the language natural Indian English?
  - Did they avoid jargon when the customer isn't financially literate?
  - Were they concise or did they ramble?

════════════════════════════════════════════════════════════
OUTPUT CONTRACT (the evaluator returns JSON matching this shape)
════════════════════════════════════════════════════════════

{
  "skills": [
    {
      "skill": "Empathy",
      "score": N,             // integer 0..maxScore
      "maxScore": N,
      "feedback": "One specific sentence referencing what they actually said or didn't say",
      "evidence": "An exact quote from the trainee (or 'No empathetic acknowledgment anywhere in the conversation')"
    }
  ],
  "totalScore": N,
  "maxScore": N,
  "percentage": N,
  "grade": "S" | "A" | "B" | "C" | "D" | "F",
  "overallFeedback": "2-3 sentences, specific moments, no generic praise",
  "strengths": [
    {
      "technique": "Named technique (labeling / mirroring / ARE / etc)",
      "quote": "Exact quote from the trainee",
      "whyItWorked": "One sentence"
    }
  ],
  "improvements": [
    {
      "moment": "What was happening when this went wrong",
      "whatTheySaid": "Exact quote",
      "whatIdealRmWouldSay": "The actual alternative phrase",
      "technique": "Named technique they should have used"
    }
  ],
  "bestMoment": {
    "quote": "The single best thing the trainee said",
    "whyItWorked": "Why, with a named technique"
  },
  "worstMoment": {
    "quote": "The single worst moment (a compliance violation if any)",
    "whatShouldHaveBeenSaid": "The corrected version"
  },
  "ghostResponses": [
    {
      "round": N,
      "actualResponse": "What trainee said in round N",
      "idealResponse": "What an ideal RM would have said in round N",
      "techniqueUsedByIdeal": "Named technique"
    }
  ],
  "complianceViolations": [
    {
      "regulator": "SEBI" | "IRDAI" | "RBI" | "AMFI" | "PFRDA",
      "rule": "The specific rule that was violated",
      "quote": "Exact trainee quote that triggered the violation",
      "severity": "WARNING" | "MAJOR" | "FATAL"
    }
  ],
  "moodAnalysis": "One sentence: how did the RM's approach affect customer trust over the conversation?",
  "nextRecommendation": {
    "weakestSkill": "The skill dimension with the lowest score",
    "suggestedScenarioCategory": "sales | compliance | objection-handling | discovery | closing",
    "rationale": "One sentence"
  },
  "xpAwarded": N
}

════════════════════════════════════════════════════════════
GRADE MAPPING
════════════════════════════════════════════════════════════
  S: 95-100  — Masterclass. Trainee can demo this to peers.
  A: 85-94   — Strong. Ready for real customers.
  B: 70-84   — Competent. Needs targeted polish.
  C: 55-69   — Learning. Not ready for senior RM work.
  D: 40-54   — Significant gaps. Needs coaching + more practice.
  F: 0-39    — Failed. Mis-sold OR multiple compliance violations OR fundamentally broke rapport.

XP mapping:
  90-100% → 100 XP
  70-89%  → 70 XP
  50-69%  → 40 XP
  <50%    → 20 XP`;
