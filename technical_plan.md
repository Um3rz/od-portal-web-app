# Odoo Dashboards Web App — Technical Plan

Companion to `odoo_dashboards_web_app_plan.md` (product boundary, decisions, verification matrix — not
repeated here). This file grounds that plan in the actual source of truth across the three reference
repos and turns it into buildable phases with concrete acceptance checks.

## 0. Sources referenced (all local, read directly for this plan)

| Repo | Path | Branch/state | What it's the source of truth for |
|---|---|---|---|
| `odoo_dashboards_saas` (Odoo addon) | `../odoo-dashboards-dev/odoo_dashboards_saas` (also mounted at `../odoo16/custom_addons/odoo-dashboards-dev`) | `feature/mobile-app-access_control` | Mobile API contract (`controllers/mobile.py`), auth model (`models/mobile_auth.py`), design tokens (`static/src/styles/_tokens.css`, `_primitives.css`, `REDESIGN.md`), icon system (`static/src/components/icon/*`) |
| `odoo-dashboards` (marketing/demo Next.js site) | `../odoo-dashboards` | main | Concrete example of the target stack (Next.js + Tailwind + shadcn) wired to the same token names |
| `codename-portals` (mobile app) | not present on this machine | — | Referenced only via its plan docs already folded into `odoo_dashboards_web_app_plan.md` §7; treat that file as the up-to-date summary, no separate audit possible here |

Two corrections to `odoo_dashboards_web_app_plan.md` found while reading the addon source, both already
reflected in the phase table below:

1. **The lazy filter route already exists.** `POST /mobile/v1/dashboard/<id>/filter_values` shipped in
   commit `6b769ae` on `feature/mobile-app-access_control` (`controllers/mobile.py:323-362`). It already
   validates dashboard visibility via `_dashboard_or_404`, parses `selected_global_filter_conditions`
   under `.sudo()` the same way `_get_available_global_filters` does, and 404s if `condition_id` isn't
   one of this dashboard's own global-filter conditions. F0 is a contract audit + fixture export against
   this route, not new backend work.
2. **The theme is not a screenshot to redraw — it's live CSS.** `_tokens.css` and `_primitives.css` in the
   addon are the actual, already-shipped implementation of the "REDESIGN.md" design system the product
   plan describes secondhand. Port values, don't re-derive them from the screenshots.

## 1. Backend contract (verified against `controllers/mobile.py`)

Auth is Bearer-token only, resolved per request by `mobile_route()` (`controllers/mobile.py:74-135`) — no
`/login` route exists:

- Internal users: `res.users.apikeys._check_credentials(scope="mobile", key=...)`. Keys are minted from
  Odoo's own "My API Key" backend screen (see product plan's onboarding flow) and pasted into the web
  app; the web app never mints or manages them.
- External grants: `dashboard.external.access.saas._check_credentials(key)` — a separate row type, never
  a `res.users` record (`models/mobile_auth.py:14-17`). Grants are admin-issued from the Odoo backend
  (`action_generate_token`, `models/mobile_auth.py:44-61`) against a fixed `dashboard_ids` allow-list and
  `expires_at`; the web app has no self-service flow to create one, only to consume one.
- Both paths are rate-limited: 20 bad-key attempts/60s per IP (`BAD_KEY_LIMIT`/`BAD_KEY_WINDOW`), 300
  requests/60s per key or grant (`KEY_LIMIT`/`KEY_WINDOW`), all via `mobile.rate.limit.saas`, all 429 +
  `Retry-After`. The BFF must not add a second, disagreeing rate-limit layer on top — surface Odoo's 429
  as-is.
- Routes are `type="http"` on purpose (not `type="json"`) so real 401/404/429 reach the client instead of
  Odoo's JSON-RPC 200-with-error-in-body pattern. The BFF must preserve this — never normalize a 401/404
  from Odoo into a 200.

Endpoint contract to build the BFF against, 1:1:

| Method/Route | Auth-gated by | Notes for the BFF |
|---|---|---|
| `GET /mobile/v1/ping` | none | No key needed; drives onboarding/origin validation before a key exists. Returns `contract_version`/`min_app_version` — the BFF should surface a hard-stop UI if these don't match what it was built against. |
| `POST /mobile/v1/logout` | key | Revokes **all** `scope="mobile"` keys for the uid, not just this session's. BFF must warn on this UX (other devices get logged out too) rather than silently calling it. |
| `GET/POST /mobile/v1/dashboards` | key | `_mobile_visible()` for internal users, exact `dashboard_ids` allow-list for external grants. Response includes `etag` (= `write_date`) — use it as a React Query cache-validation field, not just a display value. |
| `GET/POST /mobile/v1/dashboard/:id` | key | 404s (not 403) on invisible dashboards — never let the BFF leak existence via a different status code. |
| `POST /mobile/v1/dashboard/:id/payload` | key | `item_ids` are narrowed server-side against the dashboard's own visible widgets regardless of what the client sends — the BFF does not need to pre-filter, but also must not skip forwarding whatever `item_ids` the client requested (narrowing is Odoo's job, not the BFF's). |
| `POST /mobile/v1/dashboard/:id/filter_values` | key | Already implemented (see §0). `condition_id` must belong to the dashboard's own `selected_global_filter_conditions` or it 404s — the BFF passes `condition_id`/`search`/`limit` straight through, no client-side validation needed since Odoo re-validates anyway. |
| `POST /mobile/v1/devices` | key, internal-only | 404 for external grants (`_internal_mobile_or_404`). Push registration — likely out of scope for a browser BFF unless web push is added later; note as a non-goal rather than building dead UI for it. |
| `GET /mobile/v1/notifications`, `POST /mobile/v1/notifications/:id/read` | key, internal-only | `since` param exists but the reference mobile client always full-fetches (capped at 200 rows server-side); do the same, don't build delta-merge logic for it (see product plan §Alerts). |
| `GET/POST /mobile/v1/alerts`, `DELETE /mobile/v1/alerts/:id` | key, internal-only | `operator` is one of `below, above, drops_pct, rises_pct, below_target`; `dimension_filter` must be a JSON object or the route 400s. Mirror this validation client-side for UX, but the server is the actual gate. |

Non-goals confirmed by reading the controller: no password/SSO auth exists to integrate against (there is
no such route), so the product plan's "API-key paste is the only v1 auth flow" isn't a scoping choice to
revisit later — it's the only thing the backend offers at all.

## 2. Design system port

Source of truth: `odoo_dashboards_saas/static/src/styles/_tokens.css` (scoped under `.o_dsaas`, never
`:root` — same constraint applies to the web app's theme package so it doesn't leak if ever iframed into
Odoo). Port these values verbatim into the shared theme package, do not re-derive from the screenshot:

```css
/* Primary — indigo, hue 244 */
--primary-50: hsl(244 100% 97%);  --primary-100: hsl(244 100% 90%);
--primary-300: hsl(244 90% 78%);  --primary-500: hsl(244 100% 51%);
--primary-700: hsl(244 100% 41%); --primary-900: hsl(244 90% 22%);

/* Accent — amber, AI touchpoints ONLY, never a status color */
--accent-50: #fffbeb; --accent-300: #fcd34d; --accent-500: #f59e0b; --accent-700: #b45309;

/* Neutrals — cool gray, hue 220 */
--background: hsl(220 20% 98%); --surface: #fff; --muted: hsl(220 14% 96%);
--border: hsl(220 13% 91%); --border-input: hsl(220 13% 88%);
--foreground: hsl(220 9% 12%); --fg-muted: hsl(220 9% 42%); --fg-subtle: hsl(220 9% 58%);

/* Semantic — status only, never decoration */
--info: hsl(217 91% 55%); --success: hsl(152 60% 32%);
--warning: hsl(43 74% 50%); --danger: hsl(0 84% 60%);

/* Chart palette — data viz only, never status */
--chart-1: hsl(217 91% 60%); --chart-2: hsl(173 58% 39%); --chart-3: hsl(224 64% 33%);
--chart-4: hsl(43 74% 66%);  --chart-5: hsl(27 87% 67%);

/* Sticky note — decorative, must never alias to --warning-* */
--note-surface: hsl(45 90% 94%); --note-border: hsl(45 60% 82%);

/* Spacing (8px rhythm, 4px half-step) / Radius (by component class) */
--sp-1..--sp-12: 4/8/12/16/24/32/48px;
--radius-sm: 4px (tags, lozenges, checkboxes); --radius-md: 6px (inputs, buttons, rows);
--radius-lg: 8px (cards, panels); --radius-xl: 12px (modals); --radius-full: 999px (pills, avatars);

/* Elevation — four planes, focus ring REPLACES border, never stacks */
--shadow-raised / --shadow-overlay / --shadow-modal / --modal-backdrop;
--focus-ring: 0 0 0 3px hsl(244 100% 92%), 0 0 0 1px var(--primary-500);
```

**No dark mode.** This is a resolved decision in the addon (`REDESIGN.md` Part 9 #1): name tokens cleanly
enough that a future dark pass is a swap, but ship no dark values or `prefers-color-scheme` blocks now.
Carry the same decision into the web app rather than re-litigating it.

**Fonts**: the addon ships self-hosted variable fonts via `@font-face` (Instrument Sans 400–600, Schibsted
Grotesk 500–700, each split into latin/latin-ext subsets, `static/src/fonts/*.woff2`). The marketing
Next.js repo (`odoo-dashboards`) instead loads the *same two families* through `next/font/google`
(`app/layout.tsx`), which is the better fit for a Next.js app — no manual `@font-face`/subsetting, and
Next self-hosts and inlines the font-display CSS at build time. Use `next/font/google` with
`variable: '--font-schibsted-grotesk'` / `'--font-instrument-sans'`, matching the marketing repo's exact
pattern, and map `--font-heading`/`--font-body` in the theme package to those variables instead of
hardcoding family names.

**Tailwind/shadcn setup**: mirror `odoo-dashboards`' proven config rather than inventing one —
`tailwind.config.js` maps `primary`/`secondary`/`muted`/`accent`/`destructive`/`chart-1..5` to `hsl(var(--x))`
tokens, `components.json` uses shadcn's `new-york` style with `cssVariables: true`. One deliberate
deviation: set shadcn's `baseColor` question aside — the marketing repo took `zinc` as a shadcn scaffolding
default and then overrode every color variable anyway (`src/index.css` root values already match the
addon's `--primary-500: hsl(244 100% 51%)` exactly), so scaffold with any base and immediately replace
`:root` values with the `.o_dsaas` token set from `_tokens.css` §above — do not keep zinc-derived grays.
Pin versions to what's proven working in the marketing repo: `next@^16`, `react@^19`, `tailwindcss@^3.4`,
`tailwindcss-animate`, `@radix-ui/react-*` as needed per shadcn component.

**Icon system**: port `static/src/components/icon/icon.js` and `icons.js` (68 SVGs, 24×24 grid, 20px live
area, 1.6 stroke, round caps/joins, `fill="none" stroke="currentColor"`) as a React component with the
exact same three-part structure already implemented there:
- `ALIAS` — flat map of legacy Font Awesome names → icon-set names (`times→close`, `pencil→edit`,
  `cog→settings`, `caret-down→chevron-down`, etc. — copy the full map from `icon.js:11-47`, it's already
  the audited result of 82 FA names across 311 call sites).
- `resolveIcon(name)` — alias lookup, then existence check, then `FALLBACK = "help"`, with a dev-only
  console warning on miss. Never render an empty box.
- `vizIcon(analyticalType)` / `fieldIcon(fieldType)` — typed helpers with their own fallbacks (`tile`,
  `type-char`) for open-ended Odoo domains, copied from `icon.js:62-101`.

Component specs (buttons, inputs, checkbox/toggle, tag vs. lozenge, tabs, table, notification, empty
state) are fully enumerated in `REDESIGN.md` Part 2.6 — implement shadcn primitives to match those specs
rather than shadcn's defaults (e.g. buttons are height 40/32, radius 6, weight 500, sentence-case
imperative labels — "Create dashboard", never "Submit"). Table headers are sentence case, not all-caps,
which is a common shadcn/Tailwind UI default to explicitly override.

## 3. Frontend architecture

- **Framework**: Next.js App Router, TypeScript, Tailwind, shadcn (`new-york`) — matches the product plan
  and the proven `odoo-dashboards` stack.
- **BFF**: same-origin `/api/odoo/*` route handlers (Next.js Route Handlers) proxy 1:1 to the endpoints in
  §1, holding the Odoo API key in an encrypted server-side session (e.g. `iron-session` or equivalent) —
  never sent to the browser. Route handlers are also the SSRF choke point: validate the registered Odoo
  origin (HTTPS, no redirects, DNS-rebinding/private-IP checks) once at registration and again defensively
  on every outbound fetch.
- **Data layer**: React Query, keyed on `[tenant, sessionId, dashboardId, itemBatch, rangeFilterHash, globalFilterHash, refreshToken]` per the product plan. Use the `/dashboards` response's `etag` (`write_date`) as a `staleTime`/revalidation signal, not just a display field.
- **Filters**: draft/commit pattern already proven in the mobile app's `GlobalFilterRow` — keystrokes never
  refetch, Apply commits the filter hash, Reset returns to the unfiltered cache key. Multiselect
  eager/lazy typeahead calls the (already-shipped) `filter_values` route with a 300ms debounce.
- **Alerts/notifications**: no polling on either endpoint — refetch on `visibilitychange`/window focus
  (React Query's `refetchOnWindowFocus`, free on web, unlike React Native's `useFocusEffect`) and on
  explicit refresh. This matches the addon's 2026-09 event-driven rewrite (notifications land within the
  triggering dashboard's own refresh cadence server-side now, not a fixed poll window) — a client-side
  poll would be strictly worse than what the server already does.
- **Rendering**: reuse extracted Odoo option/model builders where they exist so web and mobile chart
  configs cannot drift (product plan §4 Rendering and cache) — do not hand-roll chart option mapping a
  second time in the Next.js app.

## 4. Phased roadmap

| ID | Phase | Work | Acceptance | Status |
|---|---|---|---|---|
| F0 | Contract verification | Confirm `feature/mobile-app-access_control` contract against `controllers/mobile.py` (done — see §0/§1); export shared JSON fixtures per endpoint incl. `filter_values`; document the 401/404/429 shapes. | Web BFF integration tests pass against real fixtures, not hand-written mocks. | Ready to start (backend work assumed done here is no longer blocking) |
| F1 | Foundation/security | Next App Router shell; theme package with `.o_dsaas`-scoped tokens ported from `_tokens.css` (§2); `next/font/google` for Instrument Sans/Schibsted Grotesk; ported Icon component + alias map; shadcn primitives matched to `REDESIGN.md` §2.6 specs; encrypted session; tenant SSRF validation; BFF route handlers; rate-limit passthrough; metrics. | Tenant/key secrets redacted in logs; malicious origins rejected; Odoo 429s pass through with `Retry-After` intact. | **Core done, metrics still open** — see §6 progress log |
| F2 | Viewer shell | Onboarding (origin + key paste against `GET /ping` then a real key check), dashboard list/search/favourites (using `/dashboards` + `etag`), dashboard detail, nav rail, topbar, responsive widget grid, offline cache. | User sees only Odoo-authorized dashboards (internal visibility or external allow-list); cached data reloads offline. | **Shell done, widget grid is placeholder** — see §6 progress log |
| F3 | Filters | Date presets, numerical inputs, eager/lazy multiselect against `filter_values`, apply/reset, filter hashing, request cancellation, `global_filter_unapplied` badges rendered verbatim. | Matches Odoo/mobile fixtures; no stale results after Apply/Reset. | **Built** — see §6 progress log |
| F4 | Renderer parity | Tile, sticky note, bar (h/v), line, area, doughnut, funnel, table, heatmap, matrix, fullscreen, unsupported/error cards. Map and pivot explicitly excluded (product plan §1). | Payload/options and visual snapshots match mobile/Odoo fixtures. | Planned |
| F5 | Workflow parity | Alerts CRUD (`operator` enum validated client + server side), notification inbox/read state, external-grant restrictions (404 on internal-only routes), session/profile management. | Internal users manage rules; external identities can't reach internal-only routes; inbox reflects the event-driven server cadence, no client poll. | Planned — mobile app has a shipped reference implementation of the same fetch-on-focus pattern |
| F6 | Builder-ready theme | Three-region builder shell, analytics-item list, config tabs, visualization picker (using `vizIcon` for the 13 in-scope types), live-preview states. Theme-compatible now; editing logic is out of scope. | Screenshot reference reproduced at desktop and responsively. | Planned |
| F7 | Release hardening | Accessibility, browser matrix, load tests, retry/rate-limit soak tests against real Odoo 429s, security review, deployment runbook, staged rollout. | Release checklist passes, no critical security findings. | Planned |

## 6. Progress log

### F1 — Foundation/security (checkpoint, 2026-09-09)

Scaffolded with `create-next-app@16` (Next 16.3.4, React 19.2.8, TypeScript, App Router, `src/` dir).

**Deviation from §2:** the scaffold installed **Tailwind v4** (CSS-first `@theme`, no `tailwind.config.js`),
not the v3.4/`tailwind.config.js` setup `odoo-dashboards` uses — that's simply what `create-next-app@16`
ships today. shadcn's own CLI (`v2`/`v3`) both support v4 fine, so token values and names port over
unchanged; only the mechanism (`@theme inline` in `globals.css` instead of `tailwind.config.js` `extend.colors`)
differs. `components.json` still declares `"style": "new-york"` / `"iconLibrary": "lucide"` as planned.
The `shadcn` CLI's own `add`/registry-fetch step errored in this environment (`Validation failed: css:
Invalid input`) against the v4 project — worked around by hand-writing `components.json` and the
primitives directly against the `REDESIGN.md` §2.6 specs, which the plan called for anyway (custom specs,
not shadcn defaults). Revisit `npx shadcn add <component>` for new components once the CLI issue is
understood; it's not currently a blocker since primitives are hand-rolled to spec regardless.

**Built:**
- `src/app/globals.css` — full `.o_dsaas` token set ported verbatim from `_tokens.css` (§2 of this doc),
  mapped into Tailwind's `@theme inline`. No dark-mode values, matching the addon's resolved decision.
- `src/app/layout.tsx` — `next/font/google` Schibsted Grotesk + Instrument Sans, `.o_dsaas` class on `<html>`.
- `src/components/icon/icons.ts` + `icon.tsx` — full 68+11-icon set and the `Icon`/`resolveIcon`/`vizIcon`/
  `fieldIcon` port from `icon.js`, same `ALIAS` map, same `"help"` fallback behavior. Self-check:
  `npx tsx src/components/icon/icon.test.ts`.
- `src/components/ui/{button,input,tag,card,spinner}.tsx` — primitives matching `REDESIGN.md` §2.6 specs
  (button variants/heights, input focus-ring-replaces-border, tag-vs-lozenge distinction, CSS spinner
  instead of a drawn icon). `.tbl`/`.modal`/`.tabs`/`.empty-state` deferred until a screen actually needs
  them (F2+), per REDESIGN.md Part 9's own "decide when scoped" pattern — building them speculatively now
  would be exactly the kind of unused flexibility the addon's own redesign explicitly avoided.
- `src/lib/ssrf.ts` — origin validator: HTTPS-only, no credentials in URL, port allow-list (443/8069/8071),
  DNS resolution + public-IP check (blocks loopback/RFC1918/link-local/multicast). Documented residual gap:
  re-resolves immediately before each fetch rather than pinning the validated IP into the connection (full
  fix needs a custom `undici` dispatcher — noted as a `ponytail:`-style upgrade path in the file, not built
  yet). Self-check: `npx tsx src/lib/ssrf.test.ts`.
- `src/lib/session.ts` — `iron-session`-backed encrypted cookie (`SESSION_SECRET` env var, 32+ chars,
  required or the module throws at boot). Holds `odooOrigin`/`apiKey` server-side only.
- `src/lib/odoo-client.ts` — server-only fetch wrapper: re-validates origin per call, `redirect: "manual"`
  (no redirect following), passes upstream status/body through unmodified.
- `src/lib/rate-limit.ts` — in-memory per-bucket limiter mirroring Odoo's own `_hit(bucket, limit, window)`
  shape. **Known ceiling, documented in-file:** in-memory `Map`, correct for one instance only — swap for
  Redis before horizontal scaling.
- `src/app/api/tenant/register/route.ts` — validates origin, pings `/mobile/v1/ping` unauthenticated,
  then confirms the key against `/mobile/v1/dashboards`, only then writes the session. Per-IP rate limited
  (10/60s).
- `src/app/api/tenant/logout/route.ts`, `src/app/api/odoo/[...path]/route.ts` — logout revokes the Odoo-side
  key too; the generic proxy only allows the `/mobile/v1/` prefix (not an open relay) and is rate-limited
  per session-key bucket (120/60s).
- `src/app/page.tsx` — minimal onboarding form wired to `/api/tenant/register`, built now to
  smoke-test the BFF end-to-end rather than as finished F2 UX (F2 will replace/extend it with the full
  onboarding flow from the product plan).

**Verified live** (dev server, manual `curl`): HTTPS-only rejection, credentials-in-URL rejection,
private/loopback-IP rejection, unauthenticated proxy call → `401`, registration rate limit → `429` with a
correct `Retry-After` header, onboarding page renders.

**Still open before F1 is fully "done":** structured metrics/observability (plan mentions "metrics" in F1
scope, nothing built yet — no logging/metrics library chosen); the DNS-rebinding pinning gap noted above;
tenant/key redaction has been designed for (never storing the key outside the encrypted session, no
`console.log` of it anywhere in the code written) but hasn't been verified against an actual log pipeline
since none exists yet.

### F2 — Viewer shell (checkpoint, 2026-09-09)

**shadcn CLI retried and now works.** Root cause of the F1 checkpoint's failure: `shadcn@2`'s `init`
consistently errors at its "Checking registry" step (`Validation failed: css: Invalid input`) against a
Tailwind v4 project — reproduced on a completely clean `create-next-app@16` scaffold with no project code
involved, so it's a bug in that CLI version against v4, not something in this repo. `shadcn@latest` (v3)
works, but its interactive `init` defaults to a "base-nova" preset (Base UI components, oklch colors, baked-in
dark-mode variants) that would fight everything already built to `REDESIGN.md` spec — not used. What *is*
used: `npx shadcn@latest add <component>` against the hand-written `components.json` from F1
(`"style": "new-york"`, Radix, zinc) still correctly pulls from the legacy new-york registry and generates
Radix-based components using standard shadcn semantic class names (`bg-primary`, `text-muted-foreground`,
`bg-accent`, `border-input`, `ring-ring`, ...). To make that output render on-brand without hand-patching
every generated file, `globals.css`'s `@theme inline` block was extended with the full standard shadcn slot
set, bridged onto the existing `.o_dsaas` tokens — notably `accent`/`accent-foreground` maps to a neutral
primary-tinted hover state, deliberately **not** the amber `--accent-*` scale, which `REDESIGN.md` reserves
for AI touchpoints only. Verified against `dialog` (installed, inspected, removed again since F2 doesn't
need it yet — nothing currently imports `radix-ui`/`cn` packages). Use `npx shadcn@latest add <component>`
for any future interactive primitive (popover, tabs, dropdown-menu, ...) rather than hand-rolling it.

**SSRF gate: dev-only localhost exception added.** `ssrf.ts` now allows exactly `http://localhost:8069`
(not any loopback address, not any port — an exact-origin match) when `NODE_ENV !== "production"`, so this
app can be pointed at a local `odoo-bin` instance while building. Confirmed live against a real local Odoo
instance already running on `:8069`: `GET /mobile/v1/ping` reachable, an invalid API key correctly rejected
with Odoo's own `401`. A fully authenticated round trip (real dashboards returned) needs a real mobile API
key, which requires Odoo admin credentials this session doesn't have — not attempted further than that.
Self-check updated: `npx tsx src/lib/ssrf.test.ts` now also asserts the exact-origin scoping (a different
port or the loopback IP instead of `localhost` must still be rejected).

**Built:**
- `src/components/query-provider.tsx` — React Query with `localStorage` persistence
  (`@tanstack/react-query-persist-client`) for the "cached data reloads offline" acceptance criterion; no
  polling anywhere, matching §3's fetch-on-focus decision.
- `src/lib/api.ts` + `src/hooks/use-dashboards.ts` — typed BFF client and query hooks for
  `GET /dashboards` and `GET /dashboard/:id`, shapes matched exactly to `controllers/mobile.py` and
  `models/dashboards.py:get_dashboard_metadata` (read directly from source, not guessed).
- **Tenant cache isolation**: query keys are not tenant-scoped (single-tenant-per-session model), so the
  persisted cache is explicitly cleared on both the register-success and logout transitions instead —
  cheaper than plumbing a tenant id through every key, and closes the real gap where reconnecting to a
  different Odoo instance in the same browser could otherwise show a stale tenant's dashboard names.
- `src/hooks/use-favourites.ts` — client-local favourites (`localStorage`), per the product plan's "local
  to each client in v1" decision.
- `src/components/layout/{nav-rail,topbar}.tsx` — collapsible nav rail (dashboard list, favourite toggle,
  active-route highlight) and topbar (back nav, title/subtitle, disconnect). Configurations/Advanced
  Configuration groups from the builder-ready layout are explicitly deferred to F6, not stubbed here.
- `src/app/(app)/layout.tsx` — server-side session gate (redirects to `/` if not connected) wrapping the
  nav rail + page content.
- `src/app/(app)/dashboards/page.tsx` — list, client-side search, favourites, empty/error/loading states,
  "as of" cache timestamp.
- `src/app/(app)/dashboards/[id]/page.tsx` — metadata + item-manifest shell (matches
  `get_dashboard_metadata`'s own "ids + types only, no data queries" design — the controller returns a
  skeleton manifest by intention, not an oversight). Each item renders its icon (via `vizIcon`) and a
  placeholder card; actual widget payload fetching and chart rendering is F4, not built here.
- `src/app/page.tsx` — now a server component: redirects to `/dashboards` if a session exists, otherwise
  renders the (now-extracted) `OnboardingForm` client component.

**Verified live:** clean `next build`/`lint`; unauthenticated flow against the real local Odoo instance
(ping reachable, invalid key rejected); SSRF dev carve-out reaches that instance while a non-exact
loopback origin is still blocked.

**Bug found and fixed while testing with a real key: `QueryProvider` crashed every server render.**
`src/components/query-provider.tsx` returned `children` unwrapped (no `QueryClientProvider` at all) when
`typeof window === "undefined"`, on the theory that persistence just isn't available yet during SSR. But
Next.js server-renders client components too, for the initial HTML/RSC payload, and `OnboardingForm` (and
now the dashboards pages) call `useQueryClient()` unconditionally at the top of the component -- so every
first paint 500'd with "No QueryClient set, use QueryClientProvider to set one" before hydration ever ran.
Fixed by always rendering `PersistQueryClientProvider` and passing `storage: undefined` on the server,
which is the persistence library's own documented SSR case (it no-ops persistence internally, no stub
object needed) rather than skipping the provider. This class of bug -- a client component conditionally
skipping its own context provider based on an environment check -- is worth watching for elsewhere in this
codebase; there wasn't a second instance found on a quick pass, but nothing was systematically audited for it.

**Authenticated round trip confirmed against real data.** Registered against the local Odoo instance
(`http://localhost:8069`) with a real mobile API key and confirmed, through the actual BFF routes (not a
mock): `GET /api/odoo/mobile/v1/dashboards` returns 5 dashboards (Sales, Sales Overview, Sales Overview
(demo), Customer Revenue, test), `GET /api/odoo/mobile/v1/dashboard/2` returns the full metadata/item
manifest including a `global_filters` array (F3 will need to type this properly -- currently `unknown[]`
in `src/lib/api.ts`, sample shape now known: `{conditions_line_id, column_name, field_type, filter_type,
description, ...}` per filter), and both `/dashboards` and `/dashboards/2` pages render end-to-end with a
real session cookie. The session cookie used for this test was deleted after verification, not committed
or left on disk.

**Still open before F2 is fully "done":** responsive/tablet/390px layout pass (product plan §3.5 acceptance
criteria) -- not yet done against real content, only spot-checked at desktop width; `etag`-based
revalidation is fetched but not yet used to short-circuit refetches; the widget grid is a
typed/iconed placeholder, real rendering is F4.

### F3 — Filters (checkpoint, 2026-09-09)

**Built:**
- `src/lib/api.ts` now types Odoo's global-filter descriptors and applied-filter wire shape, and adds
  typed `dashboardPayload` and `filterValues` calls using Odoo's exact POST body names.
- `src/lib/filters.ts` provides a canonical order-independent filter hash and empty/reset state.
- `src/components/filters/filter-toolbar.tsx` implements collapsed date, numerical, eager multiselect, and
  lazy typeahead controls. Presets are `1D`, `1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, and `ALL`; lazy lookups
  debounce for 300ms, show truncation/timeout states, and abort superseded requests.
- `src/hooks/use-dashboard-payload.ts` keys payload queries by dashboard, item ids, and committed filter
  hash; React Query supplies cancellation through the request `AbortSignal`. Draft edits never refetch.
- The dashboard detail page now applies filters only on explicit Apply, supports Reset, and surfaces Odoo's
  `global_filter_unapplied` messages verbatim when present in the payload response. `Logo_Colored.svg` is
  used in onboarding and the navigation rail.

**Verified:** `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass. Widget visualization remains F4;
the payload is fetched and cached now so renderer parity can consume the same committed filter state.

### F4 — Renderer parity (initial checkpoint, 2026-09-09)

**Built:** `src/components/dashboard/dashboard-renderer.tsx` consumes the BFF's `analytics_data` payload and
renders tiles, sticky notes, ECharts-backed vertical/horizontal bars, lines, areas, doughnuts, funnels,
tables, heatmaps, matrices, fullscreen cards, retryable per-widget errors, unsupported cards for map/pivot,
and per-widget `global_filter_unapplied` badges. `src/renderers/chart-options.ts` centralizes the chart
option builders and uses the Odoo payload conventions (`x`/`y`, measures, labels, stacking metadata). The
dashboard detail page maps manifest entries to their payload entries and no longer shows the F2 placeholder
grid. The explicit back link always returns to `/dashboards`.

**Verified:** `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass. Remaining F4 hardening is visual
snapshot comparison against representative Odoo/mobile fixtures and richer edge-case configuration parity.

## 7. Open questions (not yet blocking)

- `customer_ageing_report` shares the `TableRenderer` styling in the addon (`REDESIGN.md` Part 9 #3) and
  has a dedicated `ageing` icon, but isn't named in the product plan's F4 widget list. Confirm whether it's
  in v1 scope or deferred with map/pivot.
- Web push (`POST /mobile/v1/devices`) has no browser-BFF equivalent unless web push is added; confirm
  it's a non-goal rather than silently unimplemented UI.
- `GET /mobile/v1/ping` returns `min_app_version`/`contract_version` — decide the web app's own version
  string and what "hard stop" UI looks like on mismatch, since unlike the mobile app there's no app-store
  gate forcing an update.
