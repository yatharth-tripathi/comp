/**
 * Health Insurance — premium and coverage math.
 *
 * Indicative premium calibration based on Star Health, HDFC ERGO, Care
 * Health, and Niva Bupa 2024 published retail tables for individual + floater
 * products. Accuracy target: ±20% for the common case.
 *
 * Key variables:
 *   - Age of eldest insured (primary driver)
 *   - Sum insured
 *   - Family composition (individual vs floater, 2–6 members)
 *   - Add-ons (OPD, maternity, critical illness, room upgrade)
 *   - City tier (metro vs non-metro — skipped for now, assumes metro)
 */

import { round } from "./money.js";

export type Relation = "self" | "spouse" | "child" | "parent";

export interface HealthInsuranceInput {
  customerName: string;
  policyType: "individual" | "floater";
  family: Array<{ relation: Relation; age: number }>;
  sumInsured: number;
  addons: {
    opd?: boolean;
    maternity?: boolean;
    criticalIllness?: boolean;
    roomUpgrade?: boolean;
  };
}

export interface HealthInsuranceOutput {
  annualPremium: number;
  monthlyPremium: number;
  gstAmount: number;
  premiumWithGst: number;
  sumInsured: number;
  policyType: "individual" | "floater";
  memberCount: number;

  breakdown: {
    baseByMember: Array<{ relation: Relation; age: number; premium: number }>;
    floaterDiscount: number;
    addonTotal: number;
  };

  coverage: {
    roomRentLimit: string;
    copay: string;
    preExistingWaitingMonths: number;
    maternityWaitingMonths: number | null;
    noClaimBonusPct: number;
    restoration: boolean;
    cashlessHospitals: number;
  };

  addonBreakdown: Array<{
    label: string;
    annualCost: number;
    included: boolean;
  }>;

  scenarioComparisons: Array<{
    label: string;
    sumInsured: number;
    annualPremium: number;
  }>;

  assumptions: string[];
}

// Per-member base premium at ₹5L sum insured (annual, metro, indicative)
function basePremiumAt5L(age: number): number {
  if (age < 1) return 3_200;
  if (age <= 5) return 3_500;
  if (age <= 18) return 3_800;
  if (age <= 30) return 5_200;
  if (age <= 40) return 7_800;
  if (age <= 50) return 12_500;
  if (age <= 60) return 19_000;
  if (age <= 70) return 30_000;
  return 44_000;
}

// Sum insured scaling vs the ₹5L baseline
function sumInsuredMultiplier(sumInsured: number): number {
  const lakhs = sumInsured / 100_000;
  if (lakhs <= 3) return 0.82;
  if (lakhs <= 5) return 1.0;
  if (lakhs <= 10) return 1.48;
  if (lakhs <= 15) return 1.9;
  if (lakhs <= 25) return 2.55;
  if (lakhs <= 50) return 3.8;
  return 5.2;
}

// Floater discount vs summing individual premiums
function floaterMultiplier(memberCount: number): number {
  if (memberCount <= 1) return 1.0;
  if (memberCount === 2) return 0.78;
  if (memberCount === 3) return 0.68;
  if (memberCount === 4) return 0.62;
  if (memberCount === 5) return 0.58;
  return 0.55;
}

const ADDON_SURCHARGE = {
  opd: 0.26,
  maternity: 0.18,
  criticalIllness: 0.21,
  roomUpgrade: 0.09,
} as const;

const ADDON_LABELS: Record<keyof typeof ADDON_SURCHARGE, string> = {
  opd: "OPD cover (consultation + pharmacy)",
  maternity: "Maternity benefit",
  criticalIllness: "Critical illness rider",
  roomUpgrade: "Single private room (no rent cap)",
};

export function computeHealthInsurance(input: HealthInsuranceInput): HealthInsuranceOutput {
  const sm = sumInsuredMultiplier(input.sumInsured);

  // Per-member base (at the chosen sum insured)
  const baseByMember = input.family.map((member) => ({
    relation: member.relation,
    age: member.age,
    premium: round(basePremiumAt5L(member.age) * sm),
  }));

  const rawTotal = baseByMember.reduce((acc, m) => acc + m.premium, 0);

  // Apply floater discount if floater
  const fm =
    input.policyType === "floater" ? floaterMultiplier(baseByMember.length) : 1.0;
  const afterFloater = rawTotal * fm;
  const floaterDiscount = round(rawTotal - afterFloater);

  // Add-ons
  let addonTotal = 0;
  const addonBreakdown: HealthInsuranceOutput["addonBreakdown"] = [];
  for (const key of Object.keys(ADDON_SURCHARGE) as Array<keyof typeof ADDON_SURCHARGE>) {
    const included = Boolean(input.addons[key]);
    const cost = included ? round(afterFloater * ADDON_SURCHARGE[key]) : 0;
    addonTotal += cost;
    addonBreakdown.push({
      label: ADDON_LABELS[key],
      annualCost: cost,
      included,
    });
  }

  const annualPremium = round(afterFloater + addonTotal);
  const gstAmount = round(annualPremium * 0.18);
  const premiumWithGst = annualPremium + gstAmount;
  const monthlyPremium = round(premiumWithGst / 12);

  // Scenario comparison — same family, three sum insured levels
  const scenarioComparisons = [500_000, 1_000_000, 2_000_000, 5_000_000].map((si) => {
    const altSm = sumInsuredMultiplier(si);
    const altRaw = input.family.reduce(
      (acc, m) => acc + basePremiumAt5L(m.age) * altSm,
      0,
    );
    const altAfterFloater = altRaw * fm;
    return {
      label: si >= 10_000_000 ? "₹1 Cr" : `₹${si / 100_000} L`,
      sumInsured: si,
      annualPremium: round(altAfterFloater * (1 + addonTotal / Math.max(afterFloater, 1))),
    };
  });

  return {
    annualPremium,
    monthlyPremium,
    gstAmount,
    premiumWithGst,
    sumInsured: input.sumInsured,
    policyType: input.policyType,
    memberCount: input.family.length,
    breakdown: {
      baseByMember,
      floaterDiscount,
      addonTotal: round(addonTotal),
    },
    coverage: {
      roomRentLimit: input.addons.roomUpgrade
        ? "Any single private room (no rent cap)"
        : "Up to 1% of sum insured per day",
      copay:
        input.family.some((m) => m.age >= 60)
          ? "20% co-pay applicable for claims on members aged 60+"
          : "No co-pay",
      preExistingWaitingMonths: 36,
      maternityWaitingMonths: input.addons.maternity ? 24 : null,
      noClaimBonusPct: 50,
      restoration: true,
      cashlessHospitals: 8500,
    },
    addonBreakdown,
    scenarioComparisons,
    assumptions: [
      "Premium is indicative. Actual premium depends on pre-policy medical check results, city tier, and declared conditions.",
      "Base rates calibrated to 2024 retail rates from Star Health, HDFC ERGO, Care Health, and Niva Bupa.",
      "18% GST is added as shown — premium inclusive of GST is the amount actually payable.",
      "30-day initial waiting period applies to all claims except accidents.",
      "Pre-existing disease waiting period is 36 months from policy inception.",
      "Sub-limits, room-rent caps, and disease-specific waiting periods apply as per the chosen insurer's policy wording.",
    ],
  };
}
