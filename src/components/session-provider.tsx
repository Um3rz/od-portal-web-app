"use client";

import { createContext, useContext, useEffect } from "react";
import { identifyAccount, initAnalytics } from "@/lib/posthog-client";

// Read server-side once in (app)/layout.tsx (a server component with access
// to the encrypted session) and handed down as plain props -- no client-side
// session fetch/endpoint needed.
const SessionContext = createContext(false);

export function SessionProvider({ accountId, isExternalGrant, children }: { accountId: string; isExternalGrant: boolean; children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
    identifyAccount(accountId);
  }, [accountId]);
  return <SessionContext.Provider value={isExternalGrant}>{children}</SessionContext.Provider>;
}

// Internal-only routes (notifications, alerts, devices) 404 for external
// grants -- technical_plan.md §1. Consumers use this to hide UI that would
// otherwise fail with a 404, mirroring the reference mobile client's
// `profile.isExternal` tab-hiding.
export function useIsExternalGrant() {
  return useContext(SessionContext);
}
