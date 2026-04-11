# SalesContent AI

AI-powered sales enablement and content distribution platform for Indian BFSI, Insurance, Pharma, and Automotive field sales teams. Multi-tenant SaaS. Mobile-first. WhatsApp-native.

Repo: https://github.com/yatharth-tripathi/comp

## Status

This is **Phase 1: Foundation**. The monorepo, database schema, API skeleton, and frontend shell are production-ready. Feature modules ship one per session on the plan below.

Session | Module | Status
---|---|---
**02** (current) | Monorepo + Drizzle schema + Hono API skeleton + Next.js shell + Auth + Tenancy | ✅ done
03 | Content Library — upload, tagging, personalization, WhatsApp sharing | next
04 | Reels — Mux pipeline, feed, mandatory training | pending
05 | PitchWiz — term plan, health, SIP, home loan illustrators | pending
06 | Learning — journeys, quizzes, role-play engine | pending
07 | AI Copilot — pre/during/post meeting modes | pending
08 | Lead Management | pending
09 | WhatsApp bot — 5 intents | pending
10 | Manager dashboards + content analytics | pending
11 | Public REST API + PWA + offline | pending
12 | Security hardening + audit logs + rate limits + VAPT prep | pending

See `memory/session-memory/STATE.md` and `memory/session-memory/critical-path.md` at the monorepo root for the detailed plan.

## Architecture

```
comp/
├── apps/
│   ├── web/                      # Next.js 14 App Router frontend (Vercel)
│   │   └── src/
│   │       ├── app/              # routes: landing, auth, dashboard
│   │       ├── components/       # theme + query providers (shadcn added per session)
│   │       ├── lib/              # cn, api-client
│   │       └── middleware.ts     # Clerk auth + tenant subdomain routing
│   └── api/                      # Hono backend (Railway)
│       └── src/
│           ├── index.ts          # app bootstrap
│           ├── middleware/       # context, auth, rate-limit, audit, error-handler
│           ├── routes/           # health, tenants, users, clerk-webhook
│           └── lib/              # env, logger, errors, redis, types
├── packages/
│   ├── db/                       # Drizzle schema + Neon client
│   │   └── src/schema/           # 15 files covering every PRD table
│   └── schemas/                  # Shared Zod contracts used by api + web
├── .env.example                  # Every env var contract, documented
├── pnpm-workspace.yaml
└── tsconfig.base.json            # Strict TypeScript base config
```

### Tech stack — non-negotiable per the PRD

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Zustand, TanStack Query | PRD §3.2 |
| Backend | Hono on Node 20, TypeScript | PRD §3.2 |
| Database | Neon Postgres + Drizzle ORM | PRD §3.2 |
| Auth | Clerk (multi-tenant orgs, phone OTP for India) | PRD §3.2 |
| Cache | Upstash Redis + Upstash Ratelimit | PRD §3.2 |
| Queue | Upstash QStash | PRD §3.2 |
| Storage | Cloudflare R2 | PRD §3.2 |
| Video | Mux (direct uploads, playback ids, webhooks) | PRD §3.2 |
| Search | Typesense Cloud | PRD §3.2 |
| AI | Anthropic Claude Sonnet 4.5 (default), Haiku 4.5 (fast path) | PRD §3.2 |
| WhatsApp | Meta Cloud API (Business App) | PRD §3.2 |
| Deploy | Vercel (frontend) + Railway (backend) | PRD §3.2 |
| Observability | Sentry + PostHog | PRD §3.2 |

---

## Prerequisites

- Node.js ≥ 20.11
- pnpm ≥ 9 (`npm install -g pnpm`)
- Git
- The service accounts listed in [Provision services](#provision-services) below

---

## Provision services

> ⚠ Meta WhatsApp Business App approval takes 1–3 weeks. **Start that one today** — everything else is needed first-day.

### 1. Neon Postgres — 2 min

1. Create an account at https://neon.tech
2. Create a new project named `salescontent-ai` in the **ap-south-1 (Mumbai)** region (data residency — PRD §13.3)
3. Copy the connection string (select "Pooled connection" for serverless)
4. Set `DATABASE_URL` in `.env`

### 2. Clerk — 5 min

1. Sign up at https://dashboard.clerk.com
2. Create a new application
3. **Enable** Email + Phone (SMS OTP) + Google auth providers
4. **Enable** Organizations in Settings → Organization settings
5. Copy `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (use the test keys until you're ready to go live)
6. Create a webhook endpoint: `https://your-api.railway.app/webhooks/clerk` — subscribe to `organization.created`, `organization.updated`, `organization.deleted`, `organizationMembership.created`, `organizationMembership.deleted`, `user.created`, `user.updated`
7. Copy the signing secret into `CLERK_WEBHOOK_SECRET`
8. Set both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_PUBLISHABLE_KEY` to the same value

### 3. Anthropic — 1 min

1. https://console.anthropic.com → API Keys → Create
2. Set `ANTHROPIC_API_KEY`
3. (Optional) Set a team-level budget limit in Anthropic's billing settings as a safety net

### 4. Upstash Redis + QStash — 3 min

1. https://console.upstash.com → Create a Redis database in **Mumbai** (or fall back to Singapore if Mumbai is unavailable)
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Create a QStash account (same console) — copy `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

### 5. Cloudflare R2 — 5 min

1. https://dash.cloudflare.com → R2 → Create bucket `salescontent-media`
2. Enable "Public access" and bind a custom domain like `media.salescontent.ai` (CNAME in Cloudflare DNS)
3. Manage R2 API Tokens → Create token with Object Read + Write on the bucket
4. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`

### 6. Mux — 3 min

1. https://dashboard.mux.com → Settings → Access Tokens → Create
2. Give it Video permissions (Read + Write)
3. Set `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`
4. Settings → Webhooks → Create endpoint at `https://your-api.railway.app/webhooks/mux`
5. Copy the signing secret into `MUX_WEBHOOK_SECRET`

### 7. Typesense Cloud — 3 min

1. https://cloud.typesense.org → Create cluster, Singapore or Mumbai region
2. Copy host, port, protocol, admin key, search-only key into the corresponding env vars

### 8. Meta WhatsApp Business Cloud API — start now, wait 1–3 weeks

1. https://business.facebook.com → create a Business Account
2. https://developers.facebook.com → create a Business App → add WhatsApp product
3. Add a test phone number (works immediately for dev) AND register a real Indian business number (requires Meta review + business verification)
4. Generate a permanent system-user access token — save as `WHATSAPP_ACCESS_TOKEN`
5. Copy `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID` from the WhatsApp → API Setup page
6. Pick a random 32-char string for `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and set it in both `.env` and the webhook config on Meta
7. Copy the App Secret from App Settings → Basic into `WHATSAPP_APP_SECRET`
8. Submit the app for review as soon as you have a privacy policy URL and production business number. Review takes 1–3 weeks.

### 9. Sentry + PostHog (optional but recommended)

Cheap, free tiers, no hard blocker. Set `SENTRY_DSN` and `POSTHOG_API_KEY` when ready.

---

## Local setup

```bash
# 1. Clone
git clone https://github.com/yatharth-tripathi/comp.git
cd comp

# 2. Install
pnpm install

# 3. Configure env
cp .env.example .env
# edit .env and fill in every REQUIRED value above

# 4. Generate and push database schema to Neon
pnpm db:generate   # writes packages/db/drizzle/*.sql
pnpm db:push       # applies to DATABASE_URL

# 5. (Optional) Open Drizzle Studio to inspect
pnpm db:studio     # opens on https://local.drizzle.studio

# 6. Typecheck everything
pnpm typecheck

# 7. Run both apps in parallel
pnpm dev
# → api  at  http://localhost:8787
# → web  at  http://localhost:3000
```

### Running just one app

```bash
pnpm dev:api       # Hono backend only
pnpm dev:web       # Next.js frontend only
```

### Sanity checks

```bash
# The API should answer
curl http://localhost:8787/health
curl http://localhost:8787/health/deep   # hits DB + Redis
```

---

## Scripts — root

| Command | What it does |
|---|---|
| `pnpm dev` | Run web + api in parallel |
| `pnpm dev:web` | Run Next.js frontend only |
| `pnpm dev:api` | Run Hono backend only |
| `pnpm build` | Build both apps |
| `pnpm typecheck` | Recursive `tsc --noEmit` across every workspace |
| `pnpm lint` | Recursive lint |
| `pnpm db:generate` | Drizzle Kit: generate SQL migrations from `packages/db/src/schema/*` |
| `pnpm db:push` | Drizzle Kit: push schema directly (dev only) |
| `pnpm db:migrate` | Apply generated migrations (prod-safe) |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm clean` | Nuke node_modules, .next, dist, .turbo |

---

## Deployment

### Backend → Railway

1. https://railway.app → New Project → Deploy from GitHub repo
2. Pick the `apps/api` subdirectory
3. Build command: `pnpm install && pnpm --filter @salescontent/api build`
4. Start command: `pnpm --filter @salescontent/api start`
5. Add all environment variables from `.env.example`
6. Attach a custom domain (e.g. `api.salescontent.ai`) once ready

### Frontend → Vercel

1. https://vercel.com → Import Project from GitHub
2. Pick the `apps/web` root
3. Build command: `pnpm install --no-frozen-lockfile && pnpm --filter @salescontent/web build`
4. Output: `.next`
5. Add the public env vars (`NEXT_PUBLIC_*`, `NEXT_PUBLIC_API_URL` → your Railway URL)
6. Add a custom domain like `app.salescontent.ai`

### Webhook endpoints to register after deploy

| Service | URL |
|---|---|
| Clerk | `https://<api domain>/webhooks/clerk` |
| Mux | `https://<api domain>/webhooks/mux` |
| Meta WhatsApp | `https://<api domain>/webhooks/whatsapp` |
| QStash | `https://<api domain>/webhooks/qstash` (for background jobs) |

---

## Project rules

1. **No mock data. No placeholders. No TODOs.** Every line you add should do the real thing or not exist.
2. **Every mutation writes an audit log.** Use `c.var.audit(...)` from any authed route.
3. **Every tenant query filters by `tenantId`.** Row-level security via Drizzle `where` clauses is enforced in the query layer; do not bypass.
4. **Every Claude call is cached.** The NEXUS regulatory prompt block (~5k tokens) uses Anthropic prompt caching. Check hit rate weekly.
5. **No routes without Zod validation.** Use `@hono/zod-validator` with a shared schema from `packages/schemas`.
6. **No secrets in code.** Everything goes through `env()` in `apps/api/src/lib/env.ts`, which validates at startup and fails loud if anything is missing.

---

## License

Proprietary © Aarambh Labs. Confidential.
