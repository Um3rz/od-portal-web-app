import type { AppliedGlobalFilter, DashboardFilterState } from "@/lib/api";

function compareFilters(a: AppliedGlobalFilter, b: AppliedGlobalFilter) {
  return a.conditions_line_id - b.conditions_line_id ||
    String(a.filter_values.backend).localeCompare(String(b.filter_values.backend));
}

/** Stable wire-compatible hash: draft changes never affect this until Apply. */
export function filterHash(filters: DashboardFilterState): string {
  const globalFilters = [...filters.globalFilters].sort(compareFilters);
  return JSON.stringify({ rangeFilter: filters.rangeFilter, globalFilters });
}

export const EMPTY_FILTERS: DashboardFilterState = { rangeFilter: null, globalFilters: [] };

export function sameFilters(a: DashboardFilterState, b: DashboardFilterState) {
  return filterHash(a) === filterHash(b);
}
