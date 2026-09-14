"use client";

// Ported from Wags-POS-Saas's DashboardTable.tsx: same toolbar feature set
// (search, column visibility, pinning, group/expand, Σ aggregates, CSV
// export) rebuilt on @tanstack/react-table against this app's existing
// `columns: string[]` / `rows: unknown[][]` wire contract -- no backend change.
import { useMemo, useState, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type VisibilityState,
  type ColumnPinningState,
  type ExpandedState,
  type Row,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/icon/icon";
import { Input } from "@/components/ui/input";
import { chartNumber } from "@/renderers/chart-options";
import { cn } from "@/lib/utils";
import { text, formatNumber, EmptyData, type PayloadItem } from "./dashboard-renderer";

// A matrix IS a table on the wire: `get_matrix_data` already hands back the
// same flat `columns: string[]` + `rows: any[][]` shape as `table`. The only
// thing matrix-specific is that `columns` holds machine keys instead of
// display labels -- `column_tree` (row_dim nodes + one bucket node per column
// group, each with measure leaves) carries the readable label for each key.
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
// number -- same rule the Odoo module's own client uses so "which columns
// can be summed" never drifts.
function numericColumnIndexes(columns: string[], rows: unknown[][]): Set<number> {
  const numeric = new Set<number>();
  columns.forEach((_, index) => {
    const values = rows.map((row) => String(row[index] ?? "").trim().replace(/,/g, "")).filter((v) => v !== "");
    if (values.length > 0 && values.every((v) => !isNaN(Number(v)) && isFinite(Number(v)))) numeric.add(index);
  });
  return numeric;
}

function colIndex(columnId: string) { return Number(columnId.slice(1)); }
function csvCell(value: string) { return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }

export function Table({ item }: { item: PayloadItem }) {
  const rawColumns = Array.isArray(item.columns) ? item.columns.map(text) : [];
  const columns = item.analytic_type === "matrix" ? matrixColumnLabels(item) ?? rawColumns : rawColumns;
  const rows = useMemo(() => Array.isArray(item.rows) ? item.rows.filter((row): row is unknown[] => Array.isArray(row)) : [], [item.rows]);
  const numericCols = useMemo(() => numericColumnIndexes(columns, rows), [columns, rows]);

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [grouping, setGrouping] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [showTotals, setShowTotals] = useState(false);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);

  const columnDefs = useMemo<ColumnDef<unknown[]>[]>(() => columns.map((label, index) => ({
    id: `c${index}`,
    header: label,
    accessorFn: (row) => row[index],
    aggregationFn: numericCols.has(index) ? "sum" : () => "",
  })), [columns, numericCols]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { globalFilter, columnVisibility, columnPinning, grouping, expanded },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 100 } },
  });

  if (!columns.length || !rows.length) return <EmptyData />;

  const totalRow = showTotals ? (() => {
    const leaves = table.getFilteredRowModel().rows;
    return columns.map((_, index) => numericCols.has(index) ? leaves.reduce((sum, row) => sum + chartNumber(row.getValue(`c${index}`)), 0) : null);
  })() : null;

  function downloadCsv() {
    const visibleCols = table.getVisibleLeafColumns();
    const lines = [visibleCols.map((c) => csvCell(String(c.columnDef.header))).join(",")];
    const walk = (tableRows: Row<unknown[]>[]) => {
      for (const row of tableRows) {
        if (row.getIsGrouped()) {
          lines.push(visibleCols.map((c) => c.id === row.groupingColumnId ? csvCell(text(row.getValue(c.id))) : "").join(","));
          walk(row.subRows);
        } else {
          lines.push(visibleCols.map((c) => csvCell(text(row.getValue(c.id)))).join(","));
        }
      }
    };
    walk(table.getPrePaginationRowModel().rows);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${text(item.name) || "table"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const { rows: pageRows } = table.getRowModel();
  const pageCount = table.getPageCount();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2 text-xs">
        <div className="w-40">
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search…" aria-label="Search table" className="h-7 text-xs" />
        </div>
        <label className="flex items-center gap-1.5">
          <span className="text-fg-muted">Group by</span>
          <select
            value={grouping[0] ?? ""}
            onChange={(e) => { const value = e.target.value; setExpanded(true); setGrouping(value === "" ? [] : [value]); }}
            className="rounded border border-[hsl(220_13%_88%)] bg-white px-1.5 py-1 text-xs"
          >
            <option value="">None</option>
            {columnDefs.map((c) => <option key={c.id} value={c.id}>{String(c.header)}</option>)}
          </select>
        </label>
        <div className="relative">
          <button type="button" onClick={() => setColumnsPanelOpen((v) => !v)} className={cn("flex items-center gap-1 rounded border px-2 py-1 font-medium", columnsPanelOpen ? "border-primary-500 bg-primary-50 text-primary-700" : "border-[hsl(220_13%_88%)] text-fg-muted hover:bg-white")}>
            <Icon name="columns" size={13} /> Columns
          </button>
          <AnimatePresence>
            {columnsPanelOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 top-full z-30 mt-1 max-h-56 w-44 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-overlay)]"
              >
                {table.getAllLeafColumns().map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted">
                    <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} />
                    <span className="truncate">{String(c.columnDef.header)}</span>
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {numericCols.size > 0 && (
          <button
            type="button"
            onClick={() => setShowTotals((v) => !v)}
            className={cn("rounded border px-2 py-1 font-medium", showTotals ? "border-primary-500 bg-primary-50 text-primary-700" : "border-[hsl(220_13%_88%)] text-fg-muted hover:bg-white")}
          >
            Σ Totals
          </button>
        )}
        <button type="button" onClick={downloadCsv} className="ml-auto flex items-center gap-1 rounded border border-[hsl(220_13%_88%)] px-2 py-1 font-medium text-fg-muted hover:bg-white">
          <Icon name="download" size={13} /> CSV
        </button>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  return (
                    <th
                      key={header.id}
                      style={pinned ? { position: "sticky", [pinned === "left" ? "left" : "right"]: `${pinned === "left" ? header.column.getStart("left") : header.column.getAfter("right")}px`, zIndex: 11 } : undefined}
                      className="bg-muted px-3 py-2 font-semibold"
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{String(header.column.columnDef.header)}</span>
                        <button
                          type="button"
                          onClick={() => header.column.pin(pinned ? false : "left")}
                          aria-label={pinned ? "Unpin column" : "Pin column"}
                          className={cn("shrink-0", pinned ? "text-primary-600" : "text-fg-subtle hover:text-primary-600")}
                        >
                          <Icon name="pin" size={11} />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const rowBg = row.getIsGrouped() ? "bg-primary-50" : "bg-white";
              return (
                <tr key={row.id} className={cn("border-t border-border", rowBg, row.getIsGrouped() && "font-medium text-primary-700")}>
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    const style = pinned ? { position: "sticky" as const, [pinned === "left" ? "left" : "right"]: `${pinned === "left" ? cell.column.getStart("left") : cell.column.getAfter("right")}px`, zIndex: 5 } : undefined;
                    let content: ReactNode;
                    if (cell.getIsPlaceholder()) content = null;
                    else if (cell.getIsGrouped()) {
                      content = (
                        <button type="button" onClick={row.getToggleExpandedHandler()} className="flex items-center gap-1">
                          <Icon name={row.getIsExpanded() ? "chevron-down" : "chevron-right"} size={12} />
                          {text(cell.getValue())}
                          <span className="font-normal text-fg-muted">({row.subRows.length})</span>
                        </button>
                      );
                    } else if (cell.getIsAggregated()) {
                      content = numericCols.has(colIndex(cell.column.id)) ? formatNumber(cell.getValue()) : "";
                    } else {
                      content = text(cell.getValue());
                    }
                    return (
                      <td key={cell.id} style={{ ...style, paddingLeft: row.depth > 0 && cell.column.getIndex() === 0 ? `${12 + row.depth * 14}px` : undefined }} className={cn("whitespace-nowrap px-3 py-2", rowBg)}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {totalRow && (
            <tfoot className="sticky bottom-0 border-t-2 border-border bg-muted font-semibold">
              <tr>{totalRow.map((value, index) => <td key={index} className="whitespace-nowrap bg-muted px-3 py-2">{value == null ? (index === 0 ? "Total" : "") : formatNumber(value)}</td>)}</tr>
            </tfoot>
          )}
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted px-3 py-1.5 text-xs text-fg-muted">
          <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded px-1.5 py-0.5 hover:bg-white disabled:opacity-40">Prev</button>
          <span>Page {table.getState().pagination.pageIndex + 1} of {pageCount}</span>
          <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded px-1.5 py-0.5 hover:bg-white disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
