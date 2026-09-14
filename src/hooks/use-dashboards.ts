"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useActiveAccountId } from "@/components/session-provider";

// Keys are prefixed with the active account id so switching servers
// (topbar.tsx / settings/page.tsx) doesn't need to `queryClient.clear()` --
// each account's entries live under their own prefix, so switching back to
// one already fetched this session shows its cached data immediately while
// it revalidates in the background, instead of a full reload every time.

export function useDashboards() {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: [accountId, "dashboards"],
    queryFn: api.dashboards,
  });
}

export function useDashboard(id: number) {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: [accountId, "dashboard", id],
    queryFn: () => api.dashboard(id),
    enabled: Number.isFinite(id),
  });
}
