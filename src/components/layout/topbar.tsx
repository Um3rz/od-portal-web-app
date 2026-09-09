"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/icon/icon";
import { Button } from "@/components/ui/button";

export interface TopbarProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
}

export function Topbar({ title, subtitle, showBack }: TopbarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function onLogout() {
    await fetch("/api/tenant/logout", { method: "POST" });
    queryClient.clear();
    window.localStorage.removeItem("odsaas-query-cache");
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      {showBack && (
        <Link
          href="/dashboards"
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg-muted hover:bg-muted hover:text-primary-700"
          aria-label="Back"
        >
          <Icon name="arrow-left" size={16} />
          <span>Dashboards</span>
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate text-sm font-heading font-bold">{title}</h1>}
        {subtitle && <p className="truncate text-xs text-fg-muted">{subtitle}</p>}
      </div>
      <Button variant="ghost" size="compact" onClick={onLogout}>
        <Icon name="external-link" size={14} />
        Disconnect
      </Button>
    </header>
  );
}
