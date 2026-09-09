"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Icon } from "@/components/icon/icon";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/tag";
import { Spinner } from "@/components/ui/spinner";
import { useDashboards } from "@/hooks/use-dashboards";
import { useFavourites } from "@/hooks/use-favourites";

const STATE_TONE: Record<string, "success" | "neutral" | "warning"> = {
  active: "success",
  draft: "neutral",
  inactive: "warning",
};

export default function DashboardsPage() {
  const { data: dashboards, isLoading, isError, dataUpdatedAt } = useDashboards();
  const { isFavourite, toggle } = useFavourites();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = dashboards ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((d) => d.name.toLowerCase().includes(q)) : list;
  }, [dashboards, search]);

  return (
    <>
      <Topbar title="Dashboards" subtitle="Everything you're authorized to see in Odoo" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
            />
            <Input
              placeholder="Search dashboards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {dashboards && !isLoading && (
            <span className="text-xs text-fg-subtle">
              As of {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-dashed border-[hsl(220_13%_82%)] p-8 text-center">
            <p className="text-sm font-semibold">Couldn&apos;t load dashboards</p>
            <p className="mt-1 text-xs text-fg-muted">
              Showing cached data if any is available offline.
            </p>
          </div>
        )}

        {!isLoading && filtered.length === 0 && !isError && (
          <div className="rounded-lg border border-dashed border-[hsl(220_13%_82%)] p-8 text-center">
            <p className="text-sm font-semibold">No dashboards found</p>
            <p className="mt-1 text-xs text-fg-muted">
              {search ? "Try a different search." : "Nothing has been shared with you yet."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Link key={d.id} href={`/dashboards/${d.id}`}>
              <Card className="flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-overlay)]">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                    <Icon name="dashboard" size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toggle(d.id);
                    }}
                    className="text-fg-subtle hover:text-primary-500 data-[active=true]:text-primary-500"
                    data-active={isFavourite(d.id)}
                    aria-label={isFavourite(d.id) ? "Remove from favourites" : "Add to favourites"}
                  >
                    <Icon name={isFavourite(d.id) ? "check-circle" : "plus-circle"} size={18} />
                  </button>
                </div>
                <div>
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-fg-muted">{d.item_count} items</p>
                </div>
                <Lozenge tone={STATE_TONE[d.state] ?? "neutral"} className="mt-auto self-start">
                  {d.state}
                </Lozenge>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
