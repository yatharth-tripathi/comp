# CLAUDE.md — Agent Context & Working Contract

> **Every agent (frontend, backend, QA, devops) reads this file first.**
> This is the single source of truth for scope, role boundaries, aesthetic DNA, and handoff rules.
> If something is not written here, write it here before making assumptions.

---

## 1. Project — SalesContent AI

**Company:** Aarambh Labs
**Owner:** Yathu (Yatharth Tripathi) — product lead, solo founder
**PRD:** `SalesContent AI v1.0` — April 2026, 44 pages

**What it is:** Multi-tenant SaaS for Indian BFSI, Insurance, Pharma, Automotive, and Consumer Durables field sales teams. WhatsApp-first. Mobile-first. Hindi + regional-language ready. Compliance-aware (SEBI / IRDAI / RBI).

**Positioning:** Mid-market alternative to Sharpsell.ai. Sharpsell serves 550k agents across 150+ enterprises but is enterprise-only and expensive. The wedge is the 50–5000-agent mid-market who want WhatsApp-native workflows, regional languages, and 50–70% lower pricing.

**Who it serves:**
- **Field agents** — consume content, run role-plays, share on WhatsApp, log leads
- **Sales managers** — assign learning journeys, track performance, review coaching
- **L&D / Compliance** — author content, audit adherence, regulatory review
- **CROs / Buyers** — dashboards, ROI, deal velocity

---

## 2. Repo state — as of 2026-04-15

**Root:** `/Users/yatharth/projects/game-project/comp/`
**Repo on GitHub:** https://github.com/yatharth-tripathi/comp
**Status:** Phase 1 foundation + 12 feature sessions shipped across ~213 files, ~27,500 LOC, 11 commits on `main`. All 18 PRD modules have working shells. Zero placeholders / mocks per project rule.

### Workspace layout

```
comp/
├── apps/
│   ├── web/                        # Next.js 14 App Router — Vercel target
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)          # Custom email+password sign-in / sign-up
│   │   │   │   ├── (dashboard)     # Authed product surfaces
│   │   │   │   ├── (immersive)     # Role-play runner + full-screen modes
│   │   │   │   ├── (onboarding)    # Wizard for new tenants
│   │   │   │   ├── (public)/       # Shortlink viewers /i/[code] /s/[code]
│   │   │   │   ├── offline/        # PWA offline fallback
│   │   │   │   ├── globals.css     # Design tokens — OWNED BY FRONTEND
│   │   │   │   ├── layout.tsx      # Root layout, fonts, providers
│   │   │   │   └── page.tsx        # Landing / root
│   │   │   ├── components/
│   │   │   │   ├── ui/             # Primitives: button, card, input, etc. (shadcn-seeded)
│   │   │   │   ├── admin/ copilot/ illustrations/ leads/ manager/ onboarding/ reels/ role-play/ whatsapp/
│   │   │   │   ├── theme-provider.tsx  query-provider.tsx  sw-register.tsx
│   │   │   ├── hooks/  lib/  middleware/  middleware.ts
│   │   ├── tailwind.config.ts      # OWNED BY FRONTEND
│   │   ├── next.config.mjs
│   │   └── public/                 # manifest.webmanifest, sw.js
│   └── api/                        # Hono on Node 20 — Railway target
│       └── src/
│           ├── index.ts
│           ├── middleware/         # context, auth, rate-limit, audit, error-handler
│           ├── routes/             # health, auth, tenants, users + module routes
│           └── lib/                # env, logger, errors, redis, types
├── packages/
│   ├── db/                         # Drizzle schema + Neon client
│   │   └── src/schema/             # ~15 files covering every PRD table
│   ├── schemas/                    # Shared Zod contracts (api + web)
│   ├── finance/                    # Isomorphic finance math for PitchWiz illustrators
│   ├── nexus/                      # Ported SEBI/IRDAI/RBI regulatory knowledge graph
│   ├── role-play-scenarios/        # ~18 hand-authored scenarios, 15+ exchange ladders
│   └── config/
├── memory/
│   └── session-memory/
│       ├── STATE.md                # Living index across all sessions — READ FIRST when resuming
│       └── YYYY-MM-DD_session_NN_*.md  # Dated session logs
├── .env.example                    # Every env var contract
├── pnpm-workspace.yaml  tsconfig.base.json  package.json
├── README.md                       # Setup / deploy instructions for humans
├── CLAUDE.md                       # THIS FILE — agent contract
├── FRONTEND_CHANGES.md             # Frontend agent changelog
└── SECURITY.md                     # VAPT / DPDP hardening notes
```

### Tech stack — non-negotiable (PRD §3.2)

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript strict, Tailwind v3, shadcn/ui primitives, Zustand, TanStack Query, Framer Motion |
| Backend | Hono on Node 20, TypeScript strict |
| Database | Neon Postgres + Drizzle ORM (Mumbai region for data residency) |
| Auth | Email + password, bcrypt hashing, HS256 JWT session cookie (multi-tenant; tenant per signup) |
| Cache / Queue | Upstash Redis + Ratelimit; Upstash QStash |
| Storage | Cloudflare R2 |
| Video | Mux (direct uploads, playback ids, webhooks) |
| Search | Typesense Cloud |
| AI | Anthropic Claude Sonnet 4.5 (default), Haiku 4.5 (fast path) |
| WhatsApp | Meta Cloud API (Business App) |
| Deploy | Vercel (web) + Railway (api) |
| Observability | Sentry + PostHog |

### Current module status (all shells exist, polish pending)

Auth + Tenancy · User mgmt · Onboarding · Content Library · Reels · PitchWiz (4 illustrators) · Role-Play + Show Me · AI Copilot · Learning Journeys · Lead Management · WhatsApp Integration · Manager Dashboard · Public REST API · PWA · Admin Panel · Security/DPDP/VAPT

---

## 3. Agents operating in this repo

Yathu orchestrates multiple specialist agents against this codebase. Each agent has a narrow lane. **Stay in your lane. Log handoffs in this file.**

### 3.1 Frontend agent — owns visual / UX layer
**Lane:** Everything a user sees or touches in `apps/web/src/`.
- `apps/web/src/app/` — pages, layouts, route groups
- `apps/web/src/components/` — UI primitives and feature components
- `apps/web/src/hooks/`, `apps/web/src/lib/` (client-side utilities only)
- `apps/web/src/app/globals.css` — design tokens
- `apps/web/tailwind.config.ts`
- Fonts, motion, imagery, microcopy (user-visible text)

**Does NOT touch:** `apps/api/**`, `packages/db/**` schema, `packages/schemas/**` (shared Zod — coordinate before editing), env vars, middleware auth logic, service worker logic.

**Changelog:** All changes go in `FRONTEND_CHANGES.md` (this repo root). Entry per surface with date, aesthetic decisions, files, before/after.

### 3.2 Backend agent — owns server / data / API layer
**Lane:** Everything under `apps/api/src/` and `packages/db/src/`.
- Hono routes, middleware, services
- Drizzle schema, migrations, queries
- Shared Zod schemas in `packages/schemas/` (coordinate if frontend also changes the shape)
- Env var contracts in `.env.example`
- Webhook handlers (Mux, QStash, WhatsApp, Meta)
- Rate limits, audit logs, Claude prompt caching
- DPDP compliance, row-level tenant isolation

**Does NOT touch:** `apps/web/**` (except shared Zod contracts with explicit handshake), visual design decisions.

**Changelog:** Should create `BACKEND_CHANGES.md` at repo root on first session, same format as frontend.

### 3.3 Shared contract: `packages/schemas/`
Both agents read from here. If either needs to change a schema:
1. Announce the shape change in your changelog
2. Update `packages/schemas/` together with the consuming code
3. Run `pnpm typecheck` across the whole workspace before declaring done

### 3.4 How to hand off work
When a frontend change requires a backend endpoint (or vice versa):
1. Write the request in the changelog under a `## Handoff requests` heading: endpoint name, method, expected request/response shape (point to Zod schema), priority
2. The other agent picks it up on next session, implements, logs under `## Handoffs delivered`
3. Frontend consumes via `apps/web/src/lib/api-client.ts`

---

## 4. Project rules — apply to every agent

1. **No mock data. No placeholders. No TODOs.** Every line does the real thing or does not exist.
2. **Every mutation writes an audit log.** Backend uses `c.var.audit(...)`.
3. **Every tenant query filters by `tenantId`.** Enforced at query layer.
4. **Every Claude call is cached.** NEXUS regulatory block (~5k tokens) uses Anthropic prompt caching.
5. **No routes without Zod validation.** Use `@hono/zod-validator` + shared `packages/schemas`.
6. **No secrets in code.** All env access goes through `apps/api/src/lib/env.ts` (validated at startup).
7. **Typecheck before claiming done.** `pnpm typecheck` at repo root, zero errors.
8. **Commit small, descriptive.** Present tense. Reference the module. Co-author line not required.

---

## 5. Aesthetic DNA — owned by frontend agent

> This section is normative. Every new surface inherits this. Deviations require a changelog entry with justification.

### 5.1 Conceptual direction — "Precision Instrument"
Editorial-serious meets instrument-panel precise. This is software for regulated financial sales in India — it must feel trustworthy to a 55-year-old bank CRO *and* modern to a 28-year-old field agent. Not another shadcn dashboard. Not a playful startup. Think: the front page of a financial newspaper rendered for software. Controlled density. Hairline rules. Numerals that matter.

### 5.2 Palette
```
--ink          #0A0E1A   base dark surface
--ink-raised   #11162A   elevated cards on dark
--ink-line     #1E2438   hairline borders on dark
--parchment    #F5F0E6   contrast surface (cream, not white)
--parchment-2  #ECE4D4   subdued parchment
--saffron      #E8923C   single precision accent (not orange — molten saffron)
--saffron-mute #B8682A   hover / pressed saffron
--signal       #6DDFA7   positive data
--signal-mute  #2F8A63   secondary positive
--ember        #E86A5C   negative / destructive
--fog          #8B92A6   secondary text on dark
--mute-cream   #6B6256   secondary text on parchment
```

Dominant: ink base. Supporting: parchment as contrast surface. Accent: saffron ONLY on interactive primary or editorial emphasis. Signal/ember only on data, never chrome.

### 5.3 Typography
- **Display — `Instrument Serif`** (Google Fonts, variable). High-contrast serif with real personality. Used for H1/H2, section numbers, editorial emphasis. NEVER on body text or UI controls.
- **Body — `Manrope`** (Google Fonts, variable). Geometric humanist sans, underused, quietly distinctive. All body copy, nav, buttons, form fields.
- **Numeric / labels — `JetBrains Mono`** (Google Fonts). For metrics, data tables, timestamps, section counters (01 / 02), keyboard-style labels. Tabular numerals.
- **NEVER use:** Inter, Roboto, Arial, system-ui defaults, Space Grotesk, Geist.

Type scale:
```
display-xl  72px / 1.02 / -0.03em    Instrument Serif weight 400
display-lg  56px / 1.05 / -0.02em    Instrument Serif weight 400
display-md  40px / 1.1  / -0.02em    Instrument Serif weight 400
heading-lg  28px / 1.2  / -0.01em    Manrope weight 600
heading-md  20px / 1.3  / -0.005em   Manrope weight 600
body-lg     18px / 1.6  /  0         Manrope weight 400
body        16px / 1.6  /  0         Manrope weight 400
body-sm     14px / 1.55 /  0         Manrope weight 500
label       11px / 1    /  0.18em    JetBrains Mono weight 500 UPPERCASE
number      (context)                JetBrains Mono tabular-nums
```

### 5.4 Motion
- One orchestrated page-load reveal per route (staggered, ≤ 600ms total)
- Hover states only on interactive elements (links, buttons, cards-with-links)
- No ambient / infinite animations (this is sober B2B, not consumer)
- Motion library: Framer Motion (already installed). Ease curve: `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutExpo-ish).
- Respect `prefers-reduced-motion` — disable staggers, keep opacity.

### 5.5 Spatial grammar
- 12-column grid with intentional asymmetry — never centered-everything
- Section anchors marked with `NN / section-name` in JetBrains Mono label, left-aligned
- Hairline horizontal rules (1px `--ink-line` / 1px `--parchment-2`) as visual chapters
- Generous vertical rhythm on landing; controlled density on dashboards
- Max content width: 1280px. Hero can bleed to viewport.

### 5.6 Texture & details
- **Grain:** 1.5% opacity SVG noise overlay on dark surfaces (fixed position, pointer-events-none)
- **Gradient glow:** Single radial gradient from top-center on hero (saffron → transparent, 8% opacity)
- **Corner markers:** Tiny ◦ or + glyphs at card corners on key surfaces
- **Devanagari quiet mark:** `सेल्स` or `विश्वास` (trust) as a low-opacity watermark at 4% on hero — ties identity to India without being kitschy
- **Focus ring:** Saffron 2px with 2px offset, always visible

### 5.7 What is banned
- Purple-to-pink gradients on white
- Generic 3-column feature card grids with lucide icons at the top
- Glassmorphism (frosted cards over gradient blobs)
- Inter / Roboto / system-ui
- Rounded-2xl everywhere
- "AI" as purple/blue glow
- Emoji in UI chrome
- Any centered hero with a pill-shaped badge saying "NEW ✨"

---

## 6. Working cadence & memory

### 6.1 Every session
1. Read this file (CLAUDE.md)
2. Read `memory/session-memory/STATE.md` for live project state
3. Read the most recent dated session file if resuming a thread
4. Read your own changelog (`FRONTEND_CHANGES.md` or `BACKEND_CHANGES.md`)
5. Do the work, **stay in your lane**
6. Update your changelog with a dated entry
7. Update `memory/session-memory/STATE.md` (Last touched, Current focus, Next action)
8. Write a new `memory/session-memory/YYYY-MM-DD_session_NN_*.md` for the session

### 6.2 Typecheck before done
```bash
# from comp/ root
pnpm typecheck        # all workspaces
pnpm --filter @salescontent/web typecheck   # frontend only
pnpm --filter @salescontent/api typecheck   # backend only
```

### 6.3 Dev servers
```bash
pnpm dev              # both
pnpm dev:web          # web only → http://localhost:3000
pnpm dev:api          # api only → http://localhost:8787
```

---

## 7. Open decisions / flags

- **Meta WhatsApp Business App approval** — 1–3 weeks; Session 09 blocks on it
- **Pilot pipeline** — 3 warm BFSI leads needed by Week 4 per critical-path.md
- **Claude cost ceiling** — per-tenant daily USD cap enforced in `apps/api/src/services/claude.ts`; watch prompt-cache hit rate weekly

---

## 8. Contact / ownership
- Product lead: Yathu (tripathiyatharth257@gmail.com)
- All agent work happens against this repo. No forking. No side-branches without Yathu's approval.

---

*Last revised 2026-04-15 by the frontend agent during landing page rebuild. Backend agent: extend §3.2 with any boundaries I missed when you pick up the lane.*
