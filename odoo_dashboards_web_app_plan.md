# Odoo Dashboards Web App — Next.js Technical Plan

## 1. Goal and product boundary

Build a centrally hosted, multi-tenant Next.js dashboard web app that shares the mobile app’s viewer capabilities and Odoo’s existing dashboard semantics. The web app is a thin UI/BFF over the Odoo mobile API; filtering, visibility, payload generation, alert evaluation, and dashboard permissions remain owned by `odoo_dashboards_saas`.

The first release covers:

- dashboard catalog, search, favourites, and dashboard detail;
- responsive dashboard rendering and fullscreen widgets;
- date, numerical, eager multiselect, and lazy typeahead filters;
- tile, sticky note, bar, line, area, doughnut, funnel, table, heatmap, and matrix widgets;
- cached/offline read state, alerts, notification inbox, and notification read state;
- internal API-key users and external time-limited dashboard grants, with the same restrictions enforced by Odoo.

Map and pivot rendering remain explicit v1 exclusions, matching the mobile scope. Dashboard authoring/builder editing is a later phase; this plan establishes the visual foundation so the viewer and future builder share one design system.

## 2. Decisions and architecture

### Deployment and identity

- The app is centrally hosted, so dashboard data transits the Next.js BFF. This is an intentional difference from the mobile app’s direct-to-Odoo topology.
- Users register an Odoo HTTPS origin and paste an Odoo mobile API key. Password/SSO login is not added to v1.
- The API key is held only in an encrypted server-side session and is never exposed to browser JavaScript, URLs, logs, React Query persistence, or analytics.
- Tenant origins are self-service but are validated on every outbound request: HTTPS only, no credentials, no redirects, no loopback/private/link-local/reserved IPs after DNS resolution, restricted outbound ports, and DNS-rebinding checks.

### BFF and Odoo contract

Reuse the `feature/mobile-app-access_control` contract from `odoo_dashboards_saas`:

`GET /mobile/v1/ping`, `POST /logout`, `GET /dashboards`, `GET /dashboard/:id`, `POST /dashboard/:id/payload`, `GET /notifications`, `POST /notifications/:id/read`, and `GET/POST/DELETE /alerts`.

The branch currently has no protected mobile lazy-filter route. Add:

`POST /mobile/v1/dashboard/:id/filter_values`

It must validate dashboard visibility and condition ownership before calling `get_filter_values_lazy`. Do not route the web app through legacy `/api/v1/*` controllers.

**2026-09 `odoo_dashboards_saas` alerts/notifications rewrite** (server-side only — the wire contract above is unchanged, so this doesn't add F0 scope, just changes what the BFF can promise the web client):

- Delivery is now event-driven instead of a 15-min blind poll: `optimize_analytic()` (both the per-dashboard cron loop and the manual "Refresh Data" button) calls a new `data.analytics.saas._publish_alert_check()` right after a widget's data actually refreshes, which runs `_evaluate_and_notify()` (the old `_evaluate_due_alerts` body, refactored to be reusable). `_cron_mobile_notify` now only sweeps rules with no optimize-refresh event to hook into, and its interval dropped 15min → 3min since its job shrank. Net effect: a notification can land within the triggering dashboard's own refresh cadence, not up to 15 minutes late. The BFF/web client should therefore favor fetch-on-open/focus over any polling interval, same as the mobile client (§ below).
- Retention is server-side: a nightly cron (`_gc_old_notifications`, configurable via `dashboards.mobile.notification_retention_days`, default 30) plus a manual `action_clear_last_30_days()`. The web app does not need its own retention/clear logic unless product wants to expose the same action.
- Security: evaluating a rule can now happen inside a non-admin user's request (their manual refresh), and may need to write a notification owned by a different user. This is handled with a narrowly-scoped, documented `sudo()` on the write path only — each rule's own data read still runs `with_user()`-scoped to its owner. Relevant to this plan's Authorization verification row: the BFF must keep treating `/alerts` and `/notifications` as opaque per-user operations and not attempt its own cross-user notification writes.
- A new Odoo-side "Alerts" admin UI (`views/alerts_manager_view.xml`, OWL client action) replaced the classic tree/form Alert Rules menu, with Rules + History tabs and the retention "Clear last 30 days" button. This is an Odoo backend admin surface, not part of the mobile/web contract — no action needed here, but it's the reference if F6's builder-ready theme ever grows an equivalent.

The BFF exposes same-origin `/api/odoo/*` handlers, normalizes upstream errors, preserves 401/404/429 semantics, and never makes authorization decisions that belong to Odoo. External grants continue to receive only their allow-listed dashboards; device registration, alerts, and inbox remain unavailable for external identities because the Odoo API returns 404 for those operations.

### Rate limits and retry policy

Rate limiting exists from the first phase:

- per-IP tenant registration and failed-key attempts;
- per-session request limits;
- per-tenant outbound request limits;
- global upstream concurrency and request budgets.

All limits return `429` with `Retry-After`. The browser client uses bounded exponential backoff with full jitter for idempotent GETs and safe payload reads only. It does not automatically retry 401/403/404, validation failures, alert mutations, logout, or notification writes. Backoff state resets after a successful response and is observable through structured metrics.

## 3. Frontend theme and visual system

The screenshot is the visual reference for the Next.js app: white surfaces, cool gray workspace chrome, strong indigo primary actions, compact dense controls, rounded cards, thin borders, and a three-region builder composition (navigation rail, analytics-item list, configuration/preview workspace).

### 3.1 Theme ownership and scoping

Create a shared theme package consumed by the viewer now and the future builder. Every token is scoped under `.o_dsaas`; never use `:root`, so the theme cannot leak into Odoo’s backend chrome when the viewer is embedded or opened inside Odoo.

Required token groups:

- typography: `--font-family-body`, `--font-family-heading`, weights, sizes, and line heights;
- color: background, surface, muted surface, foreground, muted foreground, border, primary indigo scale, success, warning, danger, and informational states;
- layout: spacing scale, sidebar width, topbar height, content max-width, widget gaps, and breakpoints;
- shape/elevation: radii, focus ring, card shadow, modal shadow, and divider color;
- chart palette: stable categorical/series colors shared with the mobile renderer;
- decorative notes: `--note-surface: hsl(45 90% 94%)` and `--note-border: hsl(45 60% 82%)`. These names must never be aliased to `--warning-*`.

Include the approved `@font-face` block from the Odoo redesign work. The same font stack and numeric formatting rules must be used in dashboard cards, tables, filters, and builder controls.

### 3.2 Icon component and fallback layer

Implement `Icon({ name, size })` as an inline SVG with `viewBox="0 0 24 24"`, `currentColor`, round line caps/joins, and sizing driven by `font-size`.

Keep a single alias map for legacy Font Awesome names (`filter`, `pencil`, `cog`, `bars`, `ellipsis-h`, `caret-down`, `info-circle`, and related names). Unknown names resolve to a visible `help` icon; they must never render an empty box. In development, unresolved names log a warning.

Typed helpers provide safe defaults for open-ended domains:

- `vizIcon(analyticalType)` maps all current visualization types and falls back to `tile`;
- `fieldIcon(fieldType)` maps Odoo field types and falls back to `type-char`.

The builder-blocking icon set includes calculator, magic/AI, clock, sorting, columns, paper-plane, hashtag, percent, and tag. Viewer-only icons such as slideshow controls can remain deferred until that feature is scheduled.

### 3.3 Shared primitives

Create CSS primitives matching the Odoo redesign conventions:

`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-outline`, `.btn-danger`, `.inp`, `.tag`, `.lozenge`, `.card`, `.modal`, `.tabs`, `.empty-state`, `.tbl`, and `.dsaas-spinner`.

Focus treatment replaces the border instead of stacking a second border. `tag` is an outlined classification label; `lozenge` is a semantic tinted status with a leading dot. Replace Font Awesome spinner usage with a CSS bordered-circle spinner and keyframe.

### 3.4 Layouts

Viewer layout:

- left navigation rail with product title, collapse control, Odoo/dashboard navigation, and grouped configuration links;
- top bar with back navigation, dashboard title/subtitle, settings/filter/open-dashboard actions, and primary “New item” action where builder controls are enabled;
- dashboard workspace with filter toolbar, responsive widget grid, status badges, and offline/as-of banner.

Builder-ready layout (future phase, but theme-compatible now):

- left rail: “Odoo Dashboards”, Configurations, API Configuration, Advanced Configuration, and dashboard shortcuts;
- analytics-items column: count badge, collapse affordance, icon, item name, analytical type, selection state;
- main configuration panel: toolbar, General/Configuration/Filters tabs, form controls, visualization picker, and destructive actions;
- live-preview panel: refresh button, empty state, and widget preview surface.

At widths below the desktop breakpoint, collapse the rail to a drawer, stack configuration and preview panels, turn the analytics-item column into a horizontal/overlay selector, and keep filters reachable without horizontal page scroll. Tables scroll within their own container.

### 3.5 Theme acceptance criteria

- Every interactive control has a visible keyboard focus state and minimum touch target.
- No Odoo global styles are changed outside `.o_dsaas`.
- Unknown icons, analytical types, and field types always render a visible fallback.
- Screenshot review covers desktop builder proportions, 1280px dashboard viewer, tablet, and 390px mobile browser layouts.
- Color contrast, loading, empty, error, offline, and disabled states use the same primitives as successful states.

## 4. Data and UI behavior

### Dashboard hydration

Use React Query with stable keys containing tenant, session identity, dashboard ID, item batch, range filter, global-filter hash, and refresh token. Hydrate widgets in bounded type-aware batches, cancel obsolete requests, and ignore late responses from superseded filter runs. A slow widget must not block already-completed cards.

### Filters

- Date/date-time descriptors use `range_filter { fromDate, toDate }`, support range/as-at mode and presets (1D, 1W, 1M, 3M, 6M, YTD, 1Y, All).
- Numerical descriptors use the existing `AppliedGlobalFilter` wire shape.
- Multiselect descriptors support inline values and lazy typeahead with 300 ms debounce, loading, truncation, timeout, and retry states.
- Draft values do not refetch. Apply commits the filter hash; Reset returns to the unfiltered cache key.
- Render `global_filter_unapplied` exactly as returned by Odoo (“Not filtered by …”).

**Reference implementation shipped in the mobile app** (`codename-portals`, 2026-09-08, commit `241e33a` + follow-ups): client-side multiselect (eager + lazy typeahead) and numerical global filters, using exactly this draft/commit pattern (`GlobalFilterRow` component) so keystrokes never refetch. Both the date-range panel and each multiselect row render collapsed by default behind a dropdown-style header (light-gray pill, tap to expand) rather than always-open inputs — worth matching in F3 for visual consistency between clients. Per-widget filtering does not exist and is not planned; filters are dashboard-global, and a widget either applies them or shows the `global_filter_unapplied` badge, based solely on whether its dataset has the matching column.

### Alerts and notification inbox

- No polling on either client. Mobile (`codename-portals`) fetches `GET /notifications` and `GET /alerts` on tab focus (`useFocusEffect` invalidating those query keys) and on pull-to-refresh, plus invalidates on a received push while foregrounded — never on a timer. The web app should do the same: refetch on tab/window focus (`visibilitychange`, the browser has this natively — React Query's `refetchOnWindowFocus` needs no extra plumbing here, unlike React Native) and on an explicit refresh action, not a `setInterval`.
- `GET /mobile/v1/notifications?since=` accepts an optional cursor but the mobile client currently always does a full fetch (capped at 200 rows server-side) rather than merging a `since` delta into the cached list — full replace is simpler and the capped payload is cheap. Revisit only if 200 rows stops being cheap.
- Server-side retention (see §2) means neither client needs its own "clear" UI to stay usable; it's optional product surface, not a correctness requirement.

### Rendering and cache

Reuse extracted Odoo option/model builders where available so web and mobile charts cannot drift. Unknown types render an Unsupported card; widget payload errors render an Error card with retry. Cached data is immediately visible with an “as of” timestamp and read-only/offline status.

## 5. Phased roadmap and tracker

| ID | Phase | Work | Acceptance | Status |
|---|---|---|---|---|
| F0 | Contract hardening | Audit `feature/mobile-app-access_control`; add protected lazy filter route; publish shared JSON fixtures and error contract. | Mobile and web clients pass identical contract fixtures. | Planned |
| F1 | Foundation/security | Next App Router shell, `.o_dsaas` tokens, fonts, Icon/default-icon layer, primitives, session encryption, tenant SSRF controls, BFF, rate limits, metrics. | Tenant/key secrets are redacted; malicious origins rejected; 429 and `Retry-After` verified. | Planned |
| F2 | Viewer shell | Onboarding, dashboard list/search, metadata/detail, navigation rail, topbar, responsive widget grid, favourites, offline cache. | A user sees only Odoo-authorized dashboards and can reload cached data offline. | Planned |
| F3 | Filters | Date presets, numerical inputs, eager/lazy multiselect, apply/reset, filter hashing, cancellation, unapplied badges. | Filter behavior matches Odoo/mobile fixtures and never shows stale results. | Planned |
| F4 | Renderer parity | Tile, sticky note, charts, table, heatmap, matrix, fullscreen, unsupported/error cards. | Payload/options and visual snapshots match mobile/Odoo fixtures. | Planned |
| F5 | Workflow parity | Alerts CRUD, notification inbox/read state, external-grant restrictions, session/profile management. | Internal users can create/read/delete rules; external users cannot access internal-only routes; inbox reflects a notification within the triggering dashboard's own refresh cadence (now event-driven server-side, see §2), not a fixed poll interval. | Planned — mobile has a shipped reference implementation (inbox + rules screen, fetch-on-focus, no polling) |
| F6 | Builder-ready theme | Builder three-region shell, analytics item list, configuration tabs, visualization picker, live-preview empty/loading states, shared forms. | Supplied design reference is reproduced at desktop and remains usable responsively. | Planned |
| F7 | Release hardening | Accessibility, browser matrix, load tests, retry/rate-limit soak tests, security review, deployment/runbook, staged rollout. | Release checklist passes with measured performance and no critical security findings. | Planned |

## 6. Verification matrix

- Contract: every reused endpoint, lazy filter route, status code, timeout, and malformed payload.
- Authorization: dashboard/menu visibility, widget visibility, external allow-lists, tenant isolation, and no BFF authorization drift.
- Filters: presets, as-at dates, numerical values, multi-value OR behavior, lazy search, truncation, timeout, reset, and unapplied widgets.
- Rendering: each supported analytical type, unknown type, server widget error, empty data, large numbers, tables, and fullscreen.
- Resilience: offline cold start, stale-while-revalidate, request cancellation, exponential backoff with jitter, rate-limit recovery, and upstream outage messaging.
- Security: key redaction, encrypted sessions, CSRF/session fixation, origin validation, DNS rebinding, redirect blocking, SSRF/private-address rejection, and abuse limits.
- Visual/accessibility: keyboard navigation, focus rings, contrast, screen-reader labels, responsive breakpoints, and screenshot comparison against the supplied builder reference.

## 7. Assumptions

- The source branch is `feature/mobile-app-access_control`; `feature/mobile-app-access` is not present locally.
- Odoo remains the source of truth for authorization and dashboard semantics.
- API-key paste is the only v1 authentication flow.
- Favorites and layout preferences are local to each web/mobile client in v1; cross-platform preference synchronization is a later API decision.
- The web app is viewer-first. Builder editing is represented in the shared theme and scheduled as a later capability phase.
- The mobile app (`codename-portals`, this repo) is ahead of this plan and is the running reference for contract behavior: Phases 2–4 are shipped, including client-side global filters (multiselect/numerical, dropdown-style collapsed panels), the alerts/notification inbox with fetch-on-focus (no polling), and a biometric app-lock (device-only; the web app has no equivalent — it relies on the encrypted server-side session instead, per §2 Deployment and identity). It is currently in store-submission prep (`app.json`, legal pages, EAS build config) — none of that is web-app scope, noted only so this plan doesn't re-derive decisions the mobile client already made.
- `odoo_dashboards_saas`'s alerts/notifications backend was rewritten 2026-09 to be event-driven (§2); the `/mobile/v1/notifications` and `/mobile/v1/alerts` wire contract itself did not change, only server-side delivery latency and retention.
