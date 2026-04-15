# Backend Changelog

> Backend agent's session log. Format mirrors `FRONTEND_CHANGES.md`.
> Entry per surface with date, rationale, files, before/after.

---

## 2026-04-16 — Replace Clerk auth with self-hosted email + password

### Why
Yathu requested removing Clerk and doing "normal email and password login saving in db." This overrides the PRD §3.2 stack decision (Clerk was picked for multi-tenant orgs + phone OTP for India). Confirmed before ripping it out. Password reset and email verification are explicitly out of scope for v1 — no stub endpoints.

### Architecture
- **API is stateless.** Only accepts `Authorization: Bearer <jwt>` — never sets cookies, never reads cookies. Keeps dev cross-origin (web:3000 ↔ api:8787) simple.
- **Web owns the session cookie.** `sc_session` is HttpOnly, SameSite=Lax, cookie on the web origin. Written by `/api/auth/login` and `/api/auth/signup` route handlers after proxying to the API.
- **Server components** read the cookie via `getServerSession()` / `getServerSessionToken()` and forward as Bearer to the API — matches the prior Clerk pattern.
- **Client components** preserve their existing `getToken()` call sites. The new `useAuth()` hook from `@/lib/auth-client` fetches the token from same-origin `/api/auth/token`, which reads the HttpOnly cookie server-side.
- **Password hashing:** bcrypt, default 12 rounds (tunable via `BCRYPT_ROUNDS`).
- **JWT:** HS256 via `jose`. Payload: `{ userId, tenantId, role }`. Default TTL 7d.
- **Multi-tenancy preserved.** Sign-up provisions both a new `tenants` row AND the first `users` row (role `enterprise_admin`). Tenant slug is derived from company name, collision-suffixed.

### DB schema changes (packages/db/src/schema)
- `tenants.clerkOrgId` dropped (column + `tenants_clerk_org_unique` index)
- `users.clerkUserId` dropped (column + `users_tenant_clerk_unique` index)
- `users.email` now `notNull()`; new unique index `users_tenant_email_unique (tenant_id, email)`
- `users.passwordHash` added `notNull()`

**Migration:** run `pnpm --filter @salescontent/db generate` then `pnpm --filter @salescontent/db migrate`. Destructive against any existing seed data since Clerk-backed rows have no password hash — for a fresh database this is trivial; for anything non-empty, back up first and re-seed through /auth/signup.

### Env contract (`.env.example`)
- **Removed:** every `CLERK_*`, every `NEXT_PUBLIC_CLERK_*`
- **Added:** `JWT_SECRET` (≥32 chars, required on *both* api and web), `JWT_EXPIRES_IN_SECONDS` (default 604800), `BCRYPT_ROUNDS` (default 12)

### New code
- `apps/api/src/lib/session.ts` — `issueSessionToken`, `verifySessionToken`, `hashPassword`, `verifyPassword`
- `apps/api/src/routes/auth.ts` — `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Signup provisions tenant + settings + user + xp in ordered inserts (Neon HTTP driver has no multi-statement tx, so failed user insert rolls back the tenant by hand).
- `apps/web/src/lib/session.ts` — `getServerSession`, `getServerSessionToken` (reads `sc_session` cookie)
- `apps/web/src/lib/auth-client.ts` — client-side `useAuth()`, `useSessionUser()`, `signOut()`
- `apps/web/src/app/api/auth/{login,signup,logout,me,token}/route.ts` — cookie-managing web proxies
- `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` + `SignInForm`
- `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` + `SignUpForm`
- `apps/web/src/components/auth/user-menu.tsx` — header sign-out button
- `packages/schemas/src/auth.ts` — shared `signUpSchema`, `loginSchema`, `authResponseSchema`

### Removed code
- `apps/api/src/routes/clerk-webhook.ts`
- `apps/web/src/app/(onboarding)/select-org/*` (Clerk `CreateOrganization` was the tenant-picker; tenant is now picked at signup)
- `@clerk/backend` from `apps/api/package.json`, `@clerk/nextjs` from `apps/web/package.json`, `svix` from api (only used by Clerk webhook)

### Rewrote
- `apps/api/src/middleware/auth.ts` — HS256 JWT verify + local user/tenant load. `c.var.clerkUserId` removed from the ContextVariableMap.
- `apps/api/src/routes/onboarding.ts` — now uses `authMiddleware` (tenant + user already exist post-signup). Just finalises the user profile + optional branch.
- `apps/api/src/routes/users.ts` `POST /users/invite` — requires `initialPassword` in the body; hashes with bcrypt. Admin communicates the temp password out-of-band.
- `apps/api/src/routes/admin.ts` bulk-import — same treatment. `inviteUserSchema` in `packages/schemas/src/user.ts` now requires `email` + `initialPassword`.
- `apps/api/src/routes/tenants.ts` — `POST /tenants` manual bootstrap no longer writes `clerkOrgId`.
- `apps/web/src/middleware.ts` — `jwtVerify` against `sc_session` cookie; redirects to `/sign-in?return_to=…` on miss.
- `apps/web/src/app/layout.tsx` — `<ClerkProvider>` removed.
- `apps/web/src/app/page.tsx`, `(dashboard)/layout.tsx`, `(immersive)/layout.tsx` — `auth()` → `getServerSession()`.
- `apps/web/src/components/onboarding-wizard.tsx` — drops `useOrganization`/`useUser`; prefills firstName/lastName from `/api/auth/me` hit. Wizard is 2 steps now (profile + work) instead of 3 (the company step moved into signup).
- 14 client components (`content-upload-form`, `copilot-chat`, `role-play/runner`, `whatsapp-dashboard`, `leads/*`, `reels/*`, `admin-panel-view`, `illustrations/*`) — import `useAuth` from `@/lib/auth-client` instead of `@clerk/nextjs`. Same `getToken()` signature, zero behavioural change.
- `apps/web/next.config.mjs` — dropped `img.clerk.com` from image remote patterns.

### Docs
- `CLAUDE.md` — stack table updated, path notes updated, removed `Clerk` from webhook-handlers list.
- `SECURITY.md` — auth row, auth/authz table, OWASP API2 + API10 entries, secret-rotation table all updated.
- `README.md` — provisioning step 2 is now a single `openssl rand` instead of 8 Clerk-dashboard steps; stack table + webhook list updated.

### Not in scope (explicit)
- Password reset flow (no email sender configured)
- Email verification at signup
- Phone/OTP login
- Social login (Google, etc.)
- Session revocation list (stateless JWTs — rotate `JWT_SECRET` to invalidate every session)

### Validation
Source edits only. Dependencies listed in `package.json` but not yet installed — Yathu should run `pnpm install` then `pnpm typecheck` at the repo root before booting dev. Migration also needs to be generated + applied.
