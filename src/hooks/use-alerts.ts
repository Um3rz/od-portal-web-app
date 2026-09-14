"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AlertRuleInput } from "@/lib/api";
import { useActiveAccountId } from "@/components/session-provider";

// Internal-only (technical_plan.md §1) -- 404s for external-access grants,
// surfaced by the caller via ApiError.status rather than hidden here. Keyed
// per account, see hooks/use-dashboards.ts.
export function useAlerts() {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: [accountId, "alerts"],
    queryFn: api.alerts,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  const accountId = useActiveAccountId();
  return useMutation({
    mutationFn: (body: AlertRuleInput) => api.createAlert(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [accountId, "alerts"] }),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  const accountId = useActiveAccountId();
  return useMutation({
    mutationFn: (id: number) => api.deleteAlert(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [accountId, "alerts"] }),
  });
}
