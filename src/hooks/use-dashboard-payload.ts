"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type DashboardFilterState } from "@/lib/api";
import { filterHash } from "@/lib/filters";

export function useDashboardPayload(id: number, filters: DashboardFilterState, itemIds: number[]) {
  const hash = filterHash(filters);
  return useQuery({
    queryKey: ["dashboard-payload", id, hash, itemIds],
    queryFn: ({ signal }) => api.dashboardPayload(id, filters, itemIds, signal),
    enabled: Number.isFinite(id),
  });
}
