"use client";

import { motion } from "framer-motion";
import { IllustrationAreaChart } from "./area-chart";
import { ComparisonRow } from "./comparison-row";
import { ComplianceDisclaimer } from "./disclaimer";
import { YouPayYouGet } from "./you-pay-you-get";

export interface PreviewPayload {
  sections: Array<{ heading: string; rows: Array<{ label: string; value: string }> }>;
  chartData: Array<{ year: number; paid: number; value: number }>;
  comparisons: Array<{ product: string; returns: string }>;
  disclaimers: readonly string[] | string[];
  regime: string;
  assumptions?: string[];
}

interface Props {
  productType: string;
  payload: PreviewPayload;
  chartLabels?: { paid?: string; value?: string };
  comparisonTitle?: string;
}

/**
 * The canonical illustration render.
 *
 * Used in TWO places:
 *   1. The agent's live preview pane while building an illustration
 *   2. The customer-facing /i/:shortCode public view
 *
 * Both render exactly the same component — so what the customer sees is
 * what the agent saw, to the pixel.
 */
export function IllustrationPreview({
  productType,
  payload,
  chartLabels,
  comparisonTitle = "Comparison with other options",
}: Props): JSX.Element {
  const defaultLabels =
    productType === "sip"
      ? { paid: "Total invested", value: "Corpus value" }
      : productType === "home_loan"
        ? { paid: "Principal paid", value: "Interest paid" }
        : { paid: "Total premium paid", value: "Life cover" };

  const labels = { ...defaultLabels, ...chartLabels };

  return (
    <div className="space-y-8">
      <YouPayYouGet sections={payload.sections.slice(0, 2)} />

      {payload.chartData.length > 1 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl border bg-card p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Year-by-year projection
          </h3>
          <div className="mt-4">
            <IllustrationAreaChart
              data={payload.chartData}
              paidLabel={labels.paid}
              valueLabel={labels.value}
              paidColor="rgb(236, 72, 153)"
              valueColor="rgb(16, 185, 129)"
            />
          </div>
        </motion.section>
      )}

      {payload.comparisons.length > 0 && (
        <ComparisonRow title={comparisonTitle} comparisons={payload.comparisons} />
      )}

      <ComplianceDisclaimer
        regime={payload.regime}
        disclaimers={[...payload.disclaimers]}
        assumptions={payload.assumptions}
      />
    </div>
  );
}
