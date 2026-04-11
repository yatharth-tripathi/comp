import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { and, db, desc, eq, schema, sql } from "@salescontent/db";
import {
  DISCLAIMER_VERSION,
  computeHealthInsurance,
  computeHomeLoan,
  computeSip,
  computeTermPlan,
  getDisclaimersForProduct,
} from "@salescontent/finance";
import { createIllustrationSchema } from "@salescontent/schemas";
import { authMiddleware } from "../middleware/auth.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { generateUniqueShortCode } from "../services/short-link.js";

export const illustrationRoutes = new Hono();

// ---------------------------------------------------------------------------
// POST /api/illustrations
//
// The agent fills out a form for ONE product type. The server runs the
// canonical math, persists the row, and returns the full output including
// the public short-code URL the customer will see.
//
// Input is validated via a discriminated union Zod schema — productType
// determines which input shape is required.
// ---------------------------------------------------------------------------
illustrationRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createIllustrationSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const agentId = c.get("userId");
    const body = c.req.valid("json");

    const shortCode = await generateUniqueShortCode();
    const disclaimers = getDisclaimersForProduct(body.productType);

    let outputJson: Record<string, unknown> = {};
    let typed: Record<string, unknown> = {};

    switch (body.productType) {
      case "term_plan": {
        const out = computeTermPlan(body.input);
        outputJson = {
          sections: [
            {
              heading: "You Pay",
              rows: [
                { label: "Annual premium", value: `₹${out.annualPremium.toLocaleString("en-IN")}` },
                { label: "Monthly", value: `₹${out.monthlyPremium.toLocaleString("en-IN")}` },
                { label: "Cost per ₹1L of cover", value: `₹${out.costPerLakhPerYear}/yr` },
                {
                  label: "Total premium over term",
                  value: `₹${out.totalPremiumPaid.toLocaleString("en-IN")}`,
                },
              ],
            },
            {
              heading: "You Get",
              rows: [
                {
                  label: "Life cover (sum assured)",
                  value: `₹${out.sumAssured.toLocaleString("en-IN")}`,
                },
                {
                  label: "Term",
                  value: `${body.input.policyTermYears} years`,
                },
                {
                  label: "Premium payment term",
                  value: `${body.input.premiumPaymentTermYears} years`,
                },
              ],
            },
          ],
          chartData: out.projection.map((p) => ({
            year: p.year,
            paid: p.cumulativePremiumPaid,
            value: p.deathBenefit,
          })),
          comparisons: out.comparison.map((c) => ({
            product: c.product,
            returns:
              c.returnAfterTerm !== null
                ? `₹${c.returnAfterTerm.toLocaleString("en-IN")}`
                : c.deathBenefit !== null
                  ? `${c.product} death benefit: ₹${c.deathBenefit.toLocaleString("en-IN")}`
                  : "—",
          })),
          detail: out,
          disclaimers: disclaimers.disclaimers,
          regime: disclaimers.regime,
          assumptions: out.assumptions,
        };
        typed = {
          customerName: body.input.customerName,
          customerAge: body.input.customerAge,
          customerGender: body.input.customerGender,
          sumAssured: body.input.sumAssured,
          policyTermYears: body.input.policyTermYears,
          premiumPaymentTermYears: body.input.premiumPaymentTermYears,
          annualPremium: out.annualPremium,
          monthlyPremium: out.monthlyPremium,
        };
        break;
      }

      case "sip": {
        const out = computeSip(body.input);
        outputJson = {
          sections: [
            {
              heading: "You Invest",
              rows: [
                { label: "Monthly SIP", value: `₹${out.monthlyAmount.toLocaleString("en-IN")}` },
                { label: "Duration", value: `${out.durationYears} years` },
                {
                  label: "Total invested",
                  value: `₹${out.totalInvested.toLocaleString("en-IN")}`,
                },
              ],
            },
            {
              heading: "You Get (assumed)",
              rows: [
                {
                  label: "Maturity value",
                  value: `₹${out.maturityValue.toLocaleString("en-IN")}`,
                },
                {
                  label: "Wealth gained",
                  value: `₹${out.wealthGained.toLocaleString("en-IN")}`,
                },
                {
                  label: "Wealth multiplier",
                  value: `${out.wealthMultiplier.toFixed(2)}×`,
                },
                {
                  label: "Real purchasing power",
                  value: `₹${out.realPurchasingPower.toLocaleString("en-IN")}`,
                },
              ],
            },
          ],
          chartData: out.projection.map((p) => ({
            year: p.year,
            paid: p.invested,
            value: p.corpus,
          })),
          comparisons: out.scenarios.map((s) => ({
            product: s.label,
            returns: `₹${s.maturityValue.toLocaleString("en-IN")}`,
          })),
          detail: out,
          disclaimers: disclaimers.disclaimers,
          regime: disclaimers.regime,
          assumptions: out.assumptions,
        };
        typed = {
          customerName: body.input.customerName,
          monthlySipAmount: body.input.monthlyAmount,
          investmentHorizonYears: body.input.durationYears,
          expectedReturnPct: body.input.expectedReturnPct,
        };
        break;
      }

      case "home_loan": {
        const out = computeHomeLoan(body.input);
        outputJson = {
          sections: [
            {
              heading: "Monthly burden",
              rows: [
                { label: "EMI", value: `₹${out.emi.toLocaleString("en-IN")}` },
                {
                  label: "Interest rate",
                  value: `${out.interestRatePct.toFixed(2)}% p.a.`,
                },
                {
                  label: "Loan-to-value",
                  value: `${out.ltv}%`,
                },
              ],
            },
            {
              heading: "Total outgo",
              rows: [
                {
                  label: "Total payment over tenure",
                  value: `₹${out.totalPayment.toLocaleString("en-IN")}`,
                },
                {
                  label: "Total interest",
                  value: `₹${out.totalInterest.toLocaleString("en-IN")}`,
                },
                {
                  label: "Processing fee",
                  value: `₹${out.processingFee.toLocaleString("en-IN")}`,
                },
              ],
            },
          ],
          chartData: out.amortization.map((a) => ({
            year: a.year,
            paid: a.principalPaid,
            value: a.interestPaid,
          })),
          comparisons: out.rateSensitivity.map((rs) => ({
            product: rs.label,
            returns: `EMI ₹${rs.emi.toLocaleString("en-IN")} · Interest ₹${rs.totalInterest.toLocaleString(
              "en-IN",
            )}`,
          })),
          detail: out,
          disclaimers: disclaimers.disclaimers,
          regime: disclaimers.regime,
          assumptions: out.assumptions,
        };
        typed = {
          customerName: body.input.customerName,
          loanAmount: body.input.loanAmount,
          loanTenureYears: body.input.tenureYears,
          interestRatePct: String(body.input.interestRatePct),
        };
        break;
      }

      case "health_insurance": {
        const out = computeHealthInsurance(body.input);
        outputJson = {
          sections: [
            {
              heading: "You Pay",
              rows: [
                {
                  label: "Annual premium (incl. GST)",
                  value: `₹${out.premiumWithGst.toLocaleString("en-IN")}`,
                },
                {
                  label: "Monthly",
                  value: `₹${out.monthlyPremium.toLocaleString("en-IN")}`,
                },
                {
                  label: "Base premium",
                  value: `₹${out.annualPremium.toLocaleString("en-IN")}`,
                },
                {
                  label: "GST (18%)",
                  value: `₹${out.gstAmount.toLocaleString("en-IN")}`,
                },
              ],
            },
            {
              heading: "You Get",
              rows: [
                {
                  label: "Sum insured",
                  value: `₹${out.sumInsured.toLocaleString("en-IN")}`,
                },
                {
                  label: "Policy type",
                  value: out.policyType === "floater" ? "Family floater" : "Individual",
                },
                { label: "Members covered", value: String(out.memberCount) },
                {
                  label: "Cashless hospitals",
                  value: `${out.coverage.cashlessHospitals}+`,
                },
                {
                  label: "No-claim bonus",
                  value: `Up to ${out.coverage.noClaimBonusPct}% per year`,
                },
              ],
            },
          ],
          chartData: out.scenarioComparisons.map((s) => ({
            year: 0,
            paid: s.sumInsured,
            value: s.annualPremium,
          })),
          comparisons: out.breakdown.baseByMember.map((m) => ({
            product: `${m.relation} · age ${m.age}`,
            returns: `₹${m.premium.toLocaleString("en-IN")}`,
          })),
          detail: out,
          disclaimers: disclaimers.disclaimers,
          regime: disclaimers.regime,
          assumptions: out.assumptions,
        };
        typed = {
          customerName: body.input.customerName,
          sumAssured: body.input.sumInsured,
          annualPremium: out.premiumWithGst,
          monthlyPremium: out.monthlyPremium,
        };
        break;
      }

      default:
        throw new ValidationError(
          `Unsupported productType: ${(body as { productType: string }).productType}`,
        );
    }

    const [row] = await db
      .insert(schema.illustrations)
      .values({
        tenantId,
        agentId,
        productType: body.productType,
        shortCode,
        inputJson: body.input as unknown as Record<string, unknown>,
        outputJson: outputJson as never,
        disclaimerVersion: DISCLAIMER_VERSION,
        ...typed,
      })
      .returning();
    if (!row) throw new Error("Failed to insert illustration");

    await c.var.audit({
      action: "create",
      resourceType: "illustration",
      resourceId: row.id,
      metadata: { productType: body.productType, shortCode },
    });

    const publicBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return c.json(
      {
        data: {
          id: row.id,
          shortCode,
          productType: body.productType,
          outputJson,
          publicUrl: `${publicBase}/i/${shortCode}`,
          createdAt: row.createdAt,
        },
      },
      201,
    );
  },
);

// ---------------------------------------------------------------------------
// GET /api/illustrations — list for the current agent (latest first)
// ---------------------------------------------------------------------------
illustrationRoutes.get("/", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const agentId = c.get("userId");
  const role = c.get("role");

  const where =
    role === "enterprise_admin" || role === "content_manager" || role === "super_admin"
      ? eq(schema.illustrations.tenantId, tenantId)
      : and(
          eq(schema.illustrations.tenantId, tenantId),
          eq(schema.illustrations.agentId, agentId),
        );

  const rows = await db.query.illustrations.findMany({
    where,
    orderBy: [desc(schema.illustrations.createdAt)],
    limit: 50,
  });
  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// GET /api/illustrations/:id — full detail
// ---------------------------------------------------------------------------
illustrationRoutes.get("/:id", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const row = await db.query.illustrations.findFirst({
    where: and(
      eq(schema.illustrations.id, id),
      eq(schema.illustrations.tenantId, tenantId),
    ),
  });
  if (!row) throw new NotFoundError("Illustration");
  return c.json({ data: row });
});

// ---------------------------------------------------------------------------
// POST /api/illustrations/:id/share
// Bumps the share counter + returns the trackable URL. Currently just the
// illustration's own short code — we don't spawn a parallel content_share_events
// row because illustrations are inherently customer-specific (the customer name
// is inside the input). Per-recipient tracking for the same customer is one
// illustration = one share target.
// ---------------------------------------------------------------------------
illustrationRoutes.post("/:id/share", authMiddleware, async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");

  const row = await db.query.illustrations.findFirst({
    where: and(
      eq(schema.illustrations.id, id),
      eq(schema.illustrations.tenantId, tenantId),
    ),
    columns: { id: true, shortCode: true, productType: true },
  });
  if (!row) throw new NotFoundError("Illustration");

  await c.var.audit({
    action: "share",
    resourceType: "illustration",
    resourceId: id,
    metadata: { shortCode: row.shortCode, productType: row.productType },
  });

  const publicBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return c.json({
    data: {
      shortCode: row.shortCode,
      redirectUrl: `${publicBase}/i/${row.shortCode}`,
    },
  });
});

// Satisfy unused imports
void sql;
