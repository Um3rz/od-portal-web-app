"use client";

import { use, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Spinner } from "@/components/ui/spinner";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer";
import { useDashboard } from "@/hooks/use-dashboards";
import { useDashboardPayload } from "@/hooks/use-dashboard-payload";
import { ApiError, type DashboardFilterState } from "@/lib/api";
import { EMPTY_FILTERS, filterHash } from "@/lib/filters";

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dashboardId = Number(id);
  const { data, isLoading, error } = useDashboard(dashboardId);
  const [filters, setFilters] = useState<DashboardFilterState>(EMPTY_FILTERS);
  const payload = useDashboardPayload(dashboardId, filters, data?.items.map((item) => item.id) ?? []);

  if (isLoading) return <><Topbar showBack title="Loading…" /><div className="flex flex-1 items-center justify-center"><Spinner size={24} /></div></>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <><Topbar showBack title="Dashboard" /><div className="flex flex-1 items-center justify-center p-6"><div className="rounded-lg border border-dashed border-border p-8 text-center"><p className="text-sm font-semibold">{notFound ? "Dashboard not found" : "Couldn’t load this dashboard"}</p><p className="mt-1 text-xs text-fg-muted">{notFound ? "It may have been unshared, or you no longer have access." : "Showing cached data if any is available offline."}</p></div></div></>;
  }

  return <><Topbar showBack title={data?.dashboard_name} subtitle={`${data?.total_items ?? 0} items`} /><div className="flex-1 overflow-y-auto p-6"><FilterToolbar key={filterHash(filters)} dashboardId={dashboardId} descriptors={data?.global_filters ?? []} applied={filters} onApply={setFilters} />{payload.isLoading && <p className="mb-4 text-xs text-fg-muted">Loading widget data…</p>}{payload.error && <p className="mb-4 rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">Couldn&apos;t refresh widget data. Showing the dashboard layout.</p>}<DashboardRenderer items={data?.items ?? []} payload={payload.data} onRetry={() => void payload.refetch()} /></div></>;
}
