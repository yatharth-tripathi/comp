import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

/* ----------------------------------------------------------------------------
   Landing page — SalesContent AI
   Aesthetic: "Precision Instrument" (CLAUDE.md §5)
   Dark-first (ink base). Editorial asymmetric grid. Single saffron accent.
   Server component — session check runs at the top, then static render.
---------------------------------------------------------------------------- */

export default async function LandingPage(): Promise<JSX.Element> {
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-parchment grain-overlay">
      {/* Devanagari watermark — identity without kitsch */}
      <div
        aria-hidden
        className="devanagari-watermark pointer-events-none absolute left-1/2 top-[18vh] z-0 -translate-x-1/2 select-none text-parchment"
      >
        विश्वास
      </div>

      <TopNav />
      <Hero />
      <ProofStrip />
      <Pillars />
      <ModuleMap />
      <AudienceBands />
      <ClosingCTA />
      <SiteFooter />
    </div>
  );
}

/* ============================== TOP NAV ================================= */

function TopNav(): JSX.Element {
  return (
    <header className="relative z-20 mx-auto flex max-w-[1280px] items-center justify-between px-6 pt-7 lg:px-8">
      <Link href="/" className="group flex items-center gap-3">
        <BrandMark />
        <div className="flex flex-col leading-none">
          <span className="font-display text-[1.35rem] tracking-tight">SalesContent</span>
          <span className="label-mono mt-0.5 text-fog">AARAMBH LABS · इंडिया</span>
        </div>
      </Link>
      <nav className="hidden items-center gap-8 md:flex">
        <NavLink href="#field">Field</NavLink>
        <NavLink href="#managers">Managers</NavLink>
        <NavLink href="#modules">Modules</NavLink>
        <NavLink href="#compliance">Compliance</NavLink>
      </nav>
      <div className="flex items-center gap-3">
        <a
          href="/sign-in"
          className="hidden text-body-sm text-fog transition-colors hover:text-parchment md:inline-block"
        >
          Sign in
        </a>
        <a
          href="/sign-up"
          className="group inline-flex items-center gap-2 rounded-sm border border-saffron/40 bg-saffron/10 px-4 py-2 text-body-sm font-medium text-saffron-bright backdrop-blur-sm transition-all hover:border-saffron hover:bg-saffron hover:text-ink"
        >
          Start a pilot
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return (
    <a
      href={href}
      className="label-mono text-fog transition-colors hover:text-parchment"
    >
      {children}
    </a>
  );
}

function BrandMark(): JSX.Element {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden>
        <rect x="0.5" y="0.5" width="39" height="39" rx="4" className="fill-ink-raised stroke-ink-line" strokeWidth="1" />
        <path d="M10 28 L10 12 L20 20 L30 12 L30 28" className="fill-none stroke-saffron" strokeWidth="1.5" strokeLinejoin="miter" />
        <circle cx="20" cy="20" r="1.5" className="fill-saffron" />
      </svg>
    </div>
  );
}

/* ================================ HERO ================================== */

function Hero(): JSX.Element {
  return (
    <section className="relative z-10 spotlight-top">
      <div className="mx-auto max-w-[1280px] px-6 pb-24 pt-20 lg:px-8 lg:pt-28">
        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT — headline */}
          <div className="col-span-12 lg:col-span-7">
            <div className="reveal" style={{ animationDelay: "0.05s" }}>
              <EyebrowLabel number="01" text="FIELD-FIRST ENABLEMENT" />
            </div>
            <h1
              className="reveal mt-8 font-display text-display-xl text-parchment"
              style={{ animationDelay: "0.15s" }}
            >
              Sales enablement,
              <br />
              <span className="italic text-saffron-bright">rebuilt</span> for the
              <br />
              agent on the field.
            </h1>
            <p
              className="reveal mt-8 max-w-xl text-body-lg text-fog"
              style={{ animationDelay: "0.3s" }}
            >
              An AI-native content, coaching, and compliance engine for Indian BFSI — delivered over
              WhatsApp, in the language your agents actually sell in. Built for the mid-market
              Sharpsell left behind.
            </p>

            <div
              className="reveal mt-12 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "0.45s" }}
            >
              <a
                href="/sign-up"
                className="group inline-flex items-center gap-3 bg-saffron px-7 py-4 text-body-sm font-semibold text-ink transition-all hover:bg-saffron-bright"
              >
                Start a pilot
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a
                href="#modules"
                className="group inline-flex items-center gap-3 border border-ink-line px-7 py-4 text-body-sm font-medium text-parchment transition-all hover:border-parchment/40 hover:bg-ink-raised"
              >
                <span className="label-mono text-fog group-hover:text-saffron">↓</span>
                See the eighteen modules
              </a>
            </div>

            <div
              className="reveal mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 label-mono text-fog"
              style={{ animationDelay: "0.6s" }}
            >
              <span className="text-saffron">◦</span> SEBI · IRDAI · RBI aware
              <span className="text-saffron">◦</span> 12 Indian languages
              <span className="text-saffron">◦</span> DPDP compliant by default
            </div>
          </div>

          {/* RIGHT — live panel mockup */}
          <div className="col-span-12 lg:col-span-5 lg:pt-4">
            <div
              className="reveal relative"
              style={{ animationDelay: "0.5s" }}
            >
              <LivePanel />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EyebrowLabel({ number, text }: { number: string; text: string }): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <span className="label-mono text-saffron">{number}</span>
      <span className="h-px w-8 bg-ink-line" aria-hidden />
      <span className="label-mono text-fog">{text}</span>
    </div>
  );
}

function LivePanel(): JSX.Element {
  return (
    <div className="relative">
      {/* Anchor crosshairs */}
      <div aria-hidden className="absolute -left-2 -top-2 font-mono text-saffron/60 text-sm">+</div>
      <div aria-hidden className="absolute -right-2 -top-2 font-mono text-saffron/60 text-sm">+</div>
      <div aria-hidden className="absolute -bottom-2 -left-2 font-mono text-saffron/60 text-sm">+</div>
      <div aria-hidden className="absolute -bottom-2 -right-2 font-mono text-saffron/60 text-sm">+</div>

      <div className="relative overflow-hidden rounded-sm border border-ink-line bg-ink-raised">
        {/* Panel chrome */}
        <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-signal" />
            <span className="label-mono text-fog">LIVE · ROLE-PLAY RUNNER</span>
          </div>
          <span className="label-mono text-fog-dim">ch. 12 / 15</span>
        </div>

        {/* Panel body */}
        <div className="space-y-4 p-5">
          <div className="flex gap-3">
            <Avatar initials="RK" tone="fog" />
            <div className="flex-1">
              <div className="label-mono text-fog-dim">Rohit — Prospect</div>
              <p className="mt-1 text-body-sm text-parchment">
                Mutual funds mein risk kitna hota hai? Main pehli baar invest kar raha hoon — guaranteed
                return milega na?
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Avatar initials="A" tone="saffron" />
            <div className="flex-1">
              <div className="label-mono text-saffron">Agent — you</div>
              <div className="mt-1 rounded-sm border border-saffron/20 bg-saffron/5 p-3">
                <p className="text-body-sm text-parchment">
                  Mutual funds market-linked hain, guaranteed return nahi milta. Main aapko SIP ka
                  approach samjhata hoon — long-term mein 10–12% historical return possible hai…
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-signal/25 bg-signal/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="label-mono text-signal">NEXUS · SEBI CHECK PASSED</div>
              <span className="tabular text-body-sm text-signal">98 / 100</span>
            </div>
            <p className="mt-1 text-body-sm text-fog">
              No guaranteed-return language. Historical context provided. Risk disclosed.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-ink-line pt-4">
            <div className="flex items-center gap-4 label-mono text-fog">
              <span>EVALUATE</span>
              <span>↵ NEXT TURN</span>
            </div>
            <span className="label-mono text-saffron">CLAUDE SONNET 4.5</span>
          </div>
        </div>
      </div>

      {/* Lower pill — WhatsApp share echo */}
      <div className="absolute -bottom-10 -right-4 hidden w-64 rounded-sm border border-ink-line bg-ink-deep/80 p-3 shadow-xl backdrop-blur-sm md:block">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-signal animate-slow-drift" />
          <span className="label-mono text-signal">WHATSAPP · DELIVERED</span>
        </div>
        <p className="mt-2 text-body-sm text-parchment">
          Term plan illustration shared with <span className="text-saffron">Priya K.</span>
        </p>
        <p className="mt-1 label-mono text-fog-dim">0.3s · tracked</p>
      </div>
    </div>
  );
}

function Avatar({ initials, tone }: { initials: string; tone: "fog" | "saffron" }): JSX.Element {
  const cls =
    tone === "saffron"
      ? "bg-saffron/15 text-saffron-bright border-saffron/30"
      : "bg-ink-line text-fog border-ink-line";
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[0.7rem] ${cls}`}
    >
      {initials}
    </div>
  );
}

/* =========================== PROOF STRIP ================================ */

function ProofStrip(): JSX.Element {
  return (
    <section className="relative z-10 border-y border-ink-line bg-ink-deep">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-y-8 py-10 md:grid-cols-4 md:gap-x-8">
          <Stat value="18" unit="modules" caption="Every PRD surface shipping — shells production-ready" />
          <Stat value="5 K" unit="tokens" caption="NEXUS regulatory block, cached per Claude call" />
          <Stat value="12" unit="languages" caption="Hindi, Tamil, Telugu, Bengali, Marathi + 7 more" />
          <Stat value="₹3–6" unit="per session" caption="Claude cost at beta scale with prompt caching" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, unit, caption }: { value: string; unit: string; caption: string }): JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[2.75rem] leading-none text-parchment tabular">{value}</span>
        <span className="label-mono text-fog">{unit}</span>
      </div>
      <p className="mt-3 max-w-[14rem] text-body-sm text-fog">{caption}</p>
    </div>
  );
}

/* ============================== PILLARS ================================= */

function Pillars(): JSX.Element {
  return (
    <section id="compliance" className="relative z-10">
      <div className="mx-auto max-w-[1280px] px-6 py-28 lg:px-8 lg:py-36">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-4">
            <EyebrowLabel number="02" text="WHY THIS, WHY NOW" />
            <h2 className="mt-6 font-display text-display-lg text-parchment">
              Three things every Indian field team gets wrong.
            </h2>
            <p className="mt-6 max-w-sm text-body-lg text-fog">
              Enterprise incumbents cost too much, generic AI tooling ignores compliance, and
              WhatsApp — where Indian selling actually happens — is an afterthought.
            </p>
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-px bg-ink-line md:grid-cols-3 lg:col-span-8">
            <Pillar
              num="i"
              title="WhatsApp-native, not an export button"
              body="Shareable templates, tracked link previews, consent-compliant broadcasts, and a 5-intent inbound bot — the channel your agents already use, wired to the product."
            />
            <Pillar
              num="ii"
              title="Role-play that changes behaviour"
              body="Eighteen hand-authored BFSI scenarios, 15-exchange ladders, regulator-aware evaluation. NEXUS catches non-compliant language live, before it reaches a customer."
            />
            <Pillar
              num="iii"
              title="Mid-market economics"
              body="Priced 50–70% under enterprise incumbents. Multi-tenant from day one. Per-tenant Claude budget caps. Single-branch pilot to 5,000-agent rollout on one platform."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillar({ num, title, body }: { num: string; title: string; body: string }): JSX.Element {
  return (
    <div className="group flex flex-col gap-4 bg-ink p-8 transition-colors hover:bg-ink-raised">
      <div className="flex items-center justify-between">
        <span className="font-display text-3xl italic text-saffron">{num}</span>
        <span className="label-mono text-fog-dim group-hover:text-saffron">→</span>
      </div>
      <h3 className="mt-4 font-display text-heading-lg text-parchment">{title}</h3>
      <p className="text-body-sm text-fog">{body}</p>
    </div>
  );
}

/* ============================ MODULE MAP ================================ */

const MODULES: Array<{ code: string; name: string; gist: string }> = [
  { code: "03", name: "Content Library", gist: "Tag, personalise, share, attribute — every asset tracked to the deal." },
  { code: "04", name: "Reels", gist: "Mux pipeline, custom player, mandatory-training rails for micro-lessons." },
  { code: "05", name: "PitchWiz", gist: "Term plan, SIP, health, home-loan illustrators with isomorphic math." },
  { code: "06", name: "Role-Play + Show Me", gist: "Eighteen scenarios, Claude evaluator, NEXUS regulator guardrails." },
  { code: "07", name: "AI Sales Copilot", gist: "Pre / during / post-meeting modes. Cached prompts. Haiku-by-default." },
  { code: "08", name: "Learning Journeys", gist: "Assigned paths, quizzes, gated unlocks, manager visibility end-to-end." },
  { code: "09", name: "Lead Management", gist: "WhatsApp-sourced leads, stage automation, handback rules, audit trail." },
  { code: "10", name: "WhatsApp Bot", gist: "Five inbound intents, Meta Cloud API, webhook-verified templates." },
  { code: "11", name: "Manager Dashboard", gist: "Cohort drill-downs, content velocity, role-play scores, red flags." },
  { code: "12", name: "Public REST API", gist: "Tenant-scoped, rate-limited, audit-logged — for HRIS and CRM sync." },
  { code: "13", name: "PWA + Offline", gist: "Service-worker caching, offline role-plays, resumable uploads." },
  { code: "14", name: "Admin + Security", gist: "DPDP erasure, VAPT-ready, OWASP Top 10 coverage, tenant isolation." },
];

function ModuleMap(): JSX.Element {
  return (
    <section id="modules" className="relative z-10 border-t border-ink-line bg-ink-deep">
      <div className="mx-auto max-w-[1280px] px-6 py-28 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <EyebrowLabel number="03" text="THE MAP" />
            <h2 className="mt-6 max-w-2xl font-display text-display-lg text-parchment">
              Eighteen modules. One instrument panel.
            </h2>
          </div>
          <p className="max-w-sm text-body-sm text-fog">
            A deliberately unified workspace. No plug-ins, no duct tape — every surface shares the
            same tenant, audit log, and Claude budget.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-px bg-ink-line md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleCell key={m.code} code={m.code} name={m.name} gist={m.gist} />
          ))}
        </div>

        <p className="mt-8 label-mono text-fog">
          01 Auth + Tenancy · 02 Onboarding · Plus Security + DPDP + VAPT hardening (14)
        </p>
      </div>
    </section>
  );
}

function ModuleCell({ code, name, gist }: { code: string; name: string; gist: string }): JSX.Element {
  return (
    <div className="group relative flex flex-col gap-3 bg-ink p-7 transition-all hover:bg-ink-raised">
      <div className="flex items-center justify-between">
        <span className="label-mono text-saffron">{code}</span>
        <span className="label-mono text-fog-dim transition-all group-hover:translate-x-1 group-hover:text-saffron">
          →
        </span>
      </div>
      <h3 className="font-display text-[1.6rem] text-parchment">{name}</h3>
      <p className="text-body-sm text-fog">{gist}</p>
    </div>
  );
}

/* ========================== AUDIENCE BANDS ============================== */

function AudienceBands(): JSX.Element {
  return (
    <section className="relative z-10">
      <AudienceBand
        id="field"
        tone="parchment"
        number="04"
        label="FOR FIELD AGENTS"
        headline="The only tool your agent opens before a meeting."
        bullets={[
          "Customer-specific content pulled from Library in three taps",
          "PitchWiz illustrator, sent as a WhatsApp-tracked link before the handshake",
          "Role-play any scenario at 10 PM the night before a pitch",
          "Offline-first PWA — metro tunnel to village branch, same workflow",
        ]}
        signature="— Built after riding along with 22 HDFC, ICICI, and Bajaj field agents."
      />
      <AudienceBand
        id="managers"
        tone="ink"
        number="05"
        label="FOR MANAGERS & L&D"
        headline="Finally see what your field team actually does."
        bullets={[
          "Content velocity per agent, per branch, per product",
          "Role-play scores cohort-ranked with NEXUS compliance flags",
          "Assign journeys, gate unlocks, track adherence by calendar week",
          "Audit log of every share, every evaluation, every policy override",
        ]}
        signature="— DPDP right-to-erasure on every tenant, no back-office exceptions."
      />
    </section>
  );
}

function AudienceBand({
  id,
  tone,
  number,
  label,
  headline,
  bullets,
  signature,
}: {
  id: string;
  tone: "ink" | "parchment";
  number: string;
  label: string;
  headline: string;
  bullets: string[];
  signature: string;
}): JSX.Element {
  const isInk = tone === "ink";
  return (
    <div
      id={id}
      className={
        isInk
          ? "relative border-t border-ink-line bg-ink text-parchment"
          : "relative border-t border-ink-line bg-parchment text-ink"
      }
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-8 px-6 py-28 lg:px-8 lg:py-36">
        <div className="col-span-12 lg:col-span-5">
          <div className="flex items-center gap-4">
            <span className="label-mono text-saffron">{number}</span>
            <span
              className={`h-px w-8 ${isInk ? "bg-ink-line" : "bg-parchment-line"}`}
              aria-hidden
            />
            <span
              className={`label-mono ${isInk ? "text-fog" : "text-mute-cream"}`}
            >
              {label}
            </span>
          </div>
          <h2
            className={`mt-8 font-display text-display-lg ${isInk ? "text-parchment" : "text-ink"}`}
          >
            {headline}
          </h2>
        </div>

        <ul className="col-span-12 flex flex-col lg:col-span-7">
          {bullets.map((b, i) => (
            <li
              key={i}
              className={`flex gap-6 border-t py-5 text-body-lg ${
                isInk
                  ? "border-ink-line text-parchment/90"
                  : "border-parchment-line text-ink/90"
              } ${i === bullets.length - 1 ? "border-b" : ""}`}
            >
              <span className={`label-mono pt-1 ${isInk ? "text-fog" : "text-mute-cream"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <p
          className={`col-span-12 label-mono ${isInk ? "text-fog" : "text-mute-cream"}`}
        >
          {signature}
        </p>
      </div>
    </div>
  );
}

/* ============================ CLOSING CTA =============================== */

function ClosingCTA(): JSX.Element {
  return (
    <section className="relative z-10 spotlight-top border-t border-ink-line bg-ink">
      <div className="mx-auto max-w-[1280px] px-6 py-32 lg:px-8 lg:py-40">
        <div className="mx-auto max-w-4xl text-center">
          <EyebrowLabel number="06" text="THE PILOT" />
          <h2 className="mx-auto mt-8 font-display text-display-xl text-parchment">
            Start with one branch.
            <br />
            Scale to <span className="italic text-saffron-bright">five thousand</span> agents.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-body-lg text-fog">
            Four-week pilot, one tenant, one cohort of field agents. Zero integrations required on
            day one. Full tenant isolation, DPDP-compliant, regional language ready.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/sign-up"
              className="group inline-flex items-center gap-3 bg-saffron px-8 py-4 text-body-sm font-semibold text-ink transition-all hover:bg-saffron-bright"
            >
              Start a pilot
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a
              href="mailto:tripathiyatharth257@gmail.com?subject=SalesContent%20AI%20pilot"
              className="inline-flex items-center gap-3 border border-ink-line px-8 py-4 text-body-sm font-medium text-parchment transition-all hover:border-parchment/40 hover:bg-ink-raised"
            >
              Talk to the founder
            </a>
          </div>
          <p className="mt-10 label-mono text-fog-dim">
            * Pilot pricing: ₹0 until production rollout · Typical rollout: 4–6 weeks
          </p>
        </div>
      </div>
    </section>
  );
}

/* =============================== FOOTER ================================ */

function SiteFooter(): JSX.Element {
  return (
    <footer className="relative z-10 border-t border-ink-line bg-ink-deep">
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div className="flex flex-col leading-none">
                <span className="font-display text-[1.2rem]">SalesContent</span>
                <span className="label-mono mt-1 text-fog">AARAMBH LABS</span>
              </div>
            </div>
            <p className="mt-6 max-w-xs text-body-sm text-fog">
              AI-native sales enablement, built for Indian field teams — in the languages and
              channels they already sell in.
            </p>
          </div>

          <FooterCol
            heading="PRODUCT"
            links={[
              { label: "Modules", href: "#modules" },
              { label: "For field", href: "#field" },
              { label: "For managers", href: "#managers" },
              { label: "Compliance", href: "#compliance" },
            ]}
          />
          <FooterCol
            heading="COMPANY"
            links={[
              { label: "Aarambh Labs", href: "#" },
              { label: "Pilot enquiries", href: "mailto:tripathiyatharth257@gmail.com" },
              { label: "Changelog", href: "/FRONTEND_CHANGES.md" },
            ]}
          />
          <FooterCol
            heading="LEGAL"
            links={[
              { label: "Privacy (DPDP)", href: "#" },
              { label: "Terms", href: "#" },
              { label: "Security", href: "/SECURITY.md" },
              { label: "Data residency · IN", href: "#" },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col justify-between gap-4 border-t border-ink-line pt-6 md:flex-row md:items-center">
          <p className="label-mono text-fog-dim">
            © {new Date().getFullYear()} AARAMBH LABS · ALL RIGHTS RESERVED · MADE IN इंडिया
          </p>
          <p className="label-mono text-fog-dim">
            BUILT WITH CLAUDE · CACHED · AUDITED
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: Array<{ label: string; href: string }>;
}): JSX.Element {
  return (
    <div>
      <h4 className="label-mono text-fog">{heading}</h4>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-body-sm text-parchment/80 transition-colors hover:text-saffron"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
