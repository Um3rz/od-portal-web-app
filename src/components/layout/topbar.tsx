"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/icon/icon";
import { Button } from "@/components/ui/button";
import { useDashboards } from "@/hooks/use-dashboards";
import { useViewMode } from "@/components/view-mode-provider";

export interface TopbarProps { title?: string; subtitle?: string; dashboardId?: number; }

export function Topbar({ title, subtitle, dashboardId }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: dashboards } = useDashboards();
  const { mode, setMode } = useViewMode();
  const [open, setOpen] = useState(false);
  const routeDashboardId = pathname.match(/^\/dashboards\/(\d+)$/)?.[1];
  const current = dashboards?.find((dashboard) => dashboard.id === (dashboardId ?? Number(routeDashboardId)));
  const isSettings = pathname === "/settings";
  const isAlerts = pathname === "/alerts";
  const isDashboardsHome = pathname === "/dashboards";
  // Carousel view has its own name-picker strip beneath the topbar (see
  // DashboardCarousel); the dropdown switcher stays only for the gallery
  // view and every other screen, so the two pickers don't duplicate.
  const showPicker = !(isDashboardsHome && mode === "carousel");

  async function onLogout() {
    if (!window.confirm("Disconnect this server? You'll stay signed in to any other connected servers.")) return;
    await fetch("/api/tenant/logout", { method: "POST" });
    // A previous account's cache must never leak into whichever account is
    // active afterward -- see hooks/use-dashboards.ts. The layout server
    // component decides where "afterward" is: /dashboards if another
    // account is still active, "/" (onboarding) if none are left.
    queryClient.clear();
    window.localStorage.removeItem("odsaas-query-cache");
    router.replace("/dashboards");
    router.refresh();
  }

  return (
    <header className="relative z-30 flex min-h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-5">
      <Link href="/dashboards" className="flex shrink-0 items-center gap-2" aria-label="Odoo Dashboards home">
        <Image src="/Logo_Colored.svg" alt="" width={34} height={34} className="h-8 w-8" />
        <span className="hidden text-sm font-bold text-foreground sm:inline">Odoo Dashboards</span>
      </Link>
      <div className="h-7 w-px bg-border" />
      <div className="relative min-w-0 flex-1">
        {showPicker ? (
          <>
            <button type="button" className="flex max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{current?.name ?? title ?? (isSettings ? "Settings" : isAlerts ? "Alerts" : "Dashboards")}</span>
                {subtitle && <span className="block truncate text-xs text-fg-muted">{subtitle}</span>}
              </span>
              <Icon name="chevron-down" size={15} className="shrink-0 text-fg-muted" />
            </button>
            {open && <>
              <button type="button" className="fixed inset-0 cursor-default" aria-label="Close dashboard menu" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-12 z-40 w-72 rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-overlay)]" role="menu">
                <Link href="/dashboards" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"><Icon name="dashboard" size={16} /> All dashboards</Link>
                {dashboards?.map((dashboard) => <Link key={dashboard.id} href={`/dashboards/${dashboard.id}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"><span className="truncate">{dashboard.name}</span><span className="shrink-0 text-xs text-fg-subtle">{dashboard.item_count}</span></Link>)}
              </div>
            </>}
          </>
        ) : (
          <span className="block truncate px-2 py-1.5 text-sm font-bold">Dashboards</span>
        )}
      </div>
      <nav className="flex shrink-0 items-center gap-1" aria-label="Application navigation">
        {isDashboardsHome && (
          <div className="mr-1 flex items-center gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="Switch dashboards view">
            <button type="button" onClick={() => setMode("carousel")} aria-pressed={mode === "carousel"} aria-label="Carousel view" className={`flex h-8 w-8 items-center justify-center rounded ${mode === "carousel" ? "bg-surface text-primary-700 shadow-sm" : "text-fg-muted hover:text-primary-700"}`}><Icon name="columns" size={16} /></button>
            <button type="button" onClick={() => setMode("gallery")} aria-pressed={mode === "gallery"} aria-label="Gallery view" className={`flex h-8 w-8 items-center justify-center rounded ${mode === "gallery" ? "bg-surface text-primary-700 shadow-sm" : "text-fg-muted hover:text-primary-700"}`}><Icon name="tile" size={16} /></button>
          </div>
        )}
        <Link href="/alerts" className={`flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium ${isAlerts ? "bg-primary-50 text-primary-700" : "text-fg-muted hover:bg-muted hover:text-primary-700"}`}><Icon name="bell" size={17} /><span className="hidden md:inline">Alerts</span></Link>
        <Link href="/settings" className={`flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium ${isSettings ? "bg-primary-50 text-primary-700" : "text-fg-muted hover:bg-muted hover:text-primary-700"}`}><Icon name="settings" size={17} /><span className="hidden md:inline">Settings</span></Link>
        <Button variant="ghost" size="compact" onClick={onLogout}><Icon name="external-link" size={14} /><span className="hidden sm:inline">Disconnect</span></Button>
      </nav>
    </header>
  );
}
