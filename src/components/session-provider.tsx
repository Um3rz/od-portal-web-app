"use client";

import { createContext, useContext } from "react";

// Read server-side once in (app)/layout.tsx (a server component with access
// to the encrypted session) and handed down as plain props -- no client-side
// session fetch/endpoint needed for one boolean.
const SessionContext = createContext(false);

export function SessionProvider({ isExternalGrant, children }: { isExternalGrant: boolean; children: React.ReactNode }) {
  return <SessionContext.Provider value={isExternalGrant}>{children}</SessionContext.Provider>;
}

// Internal-only routes (notifications, alerts, devices) 404 for external
// grants -- technical_plan.md §1. Consumers use this to hide UI that would
// otherwise fail with a 404, mirroring the reference mobile client's
// `profile.isExternal` tab-hiding.
export function useIsExternalGrant() {
  return useContext(SessionContext);
}
