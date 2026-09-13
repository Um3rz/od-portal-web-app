"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type ViewMode = "carousel" | "gallery";

const STORAGE_KEY = "odsaas-dashboards-view-mode";
const ViewModeContext = createContext<{ mode: ViewMode; setMode: (mode: ViewMode) => void } | null>(null);

function readStoredMode(): ViewMode {
  if (typeof window === "undefined") return "carousel";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "gallery" || saved === "carousel" ? saved : "carousel";
  } catch {
    return "carousel";
  }
}

// Carousel is the default landing experience (technical_plan.md F7); gallery
// is opt-in and remembered per browser, same lazy-init pattern as
// useFavourites (this hook is only ever used inside the authenticated route
// group, which never renders server-side HTML a user sees before hydration).
export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(() => readStoredMode());

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
