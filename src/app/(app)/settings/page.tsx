"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icon/icon";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  odooOrigin: string;
  apiKeyLast4: string;
  isActive: boolean;
}

interface Status {
  name: string;
  odooOrigin: string;
  apiKeyLast4: string;
  accounts: Account[];
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [serverName, setServerName] = useState("");
  const [odooUrl, setOdooUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [switching, setSwitching] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  function refreshStatus() {
    void fetch("/api/tenant/status", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)).then(setStatus);
  }

  useEffect(refreshStatus, []);

  // A previous account's cache must never leak into whichever account
  // becomes active -- see hooks/use-dashboards.ts.
  function switchToDashboards() {
    queryClient.clear();
    window.localStorage.removeItem("odsaas-query-cache");
    router.replace("/dashboards");
    router.refresh();
  }

  async function addServer(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    setError(null);
    const response = await fetch("/api/tenant/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ odooUrl, apiKey, name: serverName }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("error");
      setError(body.error ?? "Could not connect to this server.");
      return;
    }
    switchToDashboards();
  }

  async function switchAccount(accountId: string) {
    setSwitching(accountId);
    const response = await fetch("/api/tenant/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
    setSwitching(null);
    // Query keys are account-scoped (hooks/use-dashboards.ts) -- unlike
    // switchToDashboards() (used after logout/remove), a plain switch keeps
    // the cache so a previously-visited account shows its data instantly.
    if (response.ok) { router.replace("/dashboards"); router.refresh(); }
  }

  async function saveRename(accountId: string) {
    const name = renameDraft.trim();
    if (!name) { setRenaming(null); return; }
    setRenameSaving(true);
    const response = await fetch("/api/tenant/rename", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, name }) });
    setRenameSaving(false);
    if (response.ok) { setRenaming(null); refreshStatus(); }
  }

  async function removeAccount(account: Account) {
    if (!window.confirm(`Remove "${account.name}"? You'll need to reconnect with its API key to add it back.`)) return;
    setRemoving(account.id);
    const response = await fetch("/api/tenant/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account.id }) });
    const body = await response.json().catch(() => ({}));
    setRemoving(null);
    if (!response.ok) return;
    if (!account.isActive) { refreshStatus(); return; }
    if (body.remaining > 0) { switchToDashboards(); return; }
    queryClient.clear();
    window.localStorage.removeItem("odsaas-query-cache");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Account</p>
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500"><Icon name="lock" size={18} /></span>
              <div className="min-w-0">
                <p className="text-xs text-fg-subtle">Server name</p>
                <p className="truncate text-sm font-semibold">{status?.name ?? "Loading…"}</p>
                <p className="mt-3 text-xs text-fg-subtle">External API key</p>
                <p className="text-sm font-semibold">•••• {status?.apiKeyLast4 ?? "…"}</p>
                <p className="mt-3 text-xs text-fg-subtle">Server URL</p>
                <p className="truncate text-sm font-semibold">{status?.odooOrigin ?? "Loading…"}</p>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Servers</p>
          <Card className="divide-y divide-border">
            {status?.accounts.map((account) => renaming === account.id ? (
              <div key={account.id} className="flex w-full items-center gap-2 p-5">
                <Input
                  autoFocus
                  aria-label="Server name"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") saveRename(account.id); if (event.key === "Escape") setRenaming(null); }}
                  className="h-9 flex-1"
                />
                <Button type="button" size="compact" onClick={() => saveRename(account.id)} disabled={renameSaving}>{renameSaving ? <Spinner size={14} className="text-white" /> : "Save"}</Button>
                <Button type="button" variant="ghost" size="compact" onClick={() => setRenaming(null)} disabled={renameSaving}>Cancel</Button>
              </div>
            ) : (
              <div key={account.id} className="flex w-full items-center gap-1 pr-3">
                <button
                  type="button"
                  disabled={account.isActive || switching === account.id}
                  onClick={() => switchAccount(account.id)}
                  className={cn("flex min-w-0 flex-1 items-center justify-between gap-4 p-5 text-left", account.isActive ? "cursor-default" : "hover:bg-muted")}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{account.name}</p>
                    <p className="truncate text-xs text-fg-muted">{account.odooOrigin} · •••• {account.apiKeyLast4}</p>
                  </div>
                  {/* Fixed-width column, content right-aligned within it --
                      without this, the pill/text/icon across these rows (and
                      the "+" row below) each size to their own content and
                      don't share a common right edge. */}
                  <span className="flex w-16 shrink-0 items-center justify-end">
                    {account.isActive ? (
                      <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">Active</span>
                    ) : switching === account.id ? (
                      <Spinner size={16} />
                    ) : (
                      <span className="text-xs font-medium text-primary-700">Switch</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${account.name}`}
                  onClick={() => { setRenaming(account.id); setRenameDraft(account.name); }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-muted hover:text-primary-700"
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${account.name}`}
                  disabled={removing === account.id}
                  onClick={() => removeAccount(account)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger/10 hover:text-danger disabled:pointer-events-none"
                >
                  {removing === account.id ? <Spinner size={15} /> : <Icon name="trash" size={16} />}
                </button>
              </div>
            ))}
            <button type="button" className="flex w-full items-center justify-between p-5 text-left hover:bg-muted" onClick={() => setShowForm((value) => !value)}>
              <span className="text-sm font-semibold">Add another server</span>
              <span className="flex w-16 shrink-0 items-center justify-end"><Icon name="plus" size={17} className="text-fg-subtle" /></span>
            </button>
            {showForm && (
              <form onSubmit={addServer} className="flex flex-col gap-3 p-5">
                <p className="text-xs text-fg-muted">Switching keeps you signed in to every server you&apos;ve connected. Your API key is encrypted in the server session and is not saved in this browser.</p>
                <Input aria-label="Server name" placeholder="e.g. Production" value={serverName} onChange={(event) => setServerName(event.target.value)} required />
                <Input aria-label="Odoo server URL" placeholder="https://yourcompany.odoo.com" value={odooUrl} onChange={(event) => setOdooUrl(event.target.value)} required />
                <Input aria-label="External API key" type="password" placeholder="External API key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required />
                {state === "error" && <p className="text-xs text-danger">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="compact" onClick={() => { setShowForm(false); setServerName(""); setOdooUrl(""); setApiKey(""); }}>Cancel</Button>
                  <Button type="submit" size="compact" disabled={state === "loading"}>{state === "loading" ? <Spinner size={15} className="text-white" /> : "Connect server"}</Button>
                </div>
              </form>
            )}
          </Card>
        </section>

        <section><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Storage</p><Card className="divide-y divide-border"><button type="button" className="flex w-full items-center justify-between p-5 text-left hover:bg-muted" onClick={() => { queryClient.clear(); window.localStorage.removeItem("odsaas-query-cache"); }}><span><span className="block text-sm font-semibold">Clear cached dashboard data</span><span className="mt-1 block text-xs text-fg-muted">Remove locally saved results and reload fresh data next time.</span></span><Icon name="chevron-right" size={17} className="text-fg-subtle" /></button></Card></section>
        <section><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Support</p><Card className="divide-y divide-border"><a href="mailto:support@example.com" className="flex items-center justify-between p-5 text-sm font-semibold hover:bg-muted">Email support <Icon name="chevron-right" size={17} className="text-fg-subtle" /></a><div className="flex items-center justify-between p-5 text-sm text-fg-muted"><span>Odoo Dashboards</span><span>Web app</span></div></Card></section>
      </div>
    </div>
  );
}
