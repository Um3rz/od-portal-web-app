# Odoo Dashboards — Web App

A Next.js (App Router) web client for the Odoo Dashboards module. Lets a user
connect one or more Odoo servers via an external API key and view/interact
with the same dashboards (tiles, charts, tables/matrices, heatmaps, alerts)
the mobile app renders, from a browser.

## Stack

- Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS 4
- `@tanstack/react-query` for data fetching, persisted to `localStorage`
  (cached dashboards paint instantly on reload, then revalidate)
- `@tanstack/react-table` for the table/matrix widget's toolbar
- `iron-session` for the encrypted, httpOnly session cookie (holds every
  connected Odoo account's API key server-side; never sent to the browser)
- `echarts` for chart widgets, `framer-motion` for UI transitions
- PostHog for product analytics (`posthog-js` client, `posthog-node` server)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit # type-check
```

Requires a `SESSION_SECRET` env var (32+ random characters) to encrypt the
session cookie — see `src/lib/session.ts`.

## Project structure

- `src/app/(app)/` — authenticated routes: `dashboards` (gallery + carousel +
  per-dashboard view), `settings` (connected servers), `alerts`.
- `src/app/api/odoo/[...path]/` — BFF proxy to the Odoo mobile API; keeps the
  API key server-side and applies SSRF guards (`src/lib/ssrf.ts`).
- `src/app/api/tenant/` — session management: `register`, `switch`, `rename`,
  `remove`, `logout`, `status` (multi-account support — a user can stay
  signed in to several Odoo servers and switch between them).
- `src/components/dashboard/` — widget rendering:
  - `dashboard-renderer.tsx` dispatches each widget's `analytic_type` (tile,
    chart, heatmap, sticky note, table/matrix/pivot, ...) to its renderer.
  - `dashboard-table.tsx` — the `table`/`matrix`/`pivot` widget, built on
    `@tanstack/react-table`: search, column visibility, column pinning,
    group-by with expand/collapse and per-group aggregates, a grand-total
    toggle, CSV export, and simple pagination.
  - `dashboard-carousel.tsx` / `dashboard-gallery.tsx` — the two "all
    dashboards" views; both support favouriting a dashboard (a filled circle
    toggle, stored in `localStorage` via `useFavourites`), which pins
    favourites to the front of the carousel.
- `src/components/filters/filter-toolbar.tsx` — renders whatever
  `global_filters` descriptors a dashboard reports (date range, numerical,
  multiselect); adding a new filter of one of those types in Odoo shows up
  here automatically, no frontend change needed.
- `src/components/layout/topbar.tsx` — app chrome, including the
  multi-server switcher (with inline rename) and dashboard picker.
- `src/hooks/` — React Query hooks. Query keys are prefixed with the active
  account id (`useActiveAccountId()`, from `session-provider.tsx`) so
  switching servers doesn't require wiping the cache — a previously-visited
  account's data shows instantly while it revalidates in the background.
- `src/lib/api.ts` — typed client for the BFF proxy; shapes mirror the Odoo
  module's mobile controller/model contracts.

## Notable behavior

- **Multi-account sessions**: every connected server lives in the same
  encrypted session; switching is a client-side cache-key swap, not a
  re-login. Renaming a server (topbar dropdown or Settings → Servers) is
  purely local bookkeeping, no Odoo call.
- **Offline-friendly caching**: dashboard data persists to `localStorage`
  (`query-provider.tsx`) so a reload — or a switch back to a
  previously-visited server — shows an as-of cached view immediately.
- **Table/matrix/pivot widgets** share one wire shape (`columns: string[]` +
  `rows: unknown[][]`, with `pivot` assumed to match `table`/`matrix` until
  proven otherwise) and one renderer (`dashboard-table.tsx`).
