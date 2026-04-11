/**
 * NEXUS product knowledge — the full BFSI catalog the LLM reasons about
 * during role-play and evaluation.
 *
 * Every product family has a SUITABILITY MAP — the one-liner that lets
 * Claude pick the right category for a customer archetype. These maps are
 * what separates an evaluator that catches mis-selling from one that
 * rubber-stamps a confident-sounding answer.
 */

export const NEXUS_PRODUCT_KNOWLEDGE = `COMPLETE BFSI PRODUCT KNOWLEDGE:

════════════════════════════════════════════════════════════
MUTUAL FUNDS
════════════════════════════════════════════════════════════

Equity:
  - Large Cap: top 100, stable, 10-12% long-run return expectation
  - Mid Cap: 101-250, moderate risk, higher volatility
  - Small Cap: 251+, high risk and high potential
  - Flexi Cap: no market-cap restriction
  - ELSS: tax saving under 80C, 3-year lock-in

Debt:
  - Liquid: overnight-91 day, safest
  - Ultra-Short: 3-6 month
  - Short-Term: 1-3 year
  - Corporate Bond: higher yield, credit risk
  - Gilt: govt securities, no credit risk but duration risk
  - Dynamic Bond: active duration management

Hybrid:
  - Conservative Hybrid: 10-25% equity
  - Balanced Hybrid: 40-60% equity
  - Aggressive Hybrid: 65-80% equity
  - Balanced Advantage Fund (BAF): dynamically adjusts equity/debt based on valuations — GO-TO for "better than FD but low risk" customers

Passive:
  - Index Funds: track Nifty/Sensex, low cost
  - ETFs: exchange-traded
  - FoF: international exposure or fund-of-fund structures

SUITABILITY MAP:
  <3 months → Liquid Fund
  Conservative 1-3 yr → Short Duration Debt
  Risk-averse 3+ yr → BAF or Conservative Hybrid
  Moderate 5+ yr → Flexi Cap / Large Cap
  Tax saving → ELSS
  High risk 7+ yr → Mid/Small Cap
  Low cost seeker → Index Fund

SIP: Fixed monthly amount, rupee cost averaging. Minimum ₹500/month.

════════════════════════════════════════════════════════════
INSURANCE
════════════════════════════════════════════════════════════

Term:
  - Pure risk cover, no maturity benefit.
  - Extremely affordable (₹1 Cr cover for ~₹8-15k/year for a 30 year old healthy male).
  - Best for anyone with dependents.
  - Training point: "Term insurance is not about returning money. It's about your family not losing their life."

ULIP:
  - Life cover + market-linked investment.
  - High early charges, 5-year lock-in.
  - Returns NOT guaranteed — NEVER compare to FD.
  - Suitable for 10+ year investors who understand market risk.

Endowment / Money-Back:
  - Savings + protection.
  - Guaranteed maturity.
  - Low IRR (4-6%).
  - NOT recommended as a primary investment. Training point: if a customer wants investment returns, send them to a mutual fund; if they want protection, send them to term.

Health:
  - Individual, Family Floater, Critical Illness Rider, Super Top-Up.
  - Corporate cover ends with the job — everyone needs personal cover.
  - Pre-existing disease waiting period: 36 months typical.
  - Room rent cap is the #1 claim-time heartbreak; always discuss it.

General:
  - Motor: third-party mandatory, comprehensive recommended.
  - Home / Property
  - Travel
  - Cyber Insurance (new category)

════════════════════════════════════════════════════════════
LOANS & CREDIT
════════════════════════════════════════════════════════════

Home Loan:
  - LTV max 80% (up to 90% for affordable segment).
  - Tenure up to 30 years.
  - Floating (RLLR/MCLR) or fixed.
  - No prepayment penalty on floating rate (RBI mandate).

Personal Loan:
  - Unsecured.
  - 11-24% typical.
  - 1-5 year tenure.

LAP (Loan Against Property):
  - Secured against property.
  - Lower rate (8-12%).
  - Higher amount possible.

Credit Card:
  - Revolving credit.
  - 18-55 day interest-free period if full payment.
  - Revolving interest 24-42% annualized.
  - Training point: "A credit card for someone who pays in full = rewards + protection. For someone who pays minimum = debt trap."

CIBIL:
  - 300-900 range, 750+ excellent.
  - Factors: payment history 35%, utilization 30%, length 15%, mix 10%, inquiries 10%.

════════════════════════════════════════════════════════════
DEPOSITS
════════════════════════════════════════════════════════════

Fixed Deposit:
  - Guaranteed return.
  - DICGC insured up to ₹5 lakh.
  - Premature withdrawal penalty 0.5-1%.
  - Interest fully taxable as "Income from Other Sources".
  - Senior Citizen rate: +0.25 to +0.50%.

Recurring Deposit:
  - Monthly deposit habit-builder.
  - Similar rates to FD of equivalent tenure.

PPF:
  - 15-year lock-in.
  - Tax-free interest (~7.1% currently).
  - EEE status (exempt on contribution, accumulation, and withdrawal).
  - Annual limit ₹1.5 lakh.

NPS: see PFRDA section in regulatory knowledge.

════════════════════════════════════════════════════════════
CROSS-CUTTING TRAINING POINTS
════════════════════════════════════════════════════════════

Income-to-product mapping (rough):
  - <₹5L income: focus on emergency fund (liquid MF) + term insurance + basic health.
  - ₹5-15L income: add SIP in flexi/large cap, NPS tier 1, home loan readiness.
  - ₹15-50L income: portfolio planning, ULIP if 10+ year horizon, tax-saving stack.
  - ₹50L+ income: wealth preservation, private banking, alternative investments.

The "3-bucket" framework for risk-averse customers:
  Bucket 1 (0-3 months): Liquid fund or savings account.
  Bucket 2 (3-5 years): BAF or conservative hybrid.
  Bucket 3 (5+ years): Large cap / flexi cap / index fund.

This framework is your safe fallback when a customer wants "better than FD but not too risky" — it maps cleanly to real products and passes any suitability test.`;
