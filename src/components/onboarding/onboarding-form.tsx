"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function OnboardingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [odooUrl, setOdooUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    const res = await fetch("/api/tenant/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ odooUrl, apiKey, name }),
    });
    const body = await res.json();
    if (res.ok) {
      setState("ok");
      // A previous tenant's cache (in-memory + localStorage-persisted) must
      // never leak into this one -- see hooks/use-dashboards.ts.
      queryClient.clear();
      window.localStorage.removeItem("odsaas-query-cache");
      router.replace("/dashboards");
      router.refresh();
    } else {
      setState("error");
      setError(body.error ?? "Something went wrong.");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2">
          <Image src="/Logo_Colored.svg" alt="Odoo Dashboards" width={40} height={40} className="h-10 w-10" />
          <h1 className="text-lg font-heading font-bold">Connect your Odoo</h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="serverName" className="text-xs font-medium text-fg-muted">
              Server name
            </label>
            <Input
              id="serverName"
              placeholder="e.g. Production"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="odooUrl" className="text-xs font-medium text-fg-muted">
              Odoo URL
            </label>
            <Input
              id="odooUrl"
              placeholder="https://yourcompany.odoo.com"
              value={odooUrl}
              onChange={(e) => setOdooUrl(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="apiKey" className="text-xs font-medium text-fg-muted">
              External API key
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Paste your external API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </div>
          {state === "error" && <p className="text-xs text-danger">{error}</p>}
          {state === "ok" && <p className="text-xs text-success">Connected.</p>}
          <Button type="submit" disabled={state === "loading"}>
            {state === "loading" ? <Spinner size={16} className="text-white" /> : "Connect"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
