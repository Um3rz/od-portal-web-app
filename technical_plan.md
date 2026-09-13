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

**Skeleton loaders** (ported — see §6 "Skeleton loaders" checkpoint) — there's a real, already-shipped
reference this was ported from:
`odoo_dashboards_saas/static/src/components/skeleton_card/{skeleton_card.js,skeleton_card.xml}` +
`static/src/styles/skeleton-card.css`. Five shape variants (`tile`, `chart`, `table`, `heatmap`, `map`; a
`sticky_note` variant renders as a transparent/borderless block via `.od-skeleton-note`), each built from
grey `.od-skel-bar` blocks sharing one CSS sweep animation (`background-position` keyframe, 1.4s
ease-in-out, gradient wider than the element so the highlight travels across it) rather than a spinner.
This is not cosmetic-only: the backend is explicitly designed around it —
`get_dashboard_metadata`'s own inline comment says it returns "ids + types only, no data queries... Lets
the client paint the whole grid as skeletons from one round-trip, then fetch each item's data separately"
(`models/dashboards.py:695-697`), and each manifest item's `bucket` field (`ANALYTIC_TYPE_BUCKETS`,
`models/dashboards.py:95-104`) is the exact variant key to use: `tile→tiles`, `sticky_note→sticky_notes`,
`heatmap→heatmaps`, `map→maps`, `table→tables`, `pivot→pivots`, `matrix→matrices`, and every chart type
(`line`, `area_chart`, `doughnut`, `funnel`, `horizontal_bar_chart`, `vertical_bar_chart`) collapses to one
`vertical_bar_charts` bucket → the `chart` skeleton variant. `DashboardItem.bucket` in `src/lib/api.ts`
already carries this field end to end; nothing currently reads it. Where this replaces what's built so far:
the dashboards list page's full-grid `Spinner` (`src/app/(app)/dashboards/page.tsx`) and the dashboard
detail page's full-page `Spinner` while the manifest loads, plus — the more load-bearing case — each
widget card in `src/components/dashboard/dashboard-renderer.tsx` while its `payload` fetch is still in
flight (`payload.isLoading`), which today only shows a single generic "Loading widget data…" line above
the whole grid rather than a per-card, per-type skeleton.

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
- **Per-widget filters — real, not just an affordance** (corrected 2026-09-10; supersedes an earlier note
  here that wrongly called this backend-dependent). `POST /mobile/v1/dashboard/:id/payload` is already
  scoped per request by both `item_ids` *and* `range_filter`/`global_filters` together — nothing requires
  those to be the same for every item on the dashboard. A widget with its own filter override therefore
  fetches its own payload (`item_ids=[thatWidgetId]`, its own `range_filter`/`global_filters`), independent
  of the dashboard's shared committed filters — no backend change needed. Every widget card gets a
  Y/1D/7D/30D/MTD/YTD quick-range row plus a filter icon opening the same `FilterToolbar` used dashboard-
  wide, scoped to just that widget. See §6 checkpoint below for the implementation.
- **No dashboard builder.** This app is a read-only viewer for dashboards authored in Odoo — not a
  configuration/authoring surface. A builder-ready theme shell (F6) was built on 2026-09-10 and then
  reverted the same day per product decision: building/editing dashboards is out of scope entirely, not a
  later phase. See §6 checkpoint below.

## 4. Phased roadmap

| ID | Phase | Work | Acceptance | Status |
|---|---|---|---|---|
| F0 | Contract verification | Confirm `feature/mobile-app-access_control` contract against `controllers/mobile.py` (done — see §0/§1); export shared JSON fixtures per endpoint incl. `filter_values`; document the 401/404/429 shapes. | Web BFF integration tests pass against real fixtures, not hand-written mocks. | Ready to start (backend work assumed done here is no longer blocking) |
| F1 | Foundation/security | Next App Router shell; theme package with `.o_dsaas`-scoped tokens ported from `_tokens.css` (§2); `next/font/google` for Instrument Sans/Schibsted Grotesk; ported Icon component + alias map; shadcn primitives matched to `REDESIGN.md` §2.6 specs; encrypted session; tenant SSRF validation; BFF route handlers; rate-limit passthrough; metrics. | Tenant/key secrets redacted in logs; malicious origins rejected; Odoo 429s pass through with `Retry-After` intact. | **Core done, metrics still open** — see §6 progress log |
| F2 | Viewer shell | Onboarding (origin + key paste against `GET /ping` then a real key check), dashboard list/search/favourites (using `/dashboards` + `etag`), dashboard detail, nav rail, topbar, responsive widget grid, offline cache. | User sees only Odoo-authorized dashboards (internal visibility or external allow-list); cached data reloads offline. | **Shell done, widget grid is placeholder** — see §6 progress log |
| F3 | Filters | Date presets, numerical inputs, eager/lazy multiselect against `filter_values`, apply/reset, filter hashing, request cancellation, `global_filter_unapplied` badges rendered verbatim. | Matches Odoo/mobile fixtures; no stale results after Apply/Reset. | **Built** — see §6 progress log |
| F4 | Renderer parity | Tile, sticky note, bar (h/v), line, area, doughnut, funnel, table, heatmap, matrix, fullscreen, unsupported/error cards. Map and pivot explicitly excluded (product plan §1). | Payload/options and visual snapshots match mobile/Odoo fixtures. | **Built, incl. skeleton loading** — see §6 progress log |
| F5 | Workflow parity | Alerts CRUD (`operator` enum validated client + server side), notification inbox/read state, external-grant restrictions (404 on internal-only routes), session/profile management. | Internal users manage rules; external identities can't reach internal-only routes; inbox reflects the event-driven server cadence, no client poll. | **Built** — see §6 progress log |
| F6 | ~~Builder-ready theme~~ Widget-level filters & table aggregation | **Not a builder** — this app is viewer-only (see §3). Built instead: real per-widget filter overrides (quick-range chips + scoped `FilterToolbar`), and sum/group-by for table & matrix widgets. | A widget can show data on a different range/filter than its dashboard's committed filters; table totals and grouped subtotals match a manual sum of the raw rows. | **Built** — see §6 progress log |
| F7 | Home experience: carousel + gallery | Landing page (`/dashboards`) defaults to a single-dashboard-at-a-time carousel (starred dashboards first, then the rest), with a name picker beneath the topbar, slide animation, bottom prev/next arrows + dot indicators, and a topbar view-switcher toggling back to the existing card-grid gallery. Mirrors the reference mobile client's dot-paginated home screen, extended for mouse/keyboard with names and arrows. | Landing on `/dashboards` loads a dashboard immediately (no picker first); switching dashboards animates; gallery view is one click away and unchanged. | **Built** — see §6 progress log |
| F8 | Release hardening | Accessibility, browser matrix, load tests, retry/rate-limit soak tests against real Odoo 429s, security review, deployment runbook, staged rollout. | Release checklist passes, no critical security findings. | **In progress — security review + a11y spot-check + deployment runbook done; browser matrix/load/soak/staged rollout need live infra, tracked as a checklist** — see §6 |

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
revalidation is fetched but not yet used to short-circuit refetches. (The widget-grid placeholder and
dashboards-list `Spinner` noted here originally are now superseded by F4 and the skeleton-loader checkpoint
below.)

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
Per-widget skeleton loading was the other item noted here — now built, see below.

### Skeleton loaders (checkpoint, 2026-09-10)

Built the port described in §2, closing the gap flagged in both the F2 and F4 entries above.

**Built:**
- `src/app/globals.css` — `.skel-bar` + `@keyframes skel-sweep`, ported 1:1 from the addon's
  `skeleton-card.css` (same gradient-sweep technique, same 1.4s ease-in-out timing, same
  `prefers-reduced-motion` override), using this app's own tokens (`--muted`, `--radius-sm`) instead of the
  addon's literal hex values.
- `src/components/ui/skeleton.tsx` — the bar primitive (`Skeleton`).
- `src/components/dashboard/widget-skeleton.tsx` — `WidgetSkeleton`, all 6 shapes from
  `skeleton_card.xml`/`.js` (tile, chart, table, heatmap, map, note), same bar counts and proportions
  (7 chart bars at the exact same heights `[62, 88, 45, 74, 96, 55, 80]`, 6 table rows + 1 head row, 36
  heatmap cells). `bucketToVariant()` implements the full `ANALYTIC_TYPE_BUCKETS` mapping read from
  `dashboards.py:95-104` (table/pivot/matrix all collapse to the `table` variant, matching both the addon's
  own CSS comment and this app's `DashboardRenderer`, which already renders matrix through the same
  `<Table>` component as table).
- `src/components/dashboard/dashboard-card-skeleton.tsx` — `DashboardCardSkeleton`, for the dashboards-list
  grid. Not part of the addon's reference (that one only covers in-dashboard widget cards, since Odoo's own
  backend has no equivalent "list of dashboards" grid) — a same-primitive extension, not a guess at an
  unrelated pattern.
- `src/app/(app)/dashboards/page.tsx` — the full-grid `Spinner` while `isLoading` is now 6
  `DashboardCardSkeleton`s.
- `src/components/dashboard/dashboard-renderer.tsx` — `DashboardRenderer` takes a new `loading` prop; for
  any manifest item not yet present in the payload's `analytics_data` while `loading` is true, the grid slot
  renders `WidgetSkeleton` (variant from that item's own `bucket`) instead of `WidgetBody`. This matters
  beyond cosmetics: before this change, an in-flight item fell through to `WidgetBody` with no data fields,
  which rendered "No data for this view." — a false empty state, not a loading one.
- `src/app/(app)/dashboards/[id]/page.tsx` — passes `loading={payload.isLoading}` through; removed the now-
  redundant single "Loading widget data…" line above the grid.
- `eslint.config.mjs` — added `.vercel/**` to ignores (unrelated pre-existing gap found while linting this
  change: `.vercel/output/**`'s generated launcher script was tripping `no-require-imports`; harmless build
  output, not app code, excluded the same way `.next/**` already was).

**Verified:** `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass. **Not verified live/visually**
— the local Odoo instance used for earlier checkpoints is no longer running (`GET /mobile/v1/ping` timed
out), so an authenticated round trip showing real in-flight skeletons wasn't possible this session, and the
Chrome extension needed for a screenshot-based check (`mcp__claude-in-chrome__*`) reported "Browser
extension is not connected." A throwaway unauthenticated route rendering every skeleton variant with mock
data was built, build-verified, and deleted again rather than left in the tree — worth a quick visual pass
next time either the local Odoo instance or the Chrome extension is available.

### Deployment (checkpoint, 2026-09-09)

Deployed to Vercel via CLI (`npx vercel link --yes`, then `deploy --prod --yes`). Project
`umzs-projects/od-portal-web-app`, auto-connected to the `Um3rz/od-portal-web-app` GitHub repo during
`link`. Production URL: `https://od-portal-web-app.vercel.app`.

- `SESSION_SECRET` (required — `src/lib/session.ts` throws at import time without it) was generated fresh
  for the cloud environments (not the same value as the local `.env.local` dev secret) and added via
  `vercel env add SESSION_SECRET <production|preview|development> --value ... --yes`. The `development`
  value was flagged by the CLI as "looks like a credential" and stored as Config rather than Secret type —
  harmless (it's a random string with no other meaning), not worth fighting the heuristic for a dev-only var.
- `vercel link` also appended a `VERCEL_OIDC_TOKEN` line to local `.env.local` (Vercel's own CLI
  convention, unrelated to this app's session encryption) and added `.env.local` to `.gitignore` — already
  gitignored via the blanket `.env*` rule from the original scaffold, so this was a no-op re-confirmation,
  not a new exposure.
- **Verified live, not just "deploy succeeded":** `GET /` returns 200 and renders the onboarding form;
  `POST /api/tenant/register` rejects a private-IP origin (`https://127.0.0.1`) with the same SSRF error as
  local; the `http://localhost:8069` dev-only carve-out is confirmed **inert** in production (rejected with
  "Only HTTPS origins are allowed", since `NODE_ENV=production` on Vercel) — this was the one thing worth
  specifically re-checking post-deploy, since a carve-out that leaked into prod would be a real SSRF hole.
- Not yet done: no custom domain, no authenticated-flow smoke test against production (would need a real
  Odoo instance reachable from Vercel's network, not `localhost`), no monitoring/alerting wired up — F1's
  still-open "metrics" item applies here too.

### Bar chart order fix, star favourites, per-widget filter plan note (checkpoint, 2026-09-10)

**Fixed:** `src/renderers/chart-options.ts` — `horizontal_bar_chart`'s `yAxis` (a vertical category axis)
now sets `inverse: true`. ECharts renders category index 0 at the bottom of a vertical category axis by
default; since ranked rows (e.g. "Top 10 Customers") arrive from the backend already ordered
highest-first, the chart was rendering upside down (rank 1 at the bottom, rank 10 at the top) without this.

**Built:**
- `src/components/icon/icons.ts` — added a `star` icon (same 24×24/1.6-stroke convention as the rest of the
  ported set; not in the addon's original 79, since the addon doesn't use a star for favourites).
- `src/app/(app)/dashboards/page.tsx` and `src/components/layout/nav-rail.tsx` — both favourite-toggle
  buttons switched from the `plus-circle`/`check-circle` pair to a single `star` icon, filled
  (`fill-current`, overriding the icon set's default `fill="none"`) when `data-active="true"`.
- §3 above — added the per-widget filter affordance note, since the request's reference image showed a
  filter icon + date-range shortcuts on every widget card, which is a real product decision reversal from
  filters being dashboard-global only; flagged the backend constraint (no server-side per-widget filter
  concept in the given mobile API contract) rather than silently speccing a feature the backend can't serve.
  Not implemented yet — plan-doc-only per how this request was phrased, matching the skeleton-loaders
  checkpoint pattern.

**Verified:** `npm run lint`, `npx tsc --noEmit` pass. Not verified live (same Chrome-extension/local-Odoo
gap as the skeleton-loaders checkpoint above).

**Not done:** the actual per-widget filter-icon UI in `dashboard-renderer.tsx`'s card header — only the
plan note above exists so far. Say the word and it's a small addition (icon button next to the fullscreen
toggle, opening `FilterToolbar`).

### Bar chart fill, wide table/matrix cards, matrix→table port (checkpoint, 2026-09-10)

**Fixed:** `src/renderers/chart-options.ts` — horizontal bar chart's value axis (`xAxis`) now pins
`min`/`max` to the plotted data's own `0..max` range (computed from the built `series[].data`, not just the
raw `rows`, so it's correct for the multi-measure branch too) instead of letting ECharts round up to a
"nice" number above the data max. That auto-pad was the source of the large blank strip to the right of the
bars in "Top 10 Customers"-style charts. A first pass used the `max: "dataMax"` keyword; replaced with an
explicit computed number for certainty, and guarded: if any plotted value is negative, `min`/`max` are left
undefined so ECharts falls back to its own auto-range (a bar that pins `min: 0` would clip negative bars,
e.g. a negative profit series, right off the chart).

**Built:**
- `src/components/dashboard/dashboard-renderer.tsx` — `matrixColumnLabels()`, a matrix→table header port.
  Confirmed against two real reference implementations before writing this: Wags-POS-Saas's
  `matrixToTable.ts` and codename-portals' `table_model.js` (`deriveMatrixColumns`) independently agree on
  the wire contract — the backend's `get_matrix_data` already returns matrix as flat `columns: string[]` +
  `rows: any[][]`, the *same* shape `table` uses. `columns` holds machine keys, not labels; `column_tree`
  (one `{kind:"row_dim"}` node per pinned row dimension, one bucket node per column group with measure-alias
  `children` leaves) carries the display label for each key, which this port walks to relabel headers
  (`"<bucket> · <measure>"` when there's more than one measure, bucket label alone otherwise, dedup-suffixed
  on collision). `Table` now uses this for `analytic_type === "matrix"`, falling back to raw columns if
  `column_tree` is absent. This confirms and completes what `WidgetBody`'s switch already implied (`case
  "table": case "matrix": return <Table item={item} />`) — matrix was already routed to the table renderer,
  it just rendered raw machine-key headers instead of labels until now.
- `src/components/dashboard/dashboard-renderer.tsx` — `table`/`matrix` cards now span the full grid row
  (`sm:col-span-2 lg:col-span-3`, applied to both the real card and its loading skeleton) instead of sitting
  in one of three equal columns, so wide payloads get real horizontal room instead of needing a narrow
  scrollable `<table>`.

**Verified:** `npm run lint`, `npx tsc --noEmit` pass. Not verified live/visually (same Chrome-extension/
local-Odoo gap noted in the skeleton-loaders checkpoint).

### F5 — Workflow parity (checkpoint, 2026-09-10)

Ported directly from the reference mobile client (`codename-portals`), not designed from scratch: its
`app/(tabs)/alerts.tsx` (combined inbox + alert-rules screen), `components/AlertSheet.tsx` (per-widget alert
creation), and `app/(auth)/key.tsx`'s `probeExternal()` heuristic all mapped over with minimal adaptation.

**Built:**
- `src/lib/api.ts` — `MobileNotification`, `AlertRule`, `AlertRuleInput` types and
  `notifications`/`markNotificationRead`/`alerts`/`createAlert`/`deleteAlert` client methods, 1:1 against
  the `controllers/mobile.py` routes in §1. No new BFF route handlers were needed — the existing
  `/api/odoo/[...path]` proxy already allow-lists the whole `/mobile/v1/` prefix (F1), so these routes were
  already reachable; F5 only needed the typed client + UI on top.
- `src/hooks/use-notifications.ts`, `src/hooks/use-alerts.ts` — thin React Query wrappers (list + mutations
  that invalidate their own list on success), matching this app's existing hook style.
- **External-grant detection** — `src/app/api/tenant/register/route.ts` now probes
  `GET /mobile/v1/notifications` with the just-verified key right after registration succeeds; a 404 means
  the key is an external-access grant (`_internal_mobile_or_404` in `mobile.py`), stored as
  `session.isExternalGrant` (the field already existed on `OdooSessionData`, just unpopulated until now).
  Same heuristic as the reference mobile client's `probeExternal()` — no invented detection logic.
- `src/components/session-provider.tsx` — a one-boolean client context, populated once from the session in
  `(app)/layout.tsx` (already a server component reading the session) and read by `nav-rail.tsx`,
  `dashboard-renderer.tsx`, and `alerts/page.tsx` to hide internal-only UI for external grants instead of
  letting it fail with a 404 — mirrors the reference client's `profile.isExternal` tab-hiding
  (`(tabs)/_layout.tsx`).
- `src/components/dashboard/alert-dialog.tsx` — per-widget "alert me when…" form, ported field-for-field
  from `AlertSheet.tsx`: operator chips (below/above/drops_pct/rises_pct/below_target), a free-text column
  field (no endpoint enumerates a dataset's columns, so this stays text input same as the reference),
  conditional threshold/window fields, aggregate/any-row scope toggle. Triggered from a new icon button in
  each widget card's header (`dashboard-renderer.tsx`, hidden for external grants) — **alerts are always
  created in the context of one widget, there is no standalone "pick a dashboard, then a widget" form**,
  matching the reference client's "Create an alert from a dashboard widget's ⋯ menu" pattern exactly rather
  than inventing a heavier picker flow.
- `src/app/(app)/alerts/page.tsx` — combined inbox + alert-rules screen (same single-screen layout as the
  reference `alerts.tsx`): unread notifications are visually distinguished and mark-as-read on click, capped
  at 15 visible with a "View more" reveal (no extra request, same 200-row server cap the reference relies
  on — technical_plan.md §1's "don't build delta-merge logic" note applies here too); alert rules list with
  a Remove action. External grants see a dedicated "not available for this account" state instead of a
  generic error, both proactively (via the session flag) and reactively (if a 404 slips through).
- `src/components/layout/nav-rail.tsx` — an "Alerts" entry above the dashboard list, with an unread-count
  badge (`useNotifications`), hidden for external grants.
- `src/components/layout/topbar.tsx` — the "Disconnect" button now confirms first: §1 explicitly flags that
  `POST /mobile/v1/logout` revokes **every** `scope="mobile"` key for the uid, not just this session's, and
  this was previously called silently.

**Scoped down, on purpose:** "session/profile management" from the roadmap row is the external-grant
detection + the logout warning above, not a standalone profile-editing page — `controllers/mobile.py` has no
profile/account endpoint at all (confirmed by reading the full controller), so building profile-editing UI
would be speccing a feature the backend can't serve, the same category of gap flagged for per-widget filters
in §3. `POST /mobile/v1/devices` (push registration) stays an explicit non-goal per §1, unchanged.

**Verified:** `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass (`/alerts` compiles as a new
route). Not verified live — same Chrome-extension/local-Odoo gap noted in every checkpoint since skeleton
loaders; in particular the external-grant probe and the alert-creation round trip both need a real Odoo
instance to exercise.

### F6 — reverted builder, real per-widget filters, table aggregation (checkpoint, 2026-09-10)

**Reverted:** the builder-ready theme shell built earlier the same day (`dashboards/[id]/builder`,
`configurations/{api,advanced}`, nav-rail "Configurations" section, `VIZ_TYPES`, Topbar `actions` slot,
exported `WidgetBody`/`PayloadItem`). Product call: this app views dashboards authored in Odoo, full stop —
not a builder, not a later-phase builder either. All F6-builder files deleted, all edits reverted to their
pre-builder state; confirmed clean with a fresh `.next` + `npm run build`.

**Built instead — real per-widget filters**, not the affordance-only version originally planned (the old
"backend can't do per-widget filtering" conclusion in §3 was wrong — corrected there):
- `src/lib/widget-presets.ts` — `WIDGET_PRESETS` (Y/1D/7D/30D/MTD/YTD) + `dateForWidgetPreset()`, the
  reference image's exact preset set (distinct from the dashboard-level toolbar's `1D/1W/1M/3M/6M/YTD/1Y/ALL`).
- `src/components/filters/filter-toolbar.tsx` — new `hideToggle` prop: renders the field panel directly
  (no internal "Filters" pill, no redundant second toggle) so it can be embedded inline per-widget while the
  dashboard-level toolbar keeps its own collapsed-by-default behavior unchanged.
- `src/components/dashboard/dashboard-renderer.tsx` — per-widget filter row (`WidgetFilterRow`: preset
  chips + a filter icon with an active-filter-count badge + a clear button) in every card except sticky
  notes; `OverriddenWidget` fetches its own scoped payload (`useDashboardPayload(dashboardId, filters,
  [manifest.id])`) only for widgets that actually have an override set — every other widget keeps coming
  from the dashboard's single shared bulk fetch, so setting one widget's range doesn't add a request for its
  siblings. `DashboardRenderer` takes a new `descriptors` prop (the dashboard's `global_filters`, passed
  from `[id]/page.tsx`) so the per-widget panel can reuse the same field set as the dashboard-level one.

**Built — table & matrix aggregation** (the reference image's toolbar Σ icon, and the "sum, group by" ask):
- `numericColumnIndexes()` — a column counts as summable only if every non-empty cell in it parses as a
  finite number, same rule codename-portals' `table_model.js` uses, so "what's summable" doesn't drift
  between clients even though there's no shared package between them.
- `Table` now has a small toolbar: a **Group by** column picker (client-side, groups rows by that column's
  string value in first-seen order, each group gets a subtotal row over its own numeric columns) and a **Σ
  Totals** toggle (grand-total footer row). Both are pure client-side derivations over rows already fetched
  — no backend change, works identically for `table` and `matrix` (which already renders through the same
  component).

**Verified:** `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass. Not verified live/visually —
same Chrome-extension/local-Odoo gap as every checkpoint since skeleton loaders; the override-fetch path and
the group-by/totals math in particular need real multi-row table data to see rendered rather than reasoned
about.

### F7 — carousel home view + gallery switcher (checkpoint, 2026-09-10)

**Built** — `/dashboards` now has two view modes, switched via a new topbar toggle (only shown on that
route) and remembered per browser in `localStorage` (`odsaas-dashboards-view-mode`, defaults to `carousel`):

- `src/components/view-mode-provider.tsx` — `ViewModeProvider`/`useViewMode`, wrapping the whole `(app)`
  layout (alongside `SessionProvider`) so both `Topbar` (renders the switcher) and the `/dashboards` page
  (reads which view to render) share state without prop drilling through the server layout.
- `src/components/dashboard/dashboard-view.tsx` — the single-dashboard content (filters + `DashboardRenderer`)
  extracted out of `dashboards/[id]/page.tsx` into a reusable `DashboardView({ dashboardId })`, now used by
  both the detail route and each carousel slide. Root height changed from `flex-1` to `h-full` so it composes
  correctly as either a lone flex child (route page) or a fixed-height slide.
- `src/components/dashboard/dashboard-gallery.tsx` — the pre-existing card-grid picker, moved verbatim out of
  `dashboards/page.tsx` into its own component, unchanged.
- `src/components/dashboard/dashboard-carousel.tsx` — new default view. Dashboards ordered favourites-first
  (via `useFavourites`) then the rest, so a starred dashboard loads immediately on landing, matching the
  reference mobile app. Structure: a name-picker strip beneath the topbar (click any name to jump), a sliding
  track (`translateX(-${index * 100}%)` with a CSS transition — all dashboards mounted so the slide animates
  between real content, not a placeholder-then-load), and a bottom bar with prev/next arrow buttons plus dot
  indicators (both drive the same `index` state as the name picker). Index is clamped inline
  (`Math.min(rawIndex, ordered.length - 1)`) rather than synced via an effect, since `react-hooks/set-state-in-effect`
  flags synchronous `setState` in `useEffect` — same reasoning applied to `ViewModeProvider`'s localStorage
  read, switched to lazy `useState(() => ...)` init instead of an effect.
- `src/app/(app)/dashboards/page.tsx` — now just `mode === "gallery" ? <DashboardGallery /> : <DashboardCarousel />`.
- `src/app/(app)/dashboards/[id]/page.tsx` — now just unwraps the route param and renders `<DashboardView />`.

~~Deliberately skipped: syncing the topbar's dashboard-name dropdown to the carousel's active slide.~~
Superseded below — the dropdown is now removed entirely from the carousel view, so there's nothing left to
sync; it only remains in the gallery view (and on the detail/alerts/settings screens) where the current
dashboard tracks the URL as before.

**Verified:** `npm run lint`, `npx tsc --noEmit` (via `npm run build`), and `npm run build` all pass clean.
Not verified live — no Chrome extension connection available this session (same gap noted on prior
checkpoints); the slide animation and favourites-first ordering in particular need a real multi-dashboard
tenant to eyeball.

**Post-checkpoint fixes (same day, visual-review pass against the carousel/filter UI):**
- `src/components/layout/topbar.tsx` — the "Dashboards ▾ / All dashboards" dropdown picker now only renders
  when NOT on `/dashboards` in carousel mode (`showPicker = !(isDashboardsHome && mode === "carousel")`); the
  carousel shows a plain static "Dashboards" label instead, since its own name-picker strip already covers
  that job. Unchanged everywhere else (detail page, alerts, settings, gallery view).
- `src/components/icon/icons.ts` — added a real `bell` glyph. The Alerts nav link has called
  `<Icon name="bell" />` since F5, but no `bell` icon existed in the ported 68-icon set, so it was silently
  falling back to `help` (a question mark) the whole time.
- `src/components/dashboard/dashboard-carousel.tsx` — the bottom prev/next-arrows-and-dots bar was a
  full-width bordered strip (`border-t border-border bg-surface`); changed to a floating rounded pill
  (`absolute inset-x-0 bottom-4`, centered, `shadow-[var(--shadow-overlay)]`) over the slide content, matching
  the reference floating-nav pattern. The outer wrapper is `pointer-events-none` with the pill itself
  `pointer-events-auto` so it doesn't block scrolling/clicks elsewhere in the slide; each slide gets `pb-20`
  (via a `[&>div]:pb-20` selector on `DashboardView`'s scroll container) so the pill doesn't sit over the last
  row of widget content.
- `src/renderers/chart-options.ts` — horizontal bar charts had a large empty gutter before the category
  labels even started. Cause: `grid.left: 132` was stacked *in addition to* `containLabel: true`, which
  already auto-reserves space for the y-axis labels (up to `yAxis.axisLabel.width: 124`) on top of `grid.left`
  — so the chart was reserving roughly double the needed left margin. Changed `grid.left` to `12` (a small
  margin before the auto-reserved label space, not an extra fixed offset in front of it).
- `src/components/filters/filter-toolbar.tsx` — the date-range card's From/To inputs sat in a `grid-cols-2`
  row; inside the ~20rem per-widget filter popover that left each native `<input type="date">` only ~140px,
  too narrow for Chrome to render its placeholder text + calendar-picker icon without garbling. Changed to
  `grid-cols-1` (always stacked, full width) — same fix applies to the dashboard-level toolbar's wider layout,
  just with more headroom to spare.
- `src/components/dashboard/dashboard-renderer.tsx` (`WidgetCard`) — the widget-filter popover is an
  absolutely-positioned child taller than most cards, especially tiles/sticky notes. The card's own
  `overflow-hidden` (needed the rest of the time, to keep chart/table content from bleeding past the card
  edge) was clipping the popover's bottom half instead of letting it float over whatever sits below the card
  — visible as the popover appearing to overlap/cut into neighboring grid cells. Now the card switches to
  `overflow-visible` only while its own filter popover is open (`const overflow = filterOpen ?
  "overflow-visible" : "overflow-hidden"`).

All six re-verified with `npm run lint` and `npx tsc --noEmit` after each change; not re-verified live (same
Chrome-extension gap).

### F8 — release hardening (in progress, checkpoint, 2026-09-10)

F8 is broad (accessibility, browser matrix, load tests, retry/rate-limit soak tests, security review,
deployment runbook, staged rollout) and several of those items need infrastructure this environment doesn't
have (a live multi-browser matrix, a load-test target, a real Odoo instance to soak-test 429 handling
against). This checkpoint covers what's actually actionable here — a source-level security review, a
source-level accessibility pass, dead-code removal, and the deployment runbook — and turns the rest into an
explicit manual checklist rather than leaving them silently undone.

**Security review — one real finding, fixed:**

- `src/app/api/odoo/[...path]/route.ts` — **path-traversal bypass of the `/mobile/v1/` allow-list.** The
  catch-all route's segments are decoded by Next.js before reaching the handler, but `.`/`..` segments are
  NOT collapsed at that point — that normalization only happens later, inside `fetch()`'s URL parser, when
  `${origin}${upstreamPath}` is resolved as a full URL in `callOdoo()`. A request like
  `/api/odoo/mobile/v1/%2e%2e/%2e%2e/web/login` decodes to segments `["mobile","v1","..","..","web","login"]`,
  and `upstreamPath.startsWith("/mobile/v1/")` is true for the *joined, pre-normalization* string
  (`/mobile/v1/../../web/login`) — but once that string is hit with `fetch()`, URL normalization collapses
  the dot-segments and the actual outbound request becomes `${origin}/web/login`. That's an allow-list bypass
  using the tenant's own stored API key against arbitrary paths on their Odoo instance, not just the
  documented mobile contract. Fixed by rejecting any path segment that is exactly `.` or `..` outright,
  before the prefix check ever runs, rather than trying to validate a string that a later layer will
  renormalize differently.
- Re-read `src/lib/ssrf.ts`, `src/lib/odoo-client.ts`, `src/lib/session.ts`, `src/app/api/tenant/{register,
  logout,status}/route.ts` end to end: origin re-validated per-request (TOCTOU window is documented and
  intentionally narrow, not zero — see the doc comment in `ssrf.ts`), `redirect: "manual"` everywhere Odoo is
  called so nothing silently follows a redirect off the validated origin, API key never logged or echoed
  back to the client, session cookie is `httpOnly`/`sameSite: lax`/`secure` in production, `SESSION_SECRET`
  is a hard startup failure if unset or short. No further changes made here — see the runbook below for the
  one operational assumption (`X-Forwarded-For` trust) this code depends on but can't itself enforce.

**Accessibility — spot-checked, one dead file removed:**

- Confirmed the app-wide `:focus-visible` ring (`globals.css`, `.o_dsaas :focus-visible`) is still applied at
  the `<html>` level (`layout.tsx`'s `className` includes `o_dsaas`) and every icon-only button added across
  F5–F7 (alert/filter/fullscreen/carousel-nav/view-switcher buttons) already carries an `aria-label`; the one
  decorative `<Image>` (the topbar logo) correctly uses `alt=""` since the adjacent text + the parent link's
  own `aria-label="Odoo Dashboards home"` already announce it — no silent double-announcement, no missing
  label found in a fresh grep pass.
- `src/components/layout/nav-rail.tsx` — deleted. Dead code: nothing imports it (`layout.tsx` renders `Topbar`
  directly, no sidebar), confirmed via a repo-wide grep before deleting. Left over from before the
  topbar-based layout replaced a rail-based one; kept accumulating unreachable Alerts/favourites markup that
  would otherwise mislead the next accessibility or code pass into auditing UI no user can ever reach.

**Deployment runbook (new):**

1. **Required env:** `SESSION_SECRET` (random string, ≥32 chars — the app hard-fails at startup otherwise,
   see `session.ts`). No other app-level env vars exist as of this checkpoint (confirmed via a repo-wide
   `process.env.*` grep) — Odoo origin/API key are supplied per-tenant at runtime through onboarding, not
   env config.
2. **Build/run:** `npm run build` then `npm start` (Next.js standalone/production server). `npm run lint` and
   `npx tsc --noEmit` should both be clean before any deploy — both are part of this repo's normal checkpoint
   verification, not a new CI step being introduced here.
3. **Reverse proxy requirements** (the app assumes, but cannot itself enforce, these):
   - **Must strip any client-supplied `X-Forwarded-For` and set its own.** `src/app/api/tenant/register/
     route.ts`'s per-IP registration rate limit reads `X-Forwarded-For` directly (`clientIp()`) — behind a
     proxy that passes through a client-supplied value unmodified, that limit is trivially spoofable.
   - **TLS terminates at the proxy** (or the app serves HTTPS directly) — the session cookie is `secure` in
     production (`NODE_ENV=production`), so it will not be set at all over a plain HTTP connection.
   - Standard headers only; no special CORS/CSP config is required by anything in this codebase today (no
     cross-origin API calls are made — the browser only ever talks to this app's own `/api/*` BFF routes).
4. **Horizontal scaling caveat:** `src/lib/rate-limit.ts`'s buckets are an in-memory `Map` — correct for one
   Next.js instance, silently ineffective (each instance has its own counters) the moment this runs behind a
   load balancer with more than one instance. Documented with an upgrade path in that file (swap the Map for
   Redis `INCR`+`EXPIRE`); **do not scale horizontally before making that swap**, or registration/BFF rate
   limits stop actually limiting anything.
5. **Rollback:** stateless app (all durable state — dashboards, filters, alerts — lives in Odoo; the only
   client-side state is the encrypted session cookie and each browser's own `localStorage` favourites/
   view-mode), so rollback is just redeploying the previous build. No migrations, no data backfill.

**Manual checklist — not executable in this environment, left explicitly open rather than silently skipped:**

- [ ] Browser matrix: latest Chrome/Firefox/Safari/Edge, desktop + the 390px mobile breakpoint named in
  `odoo_dashboards_web_app_plan.md` §3.5.
- [ ] Load test against a real deployment (concurrent sessions, dashboard payload fan-out).
- [ ] Soak test retry/rate-limit handling against a real Odoo instance's actual 429s (not just the
  pass-through code path, which is covered, but the client-side retry/backoff behavior under sustained load).
- [ ] Confirm the reverse-proxy `X-Forwarded-For` requirement above is actually configured correctly in the
  target environment (this is a deployment-config check, not something the app can self-verify).
- [ ] Staged rollout: no infra-specific rollout plan exists yet (canary %, feature-flag gating, etc.) —
  needs the target deployment platform decided first; out of scope for this checkpoint.

**Verified (what could be):** `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean after
the path-traversal fix and the `nav-rail.tsx` deletion.

## 7. Open questions (not yet blocking)

- `customer_ageing_report` shares the `TableRenderer` styling in the addon (`REDESIGN.md` Part 9 #3) and
  has a dedicated `ageing` icon, but isn't named in the product plan's F4 widget list. Confirm whether it's
  in v1 scope or deferred with map/pivot.
- Web push (`POST /mobile/v1/devices`) has no browser-BFF equivalent unless web push is added; confirm
  it's a non-goal rather than silently unimplemented UI.
- `GET /mobile/v1/ping` returns `min_app_version`/`contract_version` — decide the web app's own version
  string and what "hard stop" UI looks like on mismatch, since unlike the mobile app there's no app-store
  gate forcing an update.
