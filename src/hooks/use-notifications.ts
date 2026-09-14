"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useActiveAccountId } from "@/components/session-provider";

// Internal-only (technical_plan.md §1) -- 404s for external-access grants,
// surfaced by the caller via ApiError.status rather than hidden here. Keyed
// per account, see hooks/use-dashboards.ts.
export function useNotifications(options?: { enabled?: boolean }) {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: [accountId, "notifications"],
    queryFn: api.notifications,
    enabled: options?.enabled ?? true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const accountId = useActiveAccountId();
  return useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [accountId, "notifications"] }),
  });
}
