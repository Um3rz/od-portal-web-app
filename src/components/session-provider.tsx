"use client";

import { createContext, useContext, useEffect } from "react";
import { identifyAccount, initAnalytics } from "@/lib/posthog-client";

// Read server-side once in (app)/layout.tsx (a server component with access
// to the encrypted session) and handed down as plain props -- no client-side
// session fetch/endpoint needed.
const SessionContext = createContext({ accountId: "", isExternalGrant: false });

export function SessionProvider({ accountId, isExternalGrant, children }: { accountId: string; isExternalGrant: boolean; children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
    identifyAccount(accountId);
  }, [accountId]);
  return <SessionContext.Provider value={{ accountId, isExternalGrant }}>{children}</SessionContext.Provider>;
}

// Internal-only routes (notifications, alerts, devices) 404 for external
// grants -- technical_plan.md §1. Consumers use this to hide UI that would
// otherwise fail with a 404, mirroring the reference mobile client's
// `profile.isExternal` tab-hiding.
export function useIsExternalGrant() {
  return useContext(SessionContext).isExternalGrant;
}

// Query keys use this to scope React Query's cache per account, so switching
// servers (topbar.tsx / settings/page.tsx) can leave the cache alone instead
// of `queryClient.clear()`-ing it -- the previous account's entries just sit
// unused under their own key prefix, ready to show instantly if the user
// switches back, while the new account's queries fetch (or serve their own
// already-cached, possibly-stale data) independently.
export function useActiveAccountId() {
  return useContext(SessionContext).accountId;
}
