/**
 * Mandatory regulatory disclaimers per product type.
 *
 * These strings are BURNED INTO every generated illustration. Agents
 * cannot edit them. Changing a disclaimer requires a code change + a
 * release because that's exactly the kind of compliance control the
 * PRD §4.6 approval workflow exists to enforce.
 *
 * Current version: v1 — April 2026.
 */

export const DISCLAIMER_VERSION = "v1";

export const TERM_PLAN_DISCLAIMERS = [
  "This illustration is indicative and not a policy document. Actual premium depends on medical underwriting and final insurer quote.",
  "Insurance is the subject matter of the solicitation. For more details on risk factors, terms and conditions please read the product brochure carefully before concluding a sale.",
  "The premium shown does not include Goods and Services Tax (GST) at 18% which is payable additionally.",
  "IRDAI clarifies to public that: IRDAI or its officials do not involve in activities like sale of any kind of insurance or financial products nor invest premiums. IRDAI does not announce any bonus.",
] as const;

export const SIP_DISCLAIMERS = [
  "Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing.",
  "Past performance of any mutual fund is not a reliable indicator of future performance.",
  "The returns shown are illustrative, based on assumed annual return rates. Actual returns depend on market performance and scheme selection.",
  "This is NOT a recommendation for any specific mutual fund scheme. Consult an AMFI-registered advisor before investing.",
  "SEBI (Mutual Funds) Regulations require illustrations at 4%, 8%, and 12% — these rates are regulatory reference points, not predictions.",
] as const;

export const HOME_LOAN_DISCLAIMERS = [
  "EMI shown is indicative. Actual EMI, interest rate, and eligibility are determined by the bank after verification.",
  "Interest rates are subject to change based on RLLR / MCLR revisions and market conditions.",
  "Processing fees and documentation charges are excluded unless explicitly shown.",
  "As per RBI regulations, foreclosure charges are prohibited on floating-rate home loans for individual borrowers.",
  "Key Fact Statement (KFS) with the Annual Percentage Rate (APR) must be provided by the lender before disbursal.",
] as const;

export const HEALTH_INSURANCE_DISCLAIMERS = [
  "Premium is indicative. Actual premium depends on pre-policy medical check results, city tier, and declared pre-existing conditions.",
  "All claims are subject to policy terms, conditions, exclusions, and waiting periods as defined in the chosen insurer's policy wording.",
  "Pre-existing diseases have a 36-month waiting period from the policy inception date.",
  "Insurance is the subject matter of the solicitation. GST of 18% is applicable on the base premium.",
  "For full details on coverage, co-pay, room rent limits, and network hospitals, please read the Customer Information Sheet (CIS) of the chosen insurer.",
] as const;

export function getDisclaimersForProduct(
  productType: string,
): { regime: string; disclaimers: readonly string[] } {
  switch (productType) {
    case "term_plan":
    case "ulip":
      return { regime: "IRDAI", disclaimers: TERM_PLAN_DISCLAIMERS };
    case "sip":
    case "mutual_fund":
      return { regime: "SEBI + AMFI", disclaimers: SIP_DISCLAIMERS };
    case "home_loan":
    case "personal_loan":
    case "auto_loan":
      return { regime: "RBI", disclaimers: HOME_LOAN_DISCLAIMERS };
    case "health_insurance":
      return { regime: "IRDAI", disclaimers: HEALTH_INSURANCE_DISCLAIMERS };
    default:
      return { regime: "Generic", disclaimers: [] };
  }
}
