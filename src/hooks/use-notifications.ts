"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Internal-only (technical_plan.md §1) -- 404s for external-access grants,
// surfaced by the caller via ApiError.status rather than hidden here.
export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    enabled: options?.enabled ?? true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
