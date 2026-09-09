"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { Icon, vizIcon } from "@/components/icon/icon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildBarLineAreaOption, buildDoughnutFunnelOption, chartLabel, chartNumber, type ChartRow } from "@/renderers/chart-options";

type PayloadItem = Record<string, unknown> & { id?: number; name?: string; analytic_type?: string };
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
  return <div ref={host} className="h-64 w-full" role="img" aria-label={`${text(item.name)} chart`} />;
}

function Table({ item }: { item: PayloadItem }) {
  const columns = Array.isArray(item.columns) ? item.columns.map(text) : [];
  const rows = Array.isArray(item.rows) ? item.rows.filter((row): row is unknown[] => Array.isArray(row)) : [];
  if (!columns.length || !rows.length) return <EmptyData />;
  return <div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{columns.map((column, index) => <th key={index} className="px-3 py-2 font-semibold">{column}</th>)}</tr></thead><tbody>{rows.slice(0, 100).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border">{columns.map((_, columnIndex) => <td key={columnIndex} className="whitespace-nowrap px-3 py-2">{text(row[columnIndex])}</td>)}</tr>)}</tbody></table></div>;
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
function WidgetBody({ item }: { item: PayloadItem }) {
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

export function DashboardRenderer({ items, payload, onRetry }: { items: Array<{ id: number; name: string; analytic_type: string; info_text: string }>; payload: unknown; onRetry?: () => void }) {
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const analytics = useMemo(() => Array.isArray((payload as { analytics_data?: unknown[] } | undefined)?.analytics_data) ? (payload as { analytics_data: PayloadItem[] }).analytics_data : [], [payload]);
  const byId = useMemo(() => new Map(analytics.map((item) => [Number(item.id), item])), [analytics]);
  return <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((manifest) => { const item = byId.get(manifest.id) ?? { id: manifest.id, name: manifest.name, analytic_type: manifest.analytic_type, info_text: manifest.info_text }; const isFullscreen = fullscreen === manifest.id; const unapplied = Array.isArray(item.global_filter_unapplied) ? item.global_filter_unapplied : []; return <Card key={manifest.id} className={isFullscreen ? "fixed inset-4 z-[1000] flex flex-col overflow-auto p-4" : "flex h-fit self-start flex-col overflow-hidden"}><div className="flex items-center gap-2 border-b border-border px-4 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500"><Icon name={vizIcon(manifest.analytic_type)} size={16} /></div><p className="min-w-0 flex-1 truncate text-sm font-semibold">{manifest.name}</p><Button variant="ghost" size="compact" onClick={() => setFullscreen(isFullscreen ? null : manifest.id)} aria-label={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}><Icon name={isFullscreen ? "close" : "maximize"} size={15} /></Button></div>{item.error ? <div className="flex items-center gap-3 p-4 text-sm text-danger"><span>{text(item.error)}</span>{onRetry && <Button variant="outline" size="compact" onClick={onRetry}>Retry</Button>}</div> : <WidgetBody item={item} />}{unapplied.map((message, index) => <p key={index} className="mx-4 mb-3 rounded bg-note-surface px-2 py-1 text-xs text-fg-muted">{text(message)}</p>)}</Card>; })}</div>;
}
