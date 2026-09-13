"use client";

// Ported from codename-portals' AlertSheet.tsx (same fields, same operator
// set, same conditional threshold/window visibility) -- restyled with this
// app's own primitives instead of React Native's.
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icon/icon";
import { useCreateAlert } from "@/hooks/use-alerts";
import type { AlertOperator, AlertScope } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const OPERATORS: Array<{ value: AlertOperator; label: string }> = [
  { value: "below", label: "Below" },
  { value: "above", label: "Above" },
  { value: "drops_pct", label: "Drops by %" },
  { value: "rises_pct", label: "Rises by %" },
  { value: "below_target", label: "Below target" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-primary-500 bg-primary-500 text-white" : "border-border bg-white text-foreground hover:bg-primary-50",
      )}
    >
      {children}
    </button>
  );
}

export function AlertDialog({ dashboardId, analyticId, widgetName, onClose }: { dashboardId: number; analyticId: number; widgetName: string; onClose: () => void }) {
  const [operator, setOperator] = useState<AlertOperator>("below");
  const [column, setColumn] = useState("value");
  const [threshold, setThreshold] = useState("");
  const [windowDays, setWindowDays] = useState("7");
  const [scope, setScope] = useState<AlertScope>("aggregate");
  const [error, setError] = useState("");
  const create = useCreateAlert();

  const needsThreshold = operator !== "below_target";
  const needsWindow = operator === "drops_pct" || operator === "rises_pct";

  function submit() {
    setError("");
    if (needsThreshold && (!threshold.trim() || Number.isNaN(Number(threshold)))) {
      setError("Threshold is required.");
      return;
    }
    create.mutate(
      {
        dashboard_id: dashboardId,
        analytic_id: analyticId,
        column: column.trim() || "value",
        operator,
        scope,
        dimension_filter: {},
        ...(needsThreshold ? { threshold: Number(threshold) } : {}),
        ...(needsWindow ? { window_days: Number(windowDays) || 7 } : {}),
      },
      {
        onSuccess: onClose,
        onError: (err) =>
          setError(err instanceof ApiError && err.status === 404 ? "Alerts aren't available for this account." : "Couldn't create the alert."),
      },
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--modal-backdrop,rgba(0,0,0,0.32))] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-[var(--shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-heading font-bold">Alert me when…</h2>
        <p className="mb-4 truncate text-xs text-fg-muted">{widgetName}</p>

        <p className="mb-1.5 text-xs font-semibold text-fg-muted">When</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {OPERATORS.map((o) => (
            <Chip key={o.value} active={operator === o.value} onClick={() => setOperator(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-fg-muted" htmlFor="alert-column">Column</label>
        <Input id="alert-column" className="mb-3" value={column} onChange={(e) => setColumn(e.target.value)} placeholder="value, amount, y…" />

        {needsThreshold && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted" htmlFor="alert-threshold">Threshold</label>
            <Input id="alert-threshold" className="mb-3" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="e.g. 50" />
          </>
        )}
        {needsWindow && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-fg-muted" htmlFor="alert-window">Window (days)</label>
            <Input id="alert-window" className="mb-3" type="number" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} />
          </>
        )}

        <p className="mb-1.5 text-xs font-semibold text-fg-muted">Scope</p>
        <div className="mb-4 flex gap-1.5">
          <Chip active={scope === "aggregate"} onClick={() => setScope("aggregate")}>Aggregate</Chip>
          <Chip active={scope === "any_row"} onClick={() => setScope("any_row")}>Any row</Chip>
        </div>

        {error && <p className="mb-3 flex items-center gap-1.5 text-xs text-danger"><Icon name="alert-circle" size={14} />{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="compact" onClick={onClose}>Cancel</Button>
          <Button size="compact" disabled={create.isPending} onClick={submit}>{create.isPending ? "Saving…" : "Create alert"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
