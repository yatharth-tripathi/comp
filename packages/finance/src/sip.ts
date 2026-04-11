/**
 * SIP (Systematic Investment Plan) — future value math.
 *
 * Uses the standard closed-form FV of an annuity with monthly compounding:
 *
 *   FV = P × [ ((1+r)^n − 1) / r ] × (1+r)
 *
 *   P = monthly SIP amount
 *   r = monthly rate = annual_rate / 12
 *   n = total months = years × 12
 *
 * The (1+r) multiplier at the end is because we assume beginning-of-month
 * contributions (standard in Indian mutual fund SIP modelling).
 *
 * This is EXACT math. No approximation. Every number comes from the
 * formula above.
 */

import { round } from "./money.js";

export interface SipInput {
  customerName: string;
  monthlyAmount: number;
  durationYears: number;
  expectedReturnPct: number; // percent as a number, e.g. 12 for 12%
  goalLabel?: string;
}

export interface SipOutput {
  monthlyAmount: number;
  durationYears: number;
  totalInvested: number;
  maturityValue: number;
  wealthGained: number;
  wealthMultiplier: number;
  assumedAnnualReturnPct: number;

  // Year-by-year projection for the area chart
  projection: Array<{
    year: number;
    invested: number;
    corpus: number;
    gains: number;
  }>;

  // Side-by-side scenarios at 4% / 8% / 12% per SEBI "illustrate at multiple rates" guideline
  scenarios: Array<{
    label: string;
    annualRatePct: number;
    maturityValue: number;
    wealthGained: number;
  }>;

  // Inflation-adjusted view at 6% inflation — the number SEBI now mandates
  realPurchasingPower: number;

  assumptions: string[];
}

function sipFutureValue(monthly: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

export function computeSip(input: SipInput): SipOutput {
  const { monthlyAmount, durationYears, expectedReturnPct } = input;

  const totalInvested = monthlyAmount * durationYears * 12;
  const maturityValue = round(sipFutureValue(monthlyAmount, expectedReturnPct, durationYears));
  const wealthGained = maturityValue - totalInvested;
  const wealthMultiplier = totalInvested > 0 ? maturityValue / totalInvested : 0;

  // Year-by-year corpus
  const projection: SipOutput["projection"] = [];
  for (let y = 1; y <= durationYears; y += 1) {
    const corpus = round(sipFutureValue(monthlyAmount, expectedReturnPct, y));
    const invested = monthlyAmount * y * 12;
    projection.push({
      year: y,
      invested,
      corpus,
      gains: corpus - invested,
    });
  }

  // SEBI-mandated multi-rate illustration (4%, 8%, 12%)
  const scenarios = [4, 8, 12].map((rate) => {
    const mat = round(sipFutureValue(monthlyAmount, rate, durationYears));
    return {
      label: `At ${rate}% annual return`,
      annualRatePct: rate,
      maturityValue: mat,
      wealthGained: mat - totalInvested,
    };
  });

  // Real purchasing power — deflate maturity by 6% inflation over the period
  const inflationFactor = Math.pow(1.06, durationYears);
  const realPurchasingPower = round(maturityValue / inflationFactor);

  return {
    monthlyAmount,
    durationYears,
    totalInvested,
    maturityValue,
    wealthGained,
    wealthMultiplier,
    assumedAnnualReturnPct: expectedReturnPct,
    projection,
    scenarios,
    realPurchasingPower,
    assumptions: [
      "Returns are indicative and NOT guaranteed. Past performance of mutual funds is not a reliable indicator of future performance.",
      "Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully.",
      "Calculations assume beginning-of-month SIP contributions with monthly compounding.",
      "Inflation assumption: 6% per annum (RBI long-term target).",
      "Actual maturity value depends on market performance and scheme selection.",
      `This is NOT a recommendation for any specific mutual fund scheme. AMFI registration number of your distributor is always required.`,
    ],
  };
}
