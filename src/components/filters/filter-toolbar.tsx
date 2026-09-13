"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type AppliedGlobalFilter, type DashboardFilterState, type FilterOption, type GlobalFilterDescriptor, type RangeFilter } from "@/lib/api";
import { sameFilters } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icon/icon";

const PRESETS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"] as const;

function dateForPreset(preset: (typeof PRESETS)[number]): RangeFilter | null {
  if (preset === "ALL") return null;
  const to = new Date();
  const from = new Date(to);
  if (preset === "YTD") from.setMonth(0, 1);
  else from.setDate(to.getDate() - ({ "1D": 1, "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 } as Record<string, number>)[preset]);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { fromDate: format(from), toDate: format(to) };
}

// Shared open/close animation for every collapsible field card (date range,
// multiselect, the panel toggle itself) -- height+opacity, short enough
// (160ms) that opening a filter never reads as the app being slow.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function toggleOption(filters: AppliedGlobalFilter[], descriptor: GlobalFilterDescriptor, option: FilterOption) {
  const exists = filters.some((f) => f.conditions_line_id === descriptor.conditions_line_id && f.filter_values.backend === option.backend);
  return exists
    ? filters.filter((f) => !(f.conditions_line_id === descriptor.conditions_line_id && f.filter_values.backend === option.backend))
    : [...filters, { conditions_line_id: descriptor.conditions_line_id, filter_values: option }];
}

// Collapsed by default, same as MultiSelectFilter below -- was previously
// always-open (no header/toggle at all), the only field card in the panel
// that didn't match the rest.
function DateRangeFilter({ descriptor, value, onChange }: { descriptor: GlobalFilterDescriptor; value: RangeFilter | null; onChange: (next: RangeFilter | null) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="rounded-md border border-border bg-surface p-3">
    <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-medium">
      <span>{descriptor.description || "Date range"} {value && <span className="text-xs text-primary-700">({value.fromDate} – {value.toDate})</span>}</span>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={15} />
    </button>
    <Collapse open={open}>
      <div className="mt-3">
        <div className="mb-3 flex flex-wrap gap-1">{PRESETS.map((preset) => <button key={preset} type="button" onClick={() => onChange(dateForPreset(preset))} className="rounded border border-border px-2 py-1 text-xs hover:bg-primary-50">{preset}</button>)}</div>
        {/* Stacked, not side-by-side: this card can render inside the narrow
            per-widget filter popover (~20rem), and a native date input needs
            real width for its placeholder + picker icon -- squeezed to ~half
            that, Chrome renders it garbled. */}
        <div className="grid grid-cols-1 gap-2">
          <Input type="date" aria-label="From date" value={value?.fromDate ?? ""} onChange={(e) => onChange(e.target.value ? { fromDate: e.target.value, toDate: value?.toDate ?? e.target.value } : null)} />
          <Input type="date" aria-label="To date" value={value?.toDate ?? ""} onChange={(e) => onChange(e.target.value ? { fromDate: value?.fromDate ?? e.target.value, toDate: e.target.value } : null)} />
        </div>
      </div>
    </Collapse>
  </div>;
}

function MultiSelectFilter({ dashboardId, descriptor, value, onChange }: { dashboardId: number; descriptor: GlobalFilterDescriptor; value: AppliedGlobalFilter[]; onChange: (next: AppliedGlobalFilter[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState(descriptor.filter_data ?? []);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [timeout, setTimeoutState] = useState(false);
  const request = useRef<AbortController | null>(null);
  const selected = value.filter((f) => f.conditions_line_id === descriptor.conditions_line_id);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!open || !descriptor.lazy) return;
    const timer = window.setTimeout(async () => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      try {
        const result = await api.filterValues(dashboardId, descriptor.conditions_line_id, search, 100, controller.signal);
        if (!controller.signal.aborted) { setOptions(result.filter_data ?? []); setTruncated(!!result.truncated); setTimeoutState(!!result.timeout); }
      } catch { if (!controller.signal.aborted) setOptions([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [dashboardId, descriptor, open, search]);

  const visible = useMemo(() => options.filter((o) => !search || o.frontend.toLowerCase().includes(search.toLowerCase())), [options, search]);
  return <div className="rounded-md border border-border bg-surface p-3">
    <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-medium">
      <span>{descriptor.description || descriptor.column_name} {selected.length > 0 && <span className="text-xs text-primary-700">({selected.length})</span>}</span>
      <Icon name={open ? "chevron-up" : "chevron-down"} size={15} />
    </button>
    <Collapse open={open}>
      <div className="mt-3 space-y-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search values" aria-label={`Search ${descriptor.description}`} />
        {loading && <div className="flex items-center gap-2 text-xs text-fg-muted"><Spinner size={14} />Loading values…</div>}
        {timeout && <p className="text-xs text-warning">The value search timed out. Try a narrower search.</p>}
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {visible.map((option) => { const checked = selected.some((f) => f.filter_values.backend === option.backend); return <label key={`${option.backend}`} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><input type="checkbox" checked={checked} onChange={() => onChange(toggleOption(value, descriptor, option))} />{option.frontend}</label>; })}
          {!loading && visible.length === 0 && <p className="px-2 py-1 text-xs text-fg-subtle">No values found.</p>}
        </div>
        {truncated && <p className="text-xs text-fg-subtle">Showing the first 100 values. Search to find more.</p>}
      </div>
    </Collapse>
  </div>;
}

export function FilterToolbar({ dashboardId, descriptors, applied, onApply, hideToggle }: { dashboardId: number; descriptors: GlobalFilterDescriptor[]; applied: DashboardFilterState; onApply: (next: DashboardFilterState) => void; hideToggle?: boolean }) {
  const [draft, setDraft] = useState(applied);
  const [open, setOpen] = useState(Boolean(hideToggle));
  const changed = !sameFilters(draft, applied);
  const date = descriptors.find((f) => f.filter_type === "date");
  const numerical = descriptors.filter((f) => f.filter_type === "numerical");
  const multi = descriptors.filter((f) => f.filter_type === "multiselect");
  const numberValue = (id: number) => draft.globalFilters.find((f) => f.conditions_line_id === id)?.filter_values.backend?.toString() ?? "";
  const setNumber = (descriptor: GlobalFilterDescriptor, raw: string) => setDraft((current) => ({ ...current, globalFilters: raw === "" ? current.globalFilters.filter((f) => f.conditions_line_id !== descriptor.conditions_line_id) : [{ conditions_line_id: descriptor.conditions_line_id, filter_values: { backend: Number(raw), frontend: raw, filter_field_type: descriptor.field_type } }, ...current.globalFilters.filter((f) => f.conditions_line_id !== descriptor.conditions_line_id)] }));
  if (!descriptors.length) return null;
  return <section className={hideToggle ? "" : "mb-5 rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-raised)]"}>
    {!hideToggle && <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-8 items-center gap-2 rounded-md bg-muted px-3 text-sm font-medium"><Icon name="filter" size={15} />Filters {changed && <span className="h-2 w-2 rounded-full bg-primary-500" />}</button>
      {draft.rangeFilter && (
        <span className="flex items-center gap-1 rounded-full bg-primary-50 py-1 pr-1 pl-2.5 text-xs text-primary-700">
          {draft.rangeFilter.fromDate} – {draft.rangeFilter.toDate}
          <button
            type="button"
            onClick={() => { const next = { ...draft, rangeFilter: null }; setDraft(next); onApply(next); }}
            aria-label="Clear date range filter"
            className="rounded-full p-0.5 hover:bg-primary-100"
          >
            <Icon name="close" size={11} />
          </button>
        </span>
      )}
      {draft.globalFilters.length > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-xs text-fg-muted">
          {draft.globalFilters.length} value{draft.globalFilters.length === 1 ? "" : "s"} selected
          <button
            type="button"
            onClick={() => { const next = { ...draft, globalFilters: [] }; setDraft(next); onApply(next); }}
            aria-label="Clear selected filter values"
            className="rounded-full p-0.5 hover:bg-[hsl(220_13%_85%)]"
          >
            <Icon name="close" size={11} />
          </button>
        </span>
      )}
      {changed && <div className="ml-auto flex gap-2"><Button size="compact" variant="ghost" onClick={() => setDraft(applied)}>Reset</Button><Button size="compact" onClick={() => { onApply(draft); setOpen(false); }}>Apply filters</Button></div>}
    </div>}
    {hideToggle && changed && <div className="mb-2 flex justify-end gap-2"><Button size="compact" variant="ghost" onClick={() => setDraft(applied)}>Reset</Button><Button size="compact" onClick={() => onApply(draft)}>Apply</Button></div>}
    <Collapse open={open}>
      <div className={hideToggle ? "grid gap-3 md:grid-cols-2" : "mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-2 lg:grid-cols-3"}>
        {date && <DateRangeFilter descriptor={date} value={draft.rangeFilter} onChange={(rangeFilter) => setDraft((current) => ({ ...current, rangeFilter }))} />}
        {numerical.map((descriptor) => <div key={descriptor.conditions_line_id} className="rounded-md border border-border bg-surface p-3"><label className="mb-2 block text-sm font-medium" htmlFor={`number-${descriptor.conditions_line_id}`}>{descriptor.description || descriptor.column_name}</label><Input id={`number-${descriptor.conditions_line_id}`} type="number" value={numberValue(descriptor.conditions_line_id)} onChange={(e) => setNumber(descriptor, e.target.value)} placeholder={descriptor.field_type} /></div>)}
        {multi.map((descriptor) => <MultiSelectFilter key={descriptor.conditions_line_id} dashboardId={dashboardId} descriptor={descriptor} value={draft.globalFilters} onChange={(globalFilters) => setDraft((current) => ({ ...current, globalFilters }))} />)}
      </div>
    </Collapse>
  </section>;
}
