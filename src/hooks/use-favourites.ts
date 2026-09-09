"use client";

import { useCallback, useState } from "react";

// Local to this browser/client, per technical_plan.md §7 assumptions --
// no server-side favourites endpoint exists in the mobile contract.
const STORAGE_KEY = "odsaas-favourite-dashboards";

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function useFavourites() {
  // Lazy-initialized from localStorage -- this hook is only used inside the
  // authenticated (app) route group, which never renders server-side HTML a
  // user sees before hydration (the layout redirects there), so the
  // SSR-vs-client mismatch a bare useState(read()) would normally risk
  // doesn't apply here.
  const [ids, setIds] = useState<number[]>(() => read());

  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavourite = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, toggle, isFavourite };
}
