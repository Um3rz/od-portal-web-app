// Typed client for the BFF proxy (/api/odoo/mobile/v1/...). Shapes match
// controllers/mobile.py and models/dashboards.py:get_dashboard_metadata
// exactly -- see technical_plan.md §1 for the endpoint table this mirrors.
export interface DashboardSummary {
  id: number;
  name: string;
  sequence: number;
  item_count: number;
  etag: string;
  state: string;
}

export interface DashboardItem {
  id: number;
  name: string;
  analytic_type: string;
  bucket: string | null;
  info_text: string;
}

export interface DashboardDetail {
  dashboard_name: string;
  dashboard_id: number;
  enable_global_date_range_filter: boolean;
  total_items: number;
  items: DashboardItem[];
  global_filters: GlobalFilterDescriptor[];
  existing_layout: unknown;
  error?: string;
}

export type FilterValue = string | number | null;

export interface FilterOption {
  backend: FilterValue;
  frontend: string;
  filter_field_type?: string;
}

export interface GlobalFilterDescriptor {
  conditions_line_id: number;
  column_name: string;
  field_type: string;
  filter_type: "date" | "numerical" | "multiselect" | string;
  description: string;
  show_filters?: boolean;
  range_mode?: boolean;
  select_date_as_at?: boolean;
  date_from?: string | null;
  date_to?: string | null;
  filter_data?: FilterOption[];
  lazy?: boolean;
}

export interface AppliedGlobalFilter {
  conditions_line_id: number;
  filter_values: FilterOption;
}

export interface RangeFilter {
  fromDate: string;
  toDate: string;
}

export interface DashboardFilterState {
  rangeFilter: RangeFilter | null;
  globalFilters: AppliedGlobalFilter[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/odoo${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  dashboards: () => bff<DashboardSummary[]>("/mobile/v1/dashboards"),
  dashboard: (id: number) => bff<DashboardDetail>(`/mobile/v1/dashboard/${id}`),
  dashboardPayload: (id: number, filters: DashboardFilterState, itemIds: number[] = [], signal?: AbortSignal) =>
    bff<unknown>(`/mobile/v1/dashboard/${id}/payload`, {
      method: "POST",
      signal,
      body: JSON.stringify({
        item_ids: itemIds,
        range_filter: filters.rangeFilter,
        global_filters: filters.globalFilters,
      }),
    }),
  filterValues: (id: number, conditionId: number, search = "", limit = 100, signal?: AbortSignal) =>
    bff<{ filter_data?: FilterOption[]; truncated?: boolean; timeout?: boolean }>(
      `/mobile/v1/dashboard/${id}/filter_values`,
      { method: "POST", signal, body: JSON.stringify({ condition_id: conditionId, search, limit }) },
    ),
};
