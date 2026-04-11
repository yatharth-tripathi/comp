/**
 * Home Loan — EMI and amortization math.
 *
 * EMI formula:
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 *
 *   P = principal (loan amount)
 *   r = monthly interest rate = annual_rate / 12 / 100
 *   n = loan tenure in months
 *
 * This is exact. We then build a month-by-month amortization schedule and
 * aggregate it to year-level buckets for the chart.
 */

import { round } from "./money.js";

export interface HomeLoanInput {
  customerName: string;
  propertyValue: number;
  loanAmount: number;
  tenureYears: number;
  interestRatePct: number; // e.g. 8.5 for 8.5%
  processingFeePct: number; // e.g. 0.5 for 0.5%
}

export interface AmortizationBucket {
  year: number;
  openingBalance: number;
  principalPaid: number;
  interestPaid: number;
  closingBalance: number;
}

export interface HomeLoanOutput {
  loanAmount: number;
  tenureYears: number;
  interestRatePct: number;
  emi: number;
  totalPayment: number;
  totalInterest: number;
  interestToPrincipalRatio: number;
  processingFee: number;
  ltv: number; // loan-to-value %

  // Year-level amortization
  amortization: AmortizationBucket[];

  // What if the rate goes up/down — this is the most asked question in a home loan meeting
  rateSensitivity: Array<{
    label: string;
    ratePct: number;
    emi: number;
    totalInterest: number;
  }>;

  // What if they prepay a lump sum at year 5
  prepaymentBenefit: {
    lumpSumAtYear: number;
    lumpSumAmount: number;
    tenureReductionMonths: number;
    interestSaved: number;
  };

  assumptions: string[];
}

function emiMonthly(principal: number, annualRatePct: number, tenureYears: number): number {
  const r = annualRatePct / 100 / 12;
  const n = tenureYears * 12;
  if (r === 0) return principal / n;
  const pow = Math.pow(1 + r, n);
  return (principal * r * pow) / (pow - 1);
}

/**
 * Build a year-aggregated amortization table by iterating month-by-month.
 * O(tenureYears × 12) — negligible (≤ 360 iterations for a 30-year loan).
 */
function buildAmortization(
  principal: number,
  annualRatePct: number,
  tenureYears: number,
): AmortizationBucket[] {
  const r = annualRatePct / 100 / 12;
  const months = tenureYears * 12;
  const emi = emiMonthly(principal, annualRatePct, tenureYears);
  const buckets: AmortizationBucket[] = [];

  let balance = principal;
  for (let year = 1; year <= tenureYears; year += 1) {
    const opening = balance;
    let principalThisYear = 0;
    let interestThisYear = 0;

    for (let m = 0; m < 12; m += 1) {
      if (year === tenureYears && m === 11) {
        // Last month — pay off any residual to ensure clean zero balance
        const interest = balance * r;
        const principalPart = balance;
        interestThisYear += interest;
        principalThisYear += principalPart;
        balance = 0;
      } else {
        const interest = balance * r;
        const principalPart = emi - interest;
        interestThisYear += interest;
        principalThisYear += principalPart;
        balance = Math.max(0, balance - principalPart);
      }
    }

    buckets.push({
      year,
      openingBalance: round(opening),
      principalPaid: round(principalThisYear),
      interestPaid: round(interestThisYear),
      closingBalance: round(balance),
    });
    if (balance <= 0) break;
  }
  return buckets;
}

export function computeHomeLoan(input: HomeLoanInput): HomeLoanOutput {
  const emi = emiMonthly(input.loanAmount, input.interestRatePct, input.tenureYears);
  const totalPayment = emi * input.tenureYears * 12;
  const totalInterest = totalPayment - input.loanAmount;
  const processingFee = round(input.loanAmount * (input.processingFeePct / 100));

  const amortization = buildAmortization(
    input.loanAmount,
    input.interestRatePct,
    input.tenureYears,
  );

  // Rate sensitivity — common ask in meetings
  const rateSensitivity = [-1, -0.5, 0, 0.5, 1, 2].map((delta) => {
    const rate = Math.max(0.5, input.interestRatePct + delta);
    const altEmi = emiMonthly(input.loanAmount, rate, input.tenureYears);
    const altTotal = altEmi * input.tenureYears * 12;
    return {
      label: delta === 0 ? "Current rate" : delta > 0 ? `+${delta}%` : `${delta}%`,
      ratePct: rate,
      emi: round(altEmi),
      totalInterest: round(altTotal - input.loanAmount),
    };
  });

  // Prepayment benefit: 5-year mark, lump sum = 10 EMIs
  const prepaymentYear = Math.min(5, Math.floor(input.tenureYears / 2));
  const lumpSumAmount = round(emi * 10);
  const prepaymentBenefit = computePrepaymentBenefit({
    principal: input.loanAmount,
    annualRatePct: input.interestRatePct,
    tenureYears: input.tenureYears,
    prepayAtMonth: prepaymentYear * 12,
    prepayAmount: lumpSumAmount,
  });

  return {
    loanAmount: input.loanAmount,
    tenureYears: input.tenureYears,
    interestRatePct: input.interestRatePct,
    emi: round(emi),
    totalPayment: round(totalPayment),
    totalInterest: round(totalInterest),
    interestToPrincipalRatio: round((totalInterest / input.loanAmount) * 100) / 100,
    processingFee,
    ltv: input.propertyValue > 0 ? round((input.loanAmount / input.propertyValue) * 100) : 0,
    amortization,
    rateSensitivity,
    prepaymentBenefit: {
      lumpSumAtYear: prepaymentYear,
      lumpSumAmount,
      tenureReductionMonths: prepaymentBenefit.monthsSaved,
      interestSaved: prepaymentBenefit.interestSaved,
    },
    assumptions: [
      "EMI is indicative. Actual EMI depends on the bank's final sanction letter after verification.",
      "Interest rate is illustrative — floating rates may change based on RLLR or MCLR revisions.",
      "Processing fee shown is typical; actual fee is negotiable with most lenders.",
      "GST of 18% on the processing fee is not included.",
      "Foreclosure charges on floating-rate home loans are prohibited by RBI for individual borrowers.",
    ],
  };
}

function computePrepaymentBenefit(params: {
  principal: number;
  annualRatePct: number;
  tenureYears: number;
  prepayAtMonth: number;
  prepayAmount: number;
}): { monthsSaved: number; interestSaved: number } {
  const r = params.annualRatePct / 100 / 12;
  const totalMonths = params.tenureYears * 12;
  const emi = emiMonthly(params.principal, params.annualRatePct, params.tenureYears);

  // Simulate two paths — with and without prepayment — and compare
  let balanceA = params.principal;
  let balanceB = params.principal;
  let interestA = 0;
  let interestB = 0;
  let monthsElapsedB = 0;

  for (let m = 1; m <= totalMonths; m += 1) {
    const iA = balanceA * r;
    const pA = emi - iA;
    interestA += iA;
    balanceA = Math.max(0, balanceA - pA);

    if (balanceB > 0) {
      const iB = balanceB * r;
      const pB = emi - iB;
      interestB += iB;
      balanceB = Math.max(0, balanceB - pB);
      if (m === params.prepayAtMonth) {
        balanceB = Math.max(0, balanceB - params.prepayAmount);
      }
      monthsElapsedB = m;
      if (balanceB <= 0) break;
    }
  }

  return {
    monthsSaved: totalMonths - monthsElapsedB,
    interestSaved: round(interestA - interestB),
  };
}
