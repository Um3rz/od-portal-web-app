"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// Cached dashboard reads survive a reload/offline start (product plan §4
// "Cached data is immediately visible with an as-of timestamp"). No
// polling anywhere -- alerts/notifications refetch on window focus
// (React Query's built-in refetchOnWindowFocus) per technical_plan.md §3,
// never a setInterval.
//
// Must always render a real QueryClientProvider, on the server too: this
// component's children (OnboardingForm etc.) call useQueryClient()
// unconditionally, and Next.js server-renders client components for the
// initial HTML/RSC payload -- skipping the provider on that pass (as an
// earlier version of this file did for `!window`) crashes with "No
// QueryClient set" before hydration ever runs. `storage: undefined` is the
// library's own documented SSR case ("For SSR pass in `undefined`") -- it
// no-ops persistence internally rather than needing a stub object.

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 24 * 60 * 60 * 1000, // keep a day of cache for offline reload
            retry: 1,
          },
        },
      }),
  );

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "odsaas-query-cache",
    }),
  );

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}
