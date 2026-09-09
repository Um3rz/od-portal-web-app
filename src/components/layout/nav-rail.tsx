"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon/icon";
import { Spinner } from "@/components/ui/spinner";
import { useDashboards } from "@/hooks/use-dashboards";
import { useFavourites } from "@/hooks/use-favourites";
import { cn } from "@/lib/utils";

// Viewer-scope nav rail (product plan §3.4): product title + collapse
// control + dashboard navigation. The builder-ready Configurations/Advanced
// Configuration groups are F6 scope, not built here.
export function NavRail() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: dashboards, isLoading } = useDashboards();
  const { isFavourite, toggle } = useFavourites();

  const sorted = [...(dashboards ?? [])].sort((a, b) => {
    const fa = isFavourite(a.id) ? 0 : 1;
    const fb = isFavourite(b.id) ? 0 : 1;
    return fa - fb || a.sequence - b.sequence;
  });

  return (
    <nav
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface transition-[width]",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-14 border-b border-border", collapsed ? "items-center justify-between px-1" : "items-center gap-2 px-3")}>
        <Link href="/dashboards" className={cn("flex min-w-0 items-center rounded-md hover:bg-muted", collapsed ? "h-10 w-10 justify-center" : "flex-1 gap-2 px-1")} aria-label="Odoo Dashboards home">
          <Image src="/Logo_Colored.svg" alt="Odoo Dashboards" width={32} height={32} className="h-8 w-8 shrink-0" />
          {!collapsed && <span className="truncate text-sm font-heading font-bold">Odoo Dashboards</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn("flex h-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-muted", collapsed ? "w-6" : "ml-auto w-8")}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!collapsed && (
          <div className="mb-1 flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
              Dashboards
            </span>
            {dashboards && <span className="text-[11px] text-fg-subtle">{dashboards.length}</span>}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Spinner size={18} />
          </div>
        )}

        <ul className="flex flex-col gap-0.5">
          {sorted.map((d) => {
            const href = `/dashboards/${d.id}`;
            const active = pathname === href;
            return (
              <li key={d.id} className="group/item flex items-center gap-1">
                <Link
                  href={href}
                  title={collapsed ? d.name : undefined}
                  className={cn(
                    "flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-50 font-medium text-primary-700"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon name="dashboard" size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{d.name}</span>}
                </Link>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggle(d.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle opacity-0 hover:bg-muted group-hover/item:opacity-100 data-[active=true]:opacity-100 data-[active=true]:text-primary-500"
                    data-active={isFavourite(d.id)}
                    aria-label={isFavourite(d.id) ? "Remove from favourites" : "Add to favourites"}
                  >
                    <Icon name={isFavourite(d.id) ? "check-circle" : "plus-circle"} size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
