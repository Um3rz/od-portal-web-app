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

export interface MobileNotification {
  id: number;
  kind: "alert" | "digest" | "broadcast" | "odoo" | string;
  title: string;
  body: string;
  dashboard_id: number | null;
  analytic_id: number | null;
  payload: Record<string, unknown>;
  state: "unread" | "read" | string;
  created_at: string;
}

export type AlertOperator = "below" | "above" | "drops_pct" | "rises_pct" | "below_target";
export type AlertScope = "any_row" | "aggregate";

export interface AlertRule {
  id: number;
  dashboard_id: number;
  dashboard_name: string;
  analytic_id: number;
  analytic_name: string;
  column: string;
  operator: AlertOperator;
  threshold: number | null;
  window_days: number;
  scope: AlertScope;
  dimension_filter: Record<string, unknown>;
  cooldown_minutes: number;
  active: boolean;
  last_fired: string | null;
  last_value: number | null;
}

export interface AlertRuleInput {
  dashboard_id: number;
  analytic_id: number;
  column: string;
  operator: AlertOperator;
  threshold?: number;
  window_days?: number;
  scope?: AlertScope;
  dimension_filter?: Record<string, unknown>;
  cooldown_minutes?: number;
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
  // internal-only (technical_plan.md §1) -- 404s for external-access grants.
  notifications: () => bff<MobileNotification[]>("/mobile/v1/notifications"),
  markNotificationRead: (id: number) => bff<{ ok: boolean }>(`/mobile/v1/notifications/${id}/read`, { method: "POST" }),
  alerts: () => bff<AlertRule[]>("/mobile/v1/alerts"),
  createAlert: (body: AlertRuleInput) => bff<AlertRule>("/mobile/v1/alerts", { method: "POST", body: JSON.stringify(body) }),
  deleteAlert: (id: number) => bff<{ ok: boolean }>(`/mobile/v1/alerts/${id}`, { method: "DELETE" }),
};
