import Link from "next/link";
import { Calculator, HeartPulse, Home, PiggyBank, ShieldCheck } from "lucide-react";

export const metadata = { title: "PitchWiz" };

const ILLUSTRATORS = [
  {
    slug: "term-plan",
    name: "Term Insurance",
    tagline: "Real 2024-calibrated premium math. Riders, smoker surcharge, modal factors.",
    icon: ShieldCheck,
    color: "from-rose-500 to-pink-500",
    regime: "IRDAI",
  },
  {
    slug: "sip",
    name: "SIP / Mutual Fund",
    tagline: "Closed-form compound growth. SEBI-mandated 4% / 8% / 12% scenarios built in.",
    icon: PiggyBank,
    color: "from-emerald-500 to-teal-500",
    regime: "SEBI + AMFI",
  },
  {
    slug: "home-loan",
    name: "Home Loan",
    tagline: "Exact EMI with month-by-month amortization, rate sensitivity, prepayment benefit.",
    icon: Home,
    color: "from-blue-500 to-indigo-500",
    regime: "RBI",
  },
  {
    slug: "health",
    name: "Health Insurance",
    tagline: "Family-floater vs individual, age-banded premiums, add-on stacking.",
    icon: HeartPulse,
    color: "from-orange-500 to-amber-500",
    regime: "IRDAI",
  },
];

export default function IllustratorPickerPage(): JSX.Element {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Calculator className="h-4 w-4" />
          PitchWiz
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Generate a customer illustration in 2 minutes
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Real math. Regulator-grade disclaimers. Trackable short link. The same numbers the
          agent sees while building are the numbers the customer sees on the shared link —
          because both screens run the same pure function from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@salescontent/finance</code>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ILLUSTRATORS.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.slug}
              href={`/illustrator/${it.slug}`}
              className="group relative overflow-hidden rounded-3xl border bg-card p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div
                className={`absolute -right-6 -top-6 h-32 w-32 rounded-full bg-gradient-to-br ${it.color} opacity-10 blur-3xl transition group-hover:opacity-25`}
              />
              <div className="relative flex items-start gap-4">
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${it.color} text-white shadow-md`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{it.name}</h3>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                      {it.regime}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{it.tagline}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
