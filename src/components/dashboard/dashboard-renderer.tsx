"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, vizIcon } from "@/components/icon/icon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WidgetSkeleton, bucketToVariant } from "@/components/dashboard/widget-skeleton";
import { AlertDialog } from "@/components/dashboard/alert-dialog";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { useIsExternalGrant } from "@/components/session-provider";
import { useDashboardPayload } from "@/hooks/use-dashboard-payload";
import { buildBarLineAreaOption, buildDoughnutFunnelOption, chartLabel, chartNumber, type ChartRow } from "@/renderers/chart-options";
import type { DashboardFilterState, GlobalFilterDescriptor } from "@/lib/api";
import { EMPTY_FILTERS, filterHash } from "@/lib/filters";
import { cn } from "@/lib/utils";

export type PayloadItem = Record<string, unknown> & { id?: number; name?: string; analytic_type?: string };
function text(value: unknown) { return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function formatNumber(value: unknown) { return chartNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function rowsOf(item: PayloadItem): ChartRow[] { return Array.isArray(item.data) ? item.data.filter((row): row is ChartRow => !!row && typeof row === "object" && !Array.isArray(row)) : []; }
function EmptyData() { return <div className="flex h-40 items-center justify-center text-sm text-fg-subtle">No data for this view.</div>; }

function Tile({ item }: { item: PayloadItem }) {
  const result = Array.isArray(item.amount) ? item.amount[0] : item.amount;
  const record = result && typeof result === "object" ? result as Record<string, unknown> : undefined;
  const amount = record?.amount ?? result;
  const metrics = record?.metrics && typeof record.metrics === "object" ? Object.entries(record.metrics as Record<string, unknown>) : [];
  return <div className="flex min-h-40 flex-col justify-between rounded-md p-4" style={{ background: text(item.tile_background_color) || "var(--primary-700)", color: text(item.tile_font_color) || "white" }}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium opacity-90">{text(record?.description || item.name)}</span><Icon name="tile" size={18} /></div><div><p className="text-3xl font-heading font-bold">{amount == null || amount === "" ? "—" : formatNumber(amount)}</p>{metrics.map(([key, metric]) => <p key={key} className="mt-1 text-xs opacity-80">{key}: {formatNumber(metric)}</p>)}</div></div>;
}

function StickyNote({ item }: { item: PayloadItem }) { return <div className="min-h-40 rounded-md border border-note-border bg-note-surface p-4 text-sm whitespace-pre-wrap text-foreground">{text(item.sticky_note_content || item.info_text || item.name)}</div>; }

function EChart({ item }: { item: PayloadItem }) {
  const host = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => rowsOf(item), [item]);
  useEffect(() => {
    if (!host.current || !rows.length) return;
    const chart = echarts.init(host.current);
    const type = String(item.analytic_type);
    chart.setOption(type === "doughnut" || type === "funnel" ? buildDoughnutFunnelOption(type, rows) : buildBarLineAreaOption(type, rows, item));
    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [item, rows]);
  if (!rows.length) return <EmptyData />;
  return <div ref={host} className="min-h-0 w-full flex-1" role="img" aria-label={`${text(item.name)} chart`} />;
}

// A matrix IS a table on the wire: `get_matrix_data` already hands back the
// same flat `columns: string[]` + `rows: any[][]` shape as `table`. The only
// thing matrix-specific is that `columns` holds machine keys instead of
// display labels -- `column_tree` (row_dim nodes + one bucket node per column
// group, each with measure leaves) carries the readable label for each key.
// Ported from Wags-POS-Saas's matrixToTable.ts / codename-portals'
// table_model.js deriveMatrixColumns, trimmed to just the header relabeling
// this simpler Table needs (no column formats/grouping/pinning here).
function matrixColumnLabels(item: PayloadItem): string[] | null {
  const tree = Array.isArray(item.column_tree) ? item.column_tree : [];
  const rawColumns = Array.isArray(item.columns) ? item.columns.map(text) : [];
  if (!tree.length || !rawColumns.length) return null;
  const measures = item.measures && typeof item.measures === "object" ? item.measures as Record<string, { label?: string }> : {};
  const measureCount = Object.keys(measures).length;
  const labelByKey = new Map<string, string>();
  for (const node of tree as Array<Record<string, unknown>>) {
    if (node.kind === "row_dim") {
      labelByKey.set(text(node.key), text(node.label) || text(node.key));
      continue;
    }
    const bucketLabel = text(node.label) || text(node.key);
    const children = Array.isArray(node.children) ? node.children as Array<Record<string, unknown>> : [];
    for (const leaf of children) {
      const measureLabel = measures[text(leaf.measure)]?.label || text(leaf.label) || text(leaf.measure);
      const key = text(leaf.key);
      labelByKey.set(key, measureCount <= 1 || !measureLabel ? bucketLabel : `${bucketLabel} · ${measureLabel}`);
    }
  }
  const seen = new Map<string, number>();
  return rawColumns.map((key) => {
    const base = labelByKey.get(key) ?? key;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base} (${n + 1})`;
  });
}

// A column is numeric only if every non-empty cell in it parses as a finite
// number -- ported from codename-portals' table_model.js numericColumns(),
// same rule both clients use so "which columns can be summed" never drifts.
function numericColumnIndexes(columns: string[], rows: unknown[][]): Set<number> {
  const numeric = new Set<number>();
  columns.forEach((_, index) => {
    const values = rows.map((row) => String(row[index] ?? "").trim().replace(/,/g, "")).filter((v) => v !== "");
    if (values.length > 0 && values.every((v) => !isNaN(Number(v)) && isFinite(Number(v)))) numeric.add(index);
  });
  return numeric;
}

function sumRow(rows: unknown[][], columns: string[], numericCols: Set<number>): (number | null)[] {
  return columns.map((_, index) => (numericCols.has(index) ? rows.reduce((sum, row) => sum + chartNumber(row[index]), 0) : null));
}

function Table({ item }: { item: PayloadItem }) {
  const rawColumns = Array.isArray(item.columns) ? item.columns.map(text) : [];
  const columns = item.analytic_type === "matrix" ? matrixColumnLabels(item) ?? rawColumns : rawColumns;
  const rows = useMemo(() => Array.isArray(item.rows) ? item.rows.filter((row): row is unknown[] => Array.isArray(row)) : [], [item.rows]);
  const [groupBy, setGroupBy] = useState<number | "">("");
  const [showTotals, setShowTotals] = useState(false);
  const numericCols = useMemo(() => numericColumnIndexes(columns, rows), [columns, rows]);

  if (!columns.length || !rows.length) return <EmptyData />;

  const groups: Array<{ label: string; rows: unknown[][] }> | null = groupBy === "" ? null : (() => {
    const order: string[] = [];
    const byLabel = new Map<string, unknown[][]>();
    for (const row of rows) {
      const label = text(row[groupBy]) || "(blank)";
      if (!byLabel.has(label)) { byLabel.set(label, []); order.push(label); }
      byLabel.get(label)!.push(row);
    }
    return order.map((label) => ({ label, rows: byLabel.get(label)! }));
  })();

  const totalRow = showTotals ? sumRow(rows, columns, numericCols) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-fg-muted">Group by</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded border border-[hsl(220_13%_88%)] bg-white px-1.5 py-1 text-xs"
          >
            <option value="">None</option>
            {columns.map((column, index) => <option key={index} value={index}>{column}</option>)}
          </select>
        </label>
        {numericCols.size > 0 && (
          <button
            type="button"
            onClick={() => setShowTotals((v) => !v)}
            className={cn("ml-auto rounded border px-2 py-1 font-medium", showTotals ? "border-primary-500 bg-primary-50 text-primary-700" : "border-[hsl(220_13%_88%)] text-fg-muted hover:bg-white")}
          >
            Σ Totals
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted"><tr>{columns.map((column, index) => <th key={index} className="px-3 py-2 font-semibold">{column}</th>)}</tr></thead>
          <tbody>
            {groups
              ? groups.map((group) => (
                  <FragmentGroup key={group.label} label={group.label} rows={group.rows} columns={columns} numericCols={numericCols} />
                ))
              : rows.slice(0, 100).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border">
                    {columns.map((_, columnIndex) => <td key={columnIndex} className="whitespace-nowrap px-3 py-2">{text(row[columnIndex])}</td>)}
                  </tr>
                ))}
          </tbody>
          {totalRow && (
            <tfoot className="sticky bottom-0 border-t-2 border-border bg-muted font-semibold">
              <tr>{totalRow.map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-2">{value == null ? (index === 0 ? "Total" : "") : formatNumber(value)}</td>)}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function FragmentGroup({ label, rows, columns, numericCols }: { label: string; rows: unknown[][]; columns: string[]; numericCols: Set<number> }) {
  const subtotal = numericCols.size > 0 ? sumRow(rows, columns, numericCols) : null;
  return (
    <>
      <tr className="bg-primary-50"><td colSpan={columns.length} className="px-3 py-1.5 font-semibold text-primary-700">{label} <span className="font-normal text-fg-muted">({rows.length})</span></td></tr>
      {rows.slice(0, 100).map((row, rowIndex) => (
        <tr key={rowIndex} className="border-t border-border">
          {columns.map((_, columnIndex) => <td key={columnIndex} className="whitespace-nowrap px-3 py-2">{text(row[columnIndex])}</td>)}
        </tr>
      ))}
      {subtotal && (
        <tr className="border-t border-border bg-muted/60 font-medium">
          {subtotal.map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-1.5">{value == null ? "" : formatNumber(value)}</td>)}
        </tr>
      )}
    </>
  );
}

function Heatmap({ item }: { item: PayloadItem }) {
  const raw = Array.isArray(item.data) ? item.data[1] : [];
  const cells = Array.isArray(raw) ? raw : [];
  const values = cells.map((cell) => Array.isArray(cell) ? chartNumber(cell[2]) : 0);
  const min = Math.min(...values, 0), max = Math.max(...values, 1);
  if (!cells.length) return <EmptyData />;
  return <div className="grid max-h-72 grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3 md:grid-cols-4">{cells.map((cell, index) => { const tuple = Array.isArray(cell) ? cell : []; const ratio = (chartNumber(tuple[2]) - min) / Math.max(max - min, 1); return <div key={index} className="rounded-md p-3 text-xs" style={{ background: `hsl(244 100% ${97 - ratio * 46}%)`, color: ratio > 0.52 ? "white" : "var(--foreground)" }}><p className="truncate">{chartLabel(tuple[0])} · {chartLabel(tuple[1])}</p><strong>{formatNumber(tuple[2])}</strong></div>; })}</div>;
}

function Unsupported({ item }: { item: PayloadItem }) { return <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-fg-muted"><Icon name="help" size={20} /><span>{text(item.analytic_type) || "Unknown"} is not supported in the web viewer.</span></div>; }
export function WidgetBody({ item }: { item: PayloadItem }) {
  switch (item.analytic_type) {
    case "tile": return <Tile item={item} />;
    case "sticky_note": return <StickyNote item={item} />;
    case "vertical_bar_chart": case "horizontal_bar_chart": case "line": case "area_chart": case "doughnut": case "funnel": return <EChart item={item} />;
    case "table": case "matrix": return <Table item={item} />;
    case "heatmap": return <Heatmap item={item} />;
    case "map": case "pivot": return <Unsupported item={item} />;
    default: return <Unsupported item={item} />;
  }
}

type Manifest = { id: number; name: string; analytic_type: string; info_text: string; bucket?: string | null };

// Every widget can carry its own quick date-range chips; the full field panel
// (numerical/multiselect descriptors, exact date range) only makes sense when
// the dashboard actually has global-filter descriptors to scope, and never
// for a sticky note (nothing to filter).
function WidgetCard({ dashboardId, manifest, item, cardLoading, onRetry, isExternalGrant, onAlert, descriptors, filters, onFilterChange, filterOpen, onToggleFilterOpen, wide }: {
  dashboardId: number; manifest: Manifest; item: PayloadItem; cardLoading: boolean; onRetry?: () => void; isExternalGrant: boolean; onAlert: () => void;
  descriptors: GlobalFilterDescriptor[]; filters: DashboardFilterState; onFilterChange: (next: DashboardFilterState) => void; filterOpen: boolean; onToggleFilterOpen: () => void; wide: boolean;
}) {
  if (cardLoading) {
    const chartLoading = ["vertical_bar_chart", "horizontal_bar_chart", "line", "area_chart", "doughnut", "funnel"].includes(manifest.analytic_type);
    return <Card className={chartLoading ? "flex min-h-[32rem] flex-col self-start overflow-hidden" : wide ? "h-fit self-start overflow-hidden sm:col-span-2 lg:col-span-3" : "h-fit self-start overflow-hidden"}><WidgetSkeleton variant={bucketToVariant(manifest.bucket)} name={manifest.name} /></Card>;
  }
  const unapplied = Array.isArray(item.global_filter_unapplied) ? item.global_filter_unapplied : [];
  const chartWidget = ["vertical_bar_chart", "horizontal_bar_chart", "line", "area_chart", "doughnut", "funnel"].includes(manifest.analytic_type);
  // The filter popover is an absolutely-positioned child taller than most
  // cards (esp. tiles/sticky notes) -- overflow-hidden, needed the rest of
  // the time to keep chart/table content from bleeding past the card, would
  // otherwise clip the open popover's bottom half instead of letting it
  // float over whatever is beneath the card.
  const overflow = filterOpen ? "overflow-visible" : "overflow-hidden";
  return (
    <Card className={chartWidget ? `relative flex min-h-[32rem] self-start flex-col ${overflow}` : wide ? `relative flex h-fit self-start flex-col ${overflow} sm:col-span-2 lg:col-span-3` : `relative flex h-fit self-start flex-col ${overflow}`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500"><Icon name={vizIcon(manifest.analytic_type)} size={16} /></div>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{manifest.name}</p>
        {!isExternalGrant && <Button variant="ghost" size="compact" onClick={onAlert} aria-label="Create alert for this widget"><Icon name="alert-triangle" size={15} /></Button>}
        {descriptors.length > 0 && <div className="relative"><Button variant={filterOpen ? "outline" : "ghost"} size="compact" onClick={onToggleFilterOpen} aria-label="Open widget filters"><Icon name="filter" size={15} />{((filters.rangeFilter ? 1 : 0) + filters.globalFilters.length) > 0 && <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary-500 px-0.5 text-[9px] font-bold text-white">{(filters.rangeFilter ? 1 : 0) + filters.globalFilters.length}</span>}</Button></div>}
      </div>
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-4 top-14 z-20 w-[min(20rem,calc(100%-2rem))] origin-top-right rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-overlay)]"
          >
            <div className="mb-2 flex items-center justify-between border-b border-border pb-2"><span className="text-sm font-semibold">Filters</span><button type="button" onClick={onToggleFilterOpen} aria-label="Close widget filters" className="rounded p-1 text-fg-muted hover:bg-muted"><Icon name="close" size={14} /></button></div>
            <FilterToolbar key={filterHash(filters)} dashboardId={dashboardId} descriptors={descriptors} applied={filters} onApply={onFilterChange} hideToggle />
          </motion.div>
        )}
      </AnimatePresence>
      {item.error ? (
        <div className="flex items-center gap-3 p-4 text-sm text-danger"><span>{text(item.error)}</span>{onRetry && <Button variant="outline" size="compact" onClick={onRetry}>Retry</Button>}</div>
      ) : (
        <WidgetBody item={item} />
      )}
      {unapplied.map((message, index) => <p key={index} className="mx-4 mb-3 rounded bg-note-surface px-2 py-1 text-xs text-fg-muted">{text(message)}</p>)}
    </Card>
  );
}

// A widget with its own filter override fetches its own payload, scoped to
// just this item id -- the shared bulk fetch below keeps using the
// dashboard's committed filters for every widget that has NOT diverged, so
// setting one widget's range doesn't cost a request for its siblings.
function OverriddenWidget({ dashboardId, manifest, filters, ...shellProps }: { dashboardId: number; manifest: Manifest; filters: DashboardFilterState } & Omit<React.ComponentProps<typeof WidgetCard>, "dashboardId" | "manifest" | "item" | "cardLoading" | "onRetry" | "filters">) {
  const payloadQuery = useDashboardPayload(dashboardId, filters, [manifest.id]);
  const analytics = Array.isArray((payloadQuery.data as { analytics_data?: unknown[] } | undefined)?.analytics_data)
    ? (payloadQuery.data as { analytics_data: PayloadItem[] }).analytics_data
    : [];
  const item = analytics.find((a) => Number(a.id) === manifest.id) ?? { id: manifest.id, name: manifest.name, analytic_type: manifest.analytic_type, info_text: manifest.info_text };
  return (
    <WidgetCard
      dashboardId={dashboardId}
      manifest={manifest}
      item={item}
      cardLoading={payloadQuery.isLoading}
      onRetry={() => void payloadQuery.refetch()}
      filters={filters}
      {...shellProps}
    />
  );
}

export function DashboardRenderer({ dashboardId, items, payload, loading, onRetry, descriptors = [] }: { dashboardId: number; items: Manifest[]; payload: unknown; loading?: boolean; onRetry?: () => void; descriptors?: GlobalFilterDescriptor[] }) {
  const [alertFor, setAlertFor] = useState<{ id: number; name: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<number, DashboardFilterState>>({});
  const [filterOpenFor, setFilterOpenFor] = useState<number | null>(null);
  const isExternalGrant = useIsExternalGrant();
  const analytics = useMemo(() => Array.isArray((payload as { analytics_data?: unknown[] } | undefined)?.analytics_data) ? (payload as { analytics_data: PayloadItem[] }).analytics_data : [], [payload]);
  const byId = useMemo(() => new Map(analytics.map((item) => [Number(item.id), item])), [analytics]);

  function setOverride(id: number, next: DashboardFilterState) {
    setOverrides((prev) => {
      if (filterHash(next) === filterHash(EMPTY_FILTERS)) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  return <>
  <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((manifest) => {
    const wide = manifest.analytic_type === "table" || manifest.analytic_type === "matrix";
    const override = overrides[manifest.id];
    const shellProps = {
      isExternalGrant,
      onAlert: () => setAlertFor({ id: manifest.id, name: manifest.name }),
      descriptors,
      onFilterChange: (next: DashboardFilterState) => setOverride(manifest.id, next),
      filterOpen: filterOpenFor === manifest.id,
      onToggleFilterOpen: () => setFilterOpenFor(filterOpenFor === manifest.id ? null : manifest.id),
      wide,
    };

    if (override) {
      return <OverriddenWidget key={manifest.id} dashboardId={dashboardId} manifest={manifest} filters={override} {...shellProps} />;
    }

    // While the payload round trip is in flight, paint this slot as a
    // per-type skeleton (matching the manifest's own `bucket`) instead of
    // WidgetBody -- otherwise WidgetBody sees an item with no data fields
    // and renders "No data for this view.", which reads as an empty/error
    // state rather than a loading one.
    const item = byId.get(manifest.id) ?? { id: manifest.id, name: manifest.name, analytic_type: manifest.analytic_type, info_text: manifest.info_text };
    return (
      <WidgetCard
        key={manifest.id}
        dashboardId={dashboardId}
        manifest={manifest}
        item={item}
        cardLoading={Boolean(loading) && !byId.has(manifest.id)}
        onRetry={onRetry}
        filters={EMPTY_FILTERS}
        {...shellProps}
      />
    );
  })}</div>
  <AnimatePresence>
    {alertFor && <AlertDialog dashboardId={dashboardId} analyticId={alertFor.id} widgetName={alertFor.name} onClose={() => setAlertFor(null)} />}
  </AnimatePresence>
  </>;
}
