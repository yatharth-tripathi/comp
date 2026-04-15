# SalesContent AI — Security Posture

> Document for internal review and VAPT vendor handoff.

## Architecture overview

- **Frontend:** Next.js 14 on Vercel (edge network, auto-TLS)
- **Backend:** Hono on Railway (Node.js 20, container isolation)
- **Database:** Neon Postgres (serverless, encrypted at rest, TLS in transit)
- **Cache:** Upstash Redis (encrypted, TLS)
- **Storage:** Cloudflare R2 (encrypted at rest, TLS in transit)
- **Auth:** Self-hosted email + password — bcrypt password hashing (12 rounds default), HS256 JWT sessions, HttpOnly cookies on the web, `Authorization: Bearer` on the API
- **AI:** Anthropic Claude (SOC2 Type II, no training on API data)

## Authentication & authorization

| Layer | Mechanism |
|---|---|
| Web frontend | Next.js middleware — verifies the HS256 JWT from the HttpOnly `sc_session` cookie on every non-public route via `jose` |
| API (internal) | HS256 JWT verification via `jose` + tenant + user lookup (userId, tenantId, role claims) |
| API (public) | SHA-256 hashed API key lookup in `api_keys` table |
| Webhooks | Per-service signature verification (Mux=HMAC-SHA256, WhatsApp=HMAC-SHA256) |
| RBAC | 7-level role hierarchy: super_admin > enterprise_admin > content_manager > branch_manager > senior_agent > sales_agent > trainee |
| Rate limiting | Upstash Ratelimit sliding window — global 120/min + per-route overrides (Copilot 40/min, Show Me 6/min) |

## Data protection

| Control | Implementation |
|---|---|
| Encryption at rest | Neon (AES-256), R2 (AES-256), Upstash (AES-256) |
| Encryption in transit | TLS 1.3 minimum on all connections |
| Tenant isolation | Every query filters by `tenant_id`. No cross-tenant data access possible. |
| Input validation | Every route uses `@hono/zod-validator` with strict schemas from `@salescontent/schemas` |
| SQL injection | Impossible — all queries via Drizzle ORM parameterized builder. Zero raw SQL. |
| XSS prevention | React auto-escapes by default. CSP headers in Next.js. No `dangerouslySetInnerHTML`. |
| CSRF | API uses Bearer tokens (not cookies for auth). CORS restricted to allowed origins. |
| Secret management | All secrets in environment variables, validated at startup via Zod. Never logged (pino redacts auth headers). |
| Audit logging | Every mutation writes to `audit_logs` table with actor, resource, action, IP, user agent, request ID. |
| Data residency | Neon database in `ap-south-1` (Mumbai). R2 in Cloudflare India PoP. |

## DPDP Act 2023 compliance

| Requirement | Implementation |
|---|---|
| Data minimization | Zod schemas reject unexpected fields. Lead capture requires only name. |
| Explicit consent | WhatsApp opt-in managed per TRAI regulations via Meta template approval. |
| Right to erasure | `DELETE /api/admin/user-data?userId=<id>` cascades through 12 tables. |
| Purpose limitation | Each data field has a documented purpose in the schema comments. |
| Data breach notification | Sentry alerting + Better Stack uptime monitoring. 72-hour DPDP notification SLA. |

## OWASP API Security Top 10 coverage

| # | Risk | Mitigation |
|---|---|---|
| API1 | Broken Object Level Authorization | tenant_id filter on EVERY query |
| API2 | Broken Authentication | bcrypt password hashing + HS256 JWT session + API key hash + webhook signatures |
| API3 | Broken Object Property Level Authorization | Zod input validation on every route |
| API4 | Unrestricted Resource Consumption | Upstash rate limiting + Claude daily USD cap |
| API5 | Broken Function Level Authorization | `requireRole()` guard on every sensitive route |
| API6 | Unrestricted Access to Sensitive Business Flows | Approval workflow for content publishing |
| API7 | Server Side Request Forgery | No user-controlled URL fetches |
| API8 | Security Misconfiguration | Secure headers, CORS lockdown, env validation |
| API9 | Improper Inventory Management | All routes audited, documented in this file |
| API10 | Unsafe Consumption of Third-Party APIs | Webhook signatures verified for Mux, WhatsApp |

## Rate limits summary

| Endpoint | Limit |
|---|---|
| Global default | 120/min per user or IP |
| `POST /api/copilot/start` | 20/min |
| `POST /api/copilot/query` | 40/min |
| `POST /api/role-play/sessions/start` | 20/min |
| `POST /api/role-play/sessions/:id/respond` | 60/min |
| `POST /api/role-play/sessions/:id/evaluate` | 20/min |
| `POST /api/role-play/scenarios/:id/show-me` | 6/min |
| Claude API | Per-tenant daily USD cap (default $25) |

## Secret rotation schedule

Rotate quarterly. After rotation, restart all Railway + Vercel deployments.

| Secret | Location | Rotation method |
|---|---|---|
| `JWT_SECRET` | `.env` (`openssl rand -base64 48`) | Replace + redeploy; every existing session is invalidated |
| `ANTHROPIC_API_KEY` | Anthropic Console | Create new, delete old |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console | Reset in DB settings |
| `R2_SECRET_ACCESS_KEY` | Cloudflare Dashboard | Create new R2 API token |
| `MUX_TOKEN_SECRET` | Mux Dashboard | Create new access token |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business Suite | Generate new system user token |
| `API_INTERNAL_SECRET` | Your `.env` | Generate new random string |

## VAPT scope for vendor

The following endpoints should be pen-tested:

1. **Auth bypass** — attempt to access `/api/*` routes without valid JWT/API key
2. **Tenant isolation** — attempt to read tenant B's data with tenant A's credentials
3. **Role escalation** — attempt admin operations with agent-level credentials
4. **Input injection** — fuzz all Zod-validated inputs with SQL/XSS payloads
5. **Rate limit bypass** — verify rate limits hold under sustained load
6. **Webhook forgery** — send unsigned payloads to `/webhooks/*` endpoints
7. **API key abuse** — attempt to use revoked/expired API keys
8. **File upload abuse** — attempt oversized or wrong-MIME uploads via presigned URLs
9. **IDOR on leads** — attempt to access another agent's leads via `/api/leads/:id`
10. **Claude prompt injection** — attempt to manipulate the Copilot/role-play via adversarial inputs

## Recommended VAPT vendors (India)

- Qualys / Indusface (CERT-IN empanelled)
- Sum Logic / Aujas
- Lucideus (SAFE Security)

Estimated cost: ₹3-8 lakh depending on scope and vendor tier.
