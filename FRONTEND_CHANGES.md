# FRONTEND_CHANGES.md

> Running log of every frontend surface touched by the frontend agent.
> One entry per surface per session. Newest entries at the top.
> Format: date · surface · aesthetic decisions · files changed · verification.

---

## 2026-04-15 · Session 01 · Context + aesthetic foundation + landing page

### Scope
First frontend agent session. Three outputs:
1. `CLAUDE.md` at repo root — agent contract, role boundaries, aesthetic DNA
2. Design token + typography foundation — palette, fonts, Tailwind config, globals.css
3. Public landing page rebuilt end-to-end in the new aesthetic

### Aesthetic direction locked — "Precision Instrument"
Full rationale in `CLAUDE.md §5`. Short form:
- **Palette:** deep ink `#0A0E1A` base, parchment cream `#F5F0E6` contrast, molten saffron `#E8923C` as single accent, signal green `#6DDFA7` and ember `#E86A5C` reserved for data
- **Type:** `Instrument Serif` (display, editorial, high-contrast) + `Manrope` (body, geometric humanist) + `JetBrains Mono` (labels, numerals). No Inter anywhere.
- **Motion:** one staggered page-load reveal; hover-only micro-interactions; `prefers-reduced-motion` respected
- **Texture:** SVG grain overlay at 1.5% opacity on dark; single radial saffron glow from top; Devanagari quiet watermark as identity mark
- **Spatial grammar:** asymmetric 12-col grid; numbered section anchors (01/02/03) in mono; hairline rules as chapter breaks

### Why this direction
Product serves Indian BFSI compliance-regulated sales — must feel trustworthy to a 55-year-old bank CRO *and* modern to a 28-year-old field agent. Editorial serious beats startup-playful. One accent disciplined beats a timid evenly-distributed palette. Indian identity carried through Devanagari quiet marks, not kitsch.

### Files created / changed
| File | Change |
|---|---|
| `CLAUDE.md` | Created — agent contract + aesthetic DNA + handoff rules |
| `FRONTEND_CHANGES.md` | Created — this file |
| `apps/web/src/app/globals.css` | Rewrote token set: ink/parchment/saffron palette, new type variables, grain & glow utilities |
| `apps/web/tailwind.config.ts` | Added ink/parchment/saffron/signal color scales, font families, custom font sizes, extended keyframes for reveal |
| `apps/web/src/app/layout.tsx` | Replaced Inter with `Instrument Serif` + `Manrope` + `JetBrains Mono` via next/font; body font class applied |
| `apps/web/src/app/page.tsx` | Rewrote landing end-to-end — editorial hero, numbered sections, proof strip, CTA band, footer |

### Handoff requests to backend agent
None from this session. Landing page is static; no new API surfaces required.

### Handoff requests from backend agent
None received yet.

### Verification — 2026-04-16
- **Typecheck:** `pnpm --filter @salescontent/web typecheck` ✅ passes for every file I touched (page.tsx, layout.tsx, tailwind.config.ts, globals.css).
- **One pre-existing error remains and is OUT OF THIS SESSION'S SCOPE:**
  `src/app/(dashboard)/illustrator/page.tsx:66` — `Link href="/illustrator/${id}"` fails typedRoutes because template-literal dynamic segments aren't statically resolvable. Existed before I touched anything (STATE.md flagged "ELEVEN sessions unverified"). Will fix when I migrate dashboard surfaces.
- **Note on Clerk auth links:** Because auth pages are Clerk catch-all routes (`(auth)/sign-in/[[...sign-in]]/page.tsx`), Next typedRoutes does not expose `/sign-in` as a registered Route literal. Switched those 4 nav CTAs from `<Link>` to `<a>` — no prefetch loss since these are full-page nav into Clerk's shell.
- **Dev server:** not run in this session (env vars not provisioned here). Yathu to run `pnpm dev:web` locally; all changes are render-pure — no new runtime deps, no env contract touched.

### Known gaps / deferred (in priority order)
1. **Dashboard surfaces** (`app/(dashboard)/*`) still inherit old shadcn aesthetic — will migrate per-surface in later sessions. Dashboard is the highest-value authed surface.
2. **Sign-in / sign-up** (`app/(auth)/*`) still Clerk default — need to theme Clerk's `appearance` prop to ink/saffron palette next session.
3. **Module feature components** under `components/copilot/ reels/ role-play/ leads/ manager/ whatsapp/` etc. untouched — address per module, one per session.
4. **Illustrations:** landing is typographically composed; no product mockups, no hero illustration, no case-study visuals. Planned session 02: custom SVG marks + one screen-mockup for hero.
5. **Social share card / favicon / OG image:** still defaults — replace in session 02 when the brand mark is final.
6. **Typed-routes dashboard regression:** fix in the first dashboard migration session (need to refactor `Link href={template}` to `Link href={{ pathname: "/illustrator/[id]", query: {id} }}` or cast via `as Route`).

---
