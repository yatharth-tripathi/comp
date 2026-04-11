import { ShieldAlert } from "lucide-react";

interface Props {
  regime: string;
  disclaimers: string[];
  assumptions?: string[];
}

/**
 * Regulatory disclaimer footer. Required on every illustration. Cannot be
 * disabled by agents. Appears on both the agent builder preview AND the
 * customer-facing view.
 */
export function ComplianceDisclaimer({ regime, disclaimers, assumptions }: Props): JSX.Element {
  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-4 w-4" />
        {regime} regulatory disclosures
      </div>
      <ul className="space-y-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
        {disclaimers.map((d, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-700 dark:bg-amber-300" />
            <span>{d}</span>
          </li>
        ))}
      </ul>
      {assumptions && assumptions.length > 0 && (
        <div className="border-t border-amber-200/60 pt-3 dark:border-amber-900/40">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-300/80">
            Assumptions used
          </div>
          <ul className="space-y-1 text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
            {assumptions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-700/60 dark:bg-amber-300/60" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
