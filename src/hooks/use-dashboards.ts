"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Query keys are NOT tenant-scoped -- the localStorage-persisted cache
// (query-provider.tsx) is cleared on every register/logout transition
// instead (see onboarding-form.tsx), which is enough for this app's
// single-tenant-per-session model without plumbing a tenant id through
// every key. If a switch ever needs to happen mid-session without a
// register/logout round trip, this is the place to add one.

export function useDashboards() {
  return useQuery({
    queryKey: ["dashboards"],
    queryFn: api.dashboards,
  });
}

export function useDashboard(id: number) {
  return useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => api.dashboard(id),
    enabled: Number.isFinite(id),
  });
}
