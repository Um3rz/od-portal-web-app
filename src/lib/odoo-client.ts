// Server-only fetch wrapper for the Odoo mobile API. technical_plan.md §1:
// preserve 401/404/429 as real statuses (Odoo's mobile routes are type="http"
// for exactly this reason), never make an authorization decision here that
// belongs to Odoo, never follow a redirect.
import "server-only";
import { validateOdooOrigin } from "./ssrf";
import { getSession } from "./session";

export class OdooUnauthenticatedError extends Error {}

export interface OdooResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

/**
 * Proxies one call to `${odooOrigin}${path}` using the API key held in the
 * encrypted session. Re-validates the origin immediately before the request
 * (see ssrf.ts doc comment on why this isn't a one-time check).
 */
export async function callOdoo(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<OdooResponse> {
  const session = await getSession();
  if (!session.odooOrigin || !session.apiKey) {
    throw new OdooUnauthenticatedError("No active Odoo session.");
  }

  const origin = await validateOdooOrigin(session.odooOrigin);

  const res = await fetch(`${origin}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.apiKey}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    redirect: "manual", // never follow a redirect off the validated origin
    cache: "no-store",
  });

  // A redirect response lands here (not thrown) because redirect: "manual"
  // turns it into an opaqueredirect/3xx instead of following it.
  if (res.status >= 300 && res.status < 400) {
    return { status: 502, body: { error: "unexpected_redirect" }, headers: res.headers };
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: "invalid_upstream_response" };
    }
  }

  return { status: res.status, body, headers: res.headers };
}
