"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/icon/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetSkeleton, type SkeletonVariant } from "@/components/dashboard/widget-skeleton";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useDashboards } from "@/hooks/use-dashboards";
import { useFavourites } from "@/hooks/use-favourites";
import { captureEvent } from "@/lib/posthog-client";
import { cn } from "@/lib/utils";

// Shaped like the real carousel chrome (picker strip + widget grid + floating
// nav pill) rather than a bare spinner, same reasoning as
// DashboardCardSkeleton for the gallery view -- this covers the "which
// dashboards exist" fetch, before DashboardView's own per-widget skeletons
// (already wired via DashboardRenderer) take over for each slide.
const SKELETON_VARIANTS: SkeletonVariant[] = ["tile", "chart", "table", "tile", "chart", "note"];

function CarouselSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy="true" aria-label="Loading dashboards">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
        {[72, 96, 84].map((w, i) => <Skeleton key={i} className="h-7 shrink-0 rounded-full" style={{ width: w }} />)}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_VARIANTS.map((variant, i) => <WidgetSkeleton key={i} variant={variant} />)}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <Skeleton className="h-[52px] w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Landing-page default (technical_plan.md F7): one dashboard at a time,
// starred dashboards first, mirroring the reference mobile client's
// dot-paginated home screen but with a name picker + arrows added for the
// web (mouse/keyboard) surface.
export function DashboardCarousel() {
  const { data: dashboards, isLoading } = useDashboards();
  const { ids: favouriteIds, isFavourite, toggle: toggleFavourite } = useFavourites();
  // Tracked by dashboard id, not a raw slide position -- starring the
  // currently-viewed dashboard reorders `ordered` (favourites float to the
  // front) on the very next render, and a position-based index would jump to
  // whatever dashboard now sits at that slot instead of staying put.
  const [activeId, setActiveId] = useState<number | null>(null);

  const ordered = useMemo(() => {
    const list = dashboards ?? [];
    const favs = list.filter((d) => favouriteIds.includes(d.id));
    const rest = list.filter((d) => !favouriteIds.includes(d.id));
    return [...favs, ...rest];
  }, [dashboards, favouriteIds]);

  // Falls back to the first slide if nothing's been picked yet, or the
  // active dashboard disappeared (unshared, etc).
  const index = Math.max(ordered.findIndex((d) => d.id === activeId), 0);

  if (isLoading) {
    return <CarouselSkeleton />;
  }

  if (!ordered.length) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">No dashboards found</p>
          <p className="mt-1 text-xs text-fg-muted">Nothing has been shared with you yet.</p>
        </div>
      </div>
    );
  }

  const go = (next: number) => setActiveId(ordered[(next + ordered.length) % ordered.length].id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2">
        {ordered.map((d, i) => (
          <div
            key={d.id}
            className={cn(
              "relative flex shrink-0 items-center whitespace-nowrap rounded-full pl-3 pr-1.5 text-xs font-medium",
              i === index ? "text-white" : "text-fg-muted hover:bg-muted",
            )}
          >
            {i === index && <motion.span layoutId="carousel-picker-active" className="absolute inset-0 rounded-full bg-primary-500" transition={{ duration: 0.3, ease: "easeOut" }} />}
            <button type="button" onClick={() => setActiveId(d.id)} aria-current={i === index} className="relative py-1.5">
              {d.name}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                captureEvent("dashboard_favourite_toggled", { dashboard_id: d.id, favourited: !isFavourite(d.id) });
                toggleFavourite(d.id);
              }}
              aria-label={isFavourite(d.id) ? `Remove ${d.name} from favourites` : `Add ${d.name} to favourites`}
              aria-pressed={isFavourite(d.id)}
              className={cn(
                "relative ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                isFavourite(d.id) ? "[&_svg]:fill-current" : "opacity-60 hover:opacity-100",
              )}
            >
              <Icon name="circle" size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div
          className="flex h-full"
          animate={{ x: `${-index * 100}%` }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {ordered.map((d) => (
            <div key={d.id} className="h-full w-full shrink-0 [&>div]:pb-20">
              <DashboardView dashboardId={d.id} />
            </div>
          ))}
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-border bg-surface px-3 py-2 shadow-[var(--shadow-overlay)]">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={ordered.length < 2}
              aria-label="Previous dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted hover:bg-muted hover:text-primary-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <div className="flex items-center gap-1.5">
              {ordered.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveId(d.id)}
                  aria-label={`Go to ${d.name}`}
                  aria-current={i === index}
                  className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary-500" : "w-2 bg-border hover:bg-fg-subtle")}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={ordered.length < 2}
              aria-label="Next dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted hover:bg-muted hover:text-primary-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
