"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icon/icon";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [server, setServer] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [odooUrl, setOdooUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/tenant/status").then((response) => response.ok ? response.json() : null).then((body) => setServer(body?.odooOrigin ?? null));
  }, []);

  async function switchServer(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    setError(null);
    const response = await fetch("/api/tenant/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ odooUrl, apiKey }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("error");
      setError(body.error ?? "Could not connect to this server.");
      return;
    }
    queryClient.clear();
    window.localStorage.removeItem("odsaas-query-cache");
    router.replace("/dashboards");
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Connection</p>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-500"><Icon name="server" size={18} /></span><div className="min-w-0"><p className="text-sm font-semibold">Current Odoo server</p><p className="mt-1 truncate text-sm text-fg-muted">{server ?? "Loading…"}</p></div></div>
              <Button variant="outline" size="compact" onClick={() => setShowForm((value) => !value)}><Icon name="plus" size={15} /> Add server</Button>
            </div>
            {showForm && <form onSubmit={switchServer} className="mt-5 flex flex-col gap-3 border-t border-border pt-5"><p className="text-xs text-fg-muted">Connect another server to make it the active workspace. Your API key is encrypted in the server session and is not saved in this browser.</p><Input aria-label="Odoo server URL" placeholder="https://yourcompany.odoo.com" value={odooUrl} onChange={(event) => setOdooUrl(event.target.value)} required /><Input aria-label="Odoo API key" type="password" placeholder="Mobile API key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required />{state === "error" && <p className="text-xs text-danger">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="compact" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" size="compact" disabled={state === "loading"}>{state === "loading" ? <Spinner size={15} className="text-white" /> : "Connect server"}</Button></div></form>}
          </Card>
        </section>

        <section><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Storage</p><Card className="divide-y divide-border"><button type="button" className="flex w-full items-center justify-between p-5 text-left hover:bg-muted" onClick={() => { queryClient.clear(); window.localStorage.removeItem("odsaas-query-cache"); }}><span><span className="block text-sm font-semibold">Clear cached dashboard data</span><span className="mt-1 block text-xs text-fg-muted">Remove locally saved results and reload fresh data next time.</span></span><Icon name="chevron-right" size={17} className="text-fg-subtle" /></button></Card></section>
        <section><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Support</p><Card className="divide-y divide-border"><a href="mailto:support@example.com" className="flex items-center justify-between p-5 text-sm font-semibold hover:bg-muted">Email support <Icon name="chevron-right" size={17} className="text-fg-subtle" /></a><div className="flex items-center justify-between p-5 text-sm text-fg-muted"><span>Odoo Dashboards</span><span>Web app</span></div></Card></section>
      </div>
    </div>
  );
}
