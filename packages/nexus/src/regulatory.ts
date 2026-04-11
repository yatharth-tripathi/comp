/**
 * NEXUS regulatory knowledge base — SEBI / IRDAI / RBI / AMFI / PFRDA.
 *
 * This is the single most important block in the NEXUS prompt. It is what
 * lets Claude catch mis-selling as it happens, write disclaimers correctly,
 * and score a trainee against real rules — not an LLM's hallucinated memory
 * of Indian finance.
 *
 * Every phrase in the "ABSOLUTE BANNED PHRASES" and "BANNED BEHAVIORS"
 * sections is a real rule from a real regulator. Anything added here goes
 * through compliance review before merge.
 */

export const NEXUS_REGULATORY_KNOWLEDGE = `COMPLETE REGULATORY KNOWLEDGE BASE — INDIAN BFSI:

════════════════════════════════════════════════════════════
SEBI (Securities and Exchange Board of India)
════════════════════════════════════════════════════════════

Primary law: SEBI Act 1992, SEBI (Mutual Funds) Regulations 1996 (amended Aug 2024), SEBI (Investment Advisers) Regulations 2013.

Risk-O-Meter: Every MF scheme has a mandatory risk label on 6 levels:
  Low | Low to Moderate | Moderate | Moderately High | High | Very High.
RMs MUST communicate this BEFORE recommending. Not communicating = violation.

Suitability Requirement (non-negotiable): Before recommending any market-linked product the RM must:
  1) Establish investment objective,
  2) Establish investment horizon,
  3) Establish risk tolerance (explicit, not assumed),
  4) Confirm income and liquidity needs.
Recommending without suitability assessment = mis-selling.

2024-25 Updates:
  • Mandatory risk-adjusted returns disclosure.
  • MF Lite framework for passive funds.
  • Total MF AUM crossed ₹66.7 lakh crore (Aug 2024).
  • Monthly SIP inflows: ₹23,547 crore record high.
  • 20.45 crore+ folios.

ABSOLUTE BANNED PHRASES (never allowed on ANY market-linked product):
  - "guaranteed returns"
  - "your money is 100% safe in this fund"
  - "this fund cannot go down"
  - "assured maturity amount" (on market-linked)
  - "definitely will grow to X amount"
  - "no risk in this investment"
  - "better than bank FD, guaranteed"
  - "I'll personally ensure your returns"
  - "this is like an FD with higher returns"

REQUIRED DISCLOSURES (must appear in every MF pitch):
  - "Mutual fund investments are subject to market risks."
  - "Please read all scheme-related documents carefully."
  - "Past performance is not indicative of future returns."
  - "Returns are not guaranteed and may vary with market conditions."
  - Mention the risk-o-meter label.
  - Explain the appropriate investment horizon.

════════════════════════════════════════════════════════════
IRDAI (Insurance Regulatory and Development Authority of India)
════════════════════════════════════════════════════════════

Primary laws: Insurance Act 1938, IRDA Act 1999, IRDAI (EOM including Commission) Regulations 2024.

Bancassurance reality:
  - Corporate agents (including banks) account for 53% of private life insurers' individual new business premium (FY24-25).
  - Banks alone = 49%+.
  - FY24-25 "Unfair business practices" complaints rose 14% YoY to 26,667 cases (22.14% of total complaints).

2024 Changes:
  - Commission flexibility (insurers set own structures within EOM limits).
  - Strengthened suitability norms — products must match needs AND financial capacity.
  - Mandatory free-look period disclosure (15-30 days).
  - Customer Information Sheet (CIS) required BEFORE sale.
  - Fairer surrender value rules.

BANNED BEHAVIORS (IRDAI-defined mis-selling):
  - Selling insurance as an investment substitute ("This ULIP gives better returns than FD")
  - Not disclosing the free-look period
  - Not disclosing that ULIP returns are market-linked
  - Overstating/guaranteeing ULIP maturity values
  - No need analysis before recommending
  - Forcing insurance bundled with a loan
  - Not disclosing surrender charges
  - Hiding commission structure when explicitly asked

COMPLIANT INSURANCE SALE:
  1) Identify genuine need.
  2) Assess financial capacity.
  3) Recommend suitable product CATEGORY first, specific SKU second.
  4) Disclose key features including exclusions and charges.
  5) Disclose free-look period.
  6) Confirm understanding before closing.

════════════════════════════════════════════════════════════
RBI (Reserve Bank of India)
════════════════════════════════════════════════════════════

Governs: All banking products, KYC, AML, FEMA (NRI transactions), CTR/STR reporting, digital lending, customer grievance.

KYC Framework:
  - CDD (Customer Due Diligence)
  - EDD (Enhanced Due Diligence for high-risk or PEPs)
  - Acceptable documents: Aadhaar, PAN, Passport, Voter ID
  - Video KYC accepted since 2020
  - Re-KYC required periodically

AML Red Flags:
  - Structuring (transactions just below CTR threshold)
  - Unusual cash transactions
  - Beneficial ownership concealment
  - Sanctioned jurisdiction transactions
  - Round-tripping
  - Unexplained source of funds
  - Reluctance to provide ID

Thresholds:
  - CTR: transactions above ₹10 lakh cash = mandatory CTR.
  - SAR/STR: filed when suspicious regardless of amount.

Digital Lending (2024-25):
  - APR must be displayed clearly
  - No automatic credit limit increase without consent
  - Penal charges disclosed upfront in KFS
  - Key Fact Statement (KFS) mandatory before disbursal

Loan Suitability:
  - EMI should not exceed 40-50% of net monthly income (FOIR).
  - Irresponsible lending = regulatory violation.
  - Foreclosure charges on floating-rate home loans = PROHIBITED for individual borrowers.

FEMA / NRI:
  - NRE: fully repatriable, tax-free interest.
  - NRO: non-repatriable beyond USD 1M/year, TDS applicable.
  - FCNR: foreign currency FD, repatriable.

════════════════════════════════════════════════════════════
AMFI (Association of Mutual Funds in India)
════════════════════════════════════════════════════════════

  - Distributors must be AMFI-registered (ARN holder).
  - NISM Series V-A exam required.
  - Cannot churn portfolio for commission.
  - Must provide unbiased recommendations.
  - Must disclose upfront and trail commissions on request.
  - Must follow "suitability first" framework.

Direct vs Regular Plans:
  - DIRECT plan: lower expense ratio, no commission.
  - REGULAR plan: higher expense, includes trail commission to distributor.
  - RM MUST inform investors about the direct plan option (SEBI mandate).

════════════════════════════════════════════════════════════
PFRDA (Pension Fund Regulatory and Development Authority)
════════════════════════════════════════════════════════════

NPS:
  - 165+ lakh registered Indians (April 2025).
  - Tier 1: retirement, tax benefit, locked till 60.
  - Tier 2: flexible withdrawal, no tax benefit on contribution.

Tax benefits:
  - Section 80C: ₹1.5 lakh.
  - Section 80CCD(1B): additional ₹50k.

Lock-in:
  - Till age 60.
  - Partial withdrawal allowed after 3 years for specified purposes.

APY: Guaranteed pension for unorganized sector workers.`;
