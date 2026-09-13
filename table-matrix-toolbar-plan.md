# Port Wags-POS-Saas table/matrix toolbar into od-portal-web-app

## Context

The Odoo module's own web dashboards (e.g. "Sales Overview", screenshot 1) render `table`/`matrix` widgets with a rich toolbar: search, column-visibility toggle, export, column pinning, group/expand (their pivot mechanism), and a Σ aggregate/summary-row toggle. This functionality already exists in a sibling repo, `Wags-POS-Saas` (`C:\Users\haxga\Documents\Wags-POS-Saas`), which renders the same Odoo Dashboards backend contract. od-portal-web-app's current `Table` component (`src/components/dashboard/dashboard-renderer.tsx:105-175`) is a hand-rolled `<table>` with only two of these seven features (Σ Totals toggle + group-by `<select>`); everything else — search, column visibility, pin, export, expand — is absent. The goal is to port Wags-POS-Saas's table toolbar so this app's table/matrix widgets match the Odoo module's functionality, reusing this app's own conventions (its icon sprite system, no unrequested new deps) rather than copying its dependencies wholesale.

Decisions locked in with the user:
- **Export: CSV only.** No `xlsx`/`jspdf` — hand-rolled CSV export (Blob + anchor `download`), same technique Wags-POS-Saas itself uses for CSV.
- **Icons: extend this app's own sprite set** (`src/components/icon/icon.tsx` / `icons.ts`) with the missing glyphs (columns, pin, sigma, group/expand, download, search already covered by existing filter search usage) rather than adding `lucide-react`.

## Source material

- `C:\Users\haxga\Documents\Wags-POS-Saas\src\components\dashboard\DashboardTable.tsx` (1593 lines) — table+toolbar to port from. Uses `@tanstack/react-table` for visibility/pinning/grouping/sorting/filtering state.
- `C:\Users\haxga\Documents\Wags-POS-Saas\src\components\dashboard\matrixToTable.ts` (158 lines) — reshapes matrix `column_tree`/`measures` payload into flat `{columns, rows}`.

## Current state in od-portal-web-app

- `src/components/dashboard/dashboard-renderer.tsx`:
  - `WidgetBody` (~line 206) dispatches `analytic_type`: `table`/`matrix` → `Table`; `pivot`/`map` → `Unsupported`; no case for `customer_ageing_report` (falls to `Unsupported`).
  - `Table` (~105-175): flat `columns: string[]` / `rows: unknown[][]`, `matrixColumnLabels()` (60-87) relabels matrix columns from `column_tree`+`measures`, `numericColumnIndexes()` (89-99) + `sumRow()` (101-103) already power the existing Σ Totals toggle, `groupBy` `<select>` (109, 115-141) already does row grouping with per-group subtotal rows (`FragmentGroup`, 177-194). Hard `rows.slice(0, 100)` cap, no pagination.
  - No TanStack Table, no CSV lib, no virtualization in `package.json` today.
- Data is delivered in one response (no server pagination fields) — the full row set is already available client-side, so search/filter/export need no new data-fetching plumbing.

## Approach

Add `@tanstack/react-table` (the one new dependency — headless, no styling, matches the ladder's "already-installed dependency" reasoning once installed: it's the correct tool for visibility/pinning/grouping/sort state instead of hand-rolling all of that). Rewrite `Table` in `dashboard-renderer.tsx` (or extract to its own file, see below) on top of it, porting Wags-POS-Saas's mechanics:

1. **Extraction**: pull `Table`, `FragmentGroup`, `matrixColumnLabels`, `numericColumnIndexes`, `sumRow` out of `dashboard-renderer.tsx` into a new `src/components/dashboard/dashboard-table.tsx` — the current file is a large multi-component switchboard, and a 1-2k-line TanStack table implementation belongs in its own file. Import it back into `WidgetBody`.

2. **Column model**: build TanStack `ColumnDef[]` from the existing `columns: string[]` + `rows: unknown[][]` contract (no backend change). Reuse `numericColumnIndexes()` for default `aggregationFn: "sum"` vs `"uniqueCount"`, matching Wags-POS-Saas's heuristic.

3. **Toolbar row** (replaces/extends the current group-by `<select>` + Σ button row, same native-controls style, not `ui/Button`/`ui/Input` — matches the existing established micro-pattern):
   - **Search**: `globalFilter` state → `onGlobalFilterChange`/`getFilteredRowModel()`. New `Input`-style text field (reuse `src/components/ui/input.tsx`, already used elsewhere for search in `MultiSelectFilter`).
   - **Column visibility**: `VisibilityState`, a dropdown of checkboxes (mirror the existing filter-popover dropdown pattern from `FilterToolbar`/`WidgetCard`'s filter popover — `motion.div` positioned panel, `AnimatePresence`).
   - **Pin**: `ColumnPinningState`, `column.pin("left"|false)`, sticky `left` offset via `column.getStart("left")` inline style, same as source.
   - **Group/expand**: keep the existing `groupBy` concept but migrate it onto TanStack's `GroupingState`/`getGroupedRowModel()`/`getExpandedRowModel()` so expand/collapse per group works, replacing the current manual `FragmentGroup` slicing.
   - **Σ summary**: keep existing `showTotals` → summary `<tr>`, now computed via `table.getFilteredRowModel()` so it responds to search/filters live (source's `columnSums` pattern).
   - **Export (CSV only)**: a "Download" icon button building CSV from `table.getSortedRowModel()` (recursing `row.subRows` when grouped, matching source's `getExportRows()`), Blob + `<a download>` — no library.
   - **Filter icon**: already exists at the widget level (`WidgetCard`'s filter popover, `FilterToolbar`) — no new per-column filter UI needed; this satisfies the "filter" item from the screenshot.

4. **Icons**: add missing SVG paths to `src/components/icon/icons.ts` for: column-visibility ("columns"), pin, sigma (or keep the existing raw `Σ` glyph — source itself just uses the `Sigma` icon glyph, low-value to duplicate as SVG if a `Σ` character already works fine, as today), group/expand chevron (likely already covered by existing `chevron-down`/`chevron-right` used elsewhere — check before adding new glyphs), download. Wire through `VIZ_ICON`/`ALIAS` only if truly new names are needed.

5. **`pivot` analytic type**: Wags-POS-Saas treats `pivot` identically to `table`/`matrix` (all three feed the same renderer). Route `pivot` in `WidgetBody` to the same new table component instead of `Unsupported`, on the assumption its wire shape matches `table` (flat columns/rows) — flag this as an assumption to verify against a real `pivot` payload if one is available; if the shape differs, this case can be reverted to `Unsupported` with no other impact.
   - `customer_ageing_report` stays `Unsupported` — no equivalent exists in either codebase to port from; out of scope.

6. **Row cap**: keep the existing `rows.slice(0, 100)` display cap (matches current behavior, no server pagination exists to page beyond it) unless TanStack's built-in client-side pagination is trivially adoptable — if so, swap the hard slice for `getPaginationRowModel()` with a simple prev/next footer (Wags-POS-Saas has one; cheap to add since the whole row set is already in memory).

## Files to touch

- `package.json` — add `@tanstack/react-table`.
- `src/components/dashboard/dashboard-table.tsx` (new) — the ported table+toolbar, extracted from `dashboard-renderer.tsx`.
- `src/components/dashboard/dashboard-renderer.tsx` — remove old `Table`/`FragmentGroup`/helpers, import new component, add `pivot` case.
- `src/components/icon/icons.ts` — add any genuinely-missing glyphs (audit existing set first per step 4 before adding).

## Verification

- `npm run lint` and `npx tsc --noEmit` after implementation (per project convention).
- Manually exercise a `table` and a `matrix` widget in the running app (`npm run dev`, already running on :3000 per earlier session): search filters rows, column-visibility hides/shows columns, pin sticks a column through horizontal scroll, group-by still subtotal-expands correctly, Σ toggle still sums (now over filtered rows), CSV download produces a correct file reflecting current search/visible columns/grouping.
- Confirm `pivot`-typed widgets (if any real dashboard has one) now render instead of showing "Unsupported"; revert that one case if the payload shape doesn't match.
- `npm run build` only if the user approves it this time (was interrupted twice in the prior session).
