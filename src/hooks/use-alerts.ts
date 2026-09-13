"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AlertRuleInput } from "@/lib/api";

// Internal-only (technical_plan.md §1) -- 404s for external-access grants,
// surfaced by the caller via ApiError.status rather than hidden here.
export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: api.alerts,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AlertRuleInput) => api.createAlert(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteAlert(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
