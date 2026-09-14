"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type DashboardFilterState } from "@/lib/api";
import { filterHash } from "@/lib/filters";
import { useActiveAccountId } from "@/components/session-provider";

export function useDashboardPayload(id: number, filters: DashboardFilterState, itemIds: number[]) {
  const accountId = useActiveAccountId();
  const hash = filterHash(filters);
  return useQuery({
    queryKey: [accountId, "dashboard-payload", id, hash, itemIds],
    queryFn: ({ signal }) => api.dashboardPayload(id, filters, itemIds, signal),
    enabled: Number.isFinite(id),
  });
}
