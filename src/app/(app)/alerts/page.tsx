"use client";

// Combined inbox + alert-rules screen, same layout as the reference mobile
// client's (tabs)/alerts.tsx: one screen, two sections, no separate
// "create alert" form here -- rules are created from a widget's own alert
// button (dashboard-renderer.tsx), scoped to that widget by construction.
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon/icon";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { useAlerts, useDeleteAlert } from "@/hooks/use-alerts";
import { useIsExternalGrant } from "@/components/session-provider";
import { ApiError } from "@/lib/api";

const INBOX_LIMIT = 15;

function notificationDate(raw: string) {
  const date = new Date(raw.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AlertsPage() {
  const isExternalGrant = useIsExternalGrant();
  const notifications = useNotifications();
  const alerts = useAlerts();
  const markRead = useMarkNotificationRead();
  const deleteAlert = useDeleteAlert();
  const [showAll, setShowAll] = useState(false);

  if (isExternalGrant) {
    return (
      <>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-semibold">Not available for this account</p>
            <p className="mt-1 text-xs text-fg-muted">Alerts and notifications are owned by an Odoo user account, not an external share link.</p>
          </div>
        </div>
      </>
    );
  }

  const loading = notifications.isLoading && alerts.isLoading;
  const notFound = (notifications.error instanceof ApiError && notifications.error.status === 404) || (alerts.error instanceof ApiError && alerts.error.status === 404);
  const inbox = notifications.data ?? [];
  const visibleInbox = showAll ? inbox : inbox.slice(0, INBOX_LIMIT);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        {loading && <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>}

        {notFound && (
          <div className="mb-4 rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-semibold">Not available for this account</p>
            <p className="mt-1 text-xs text-fg-muted">Alerts and notifications are owned by an Odoo user account, not an external share link.</p>
          </div>
        )}

        {!loading && !notFound && (
          <>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Inbox</h2>
            {inbox.length === 0 ? (
              <Card className="mb-6 p-5">
                <p className="text-sm font-semibold">No notifications yet.</p>
                <p className="mt-1 text-xs text-fg-muted">Alerts will appear here as they fire.</p>
              </Card>
            ) : (
              <div className="mb-2 flex flex-col gap-2">
                {visibleInbox.map((n) => (
                  <Card
                    key={n.id}
                    className={n.state !== "read" ? "cursor-pointer border-primary-300 p-4" : "cursor-pointer p-4"}
                    onClick={() => n.state !== "read" && markRead.mutate(n.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      {n.kind !== "broadcast" && (
                        <span className="shrink-0 rounded-sm bg-primary-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary-700">{n.kind}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-fg-muted">{n.body}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-xs text-fg-subtle">{notificationDate(n.created_at)}</span>
                      {n.state !== "read" ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary-500"><span className="h-1.5 w-1.5 rounded-full bg-current" />unread</span>
                      ) : (
                        <span className="text-xs text-fg-subtle">read</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {!showAll && inbox.length > INBOX_LIMIT && (
              <button type="button" onClick={() => setShowAll(true)} className="mb-6 block w-full text-center text-sm font-medium text-primary-500 hover:underline">
                View more ({inbox.length - INBOX_LIMIT} more)
              </button>
            )}

            <h2 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Alert rules</h2>
            {(alerts.data ?? []).length === 0 ? (
              <Card className="p-5">
                <p className="text-sm font-semibold">No alert rules yet.</p>
                <p className="mt-1 text-xs text-fg-muted">Create an alert from a dashboard widget&apos;s alert icon.</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {alerts.data!.map((rule) => (
                  <Card key={rule.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{rule.analytic_name || `Widget ${rule.analytic_id}`}</p>
                        <p className="mt-1 text-xs text-fg-muted">
                          {rule.column} {rule.operator.replace("_", " ")}{rule.threshold != null ? ` ${rule.threshold}` : ""} · {rule.scope.replace("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-fg-subtle">{rule.dashboard_name || `Dashboard ${rule.dashboard_id}`}</p>
                      </div>
                      <Button variant="ghost" size="compact" onClick={() => deleteAlert.mutate(rule.id)} aria-label="Remove alert">
                        <Icon name="trash" size={15} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
