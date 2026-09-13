// Same-origin BFF proxy: /api/odoo/mobile/v1/... -> {tenant origin}/mobile/v1/...
// Normalizes nothing about Odoo's status codes -- 401/404/429 pass through
// exactly as callOdoo() returns them (technical_plan.md §1).
import { NextResponse } from "next/server";
import { callOdoo, OdooUnauthenticatedError } from "@/lib/odoo-client";
import { getSession, getActiveAccount } from "@/lib/session";
import { hit, retryAfterSeconds } from "@/lib/rate-limit";

const SESSION_LIMIT = 120;
const SESSION_WINDOW_SECONDS = 60;

// Only the documented mobile contract (technical_plan.md §1) is proxyable --
// this is a same-origin BFF for one specific API, not an open relay.
const ALLOWED_PREFIX = "/mobile/v1/";

async function handle(req: Request, path: string[]) {
  // Next decodes each catch-all segment before handing it to us, but does
  // NOT collapse "." / ".." segments -- that happens later, inside fetch()'s
  // URL parser, when `${origin}${upstreamPath}` is resolved as a full URL.
  // A prefix check on the pre-normalization string can pass
  // ("/mobile/v1/../../web/login".startsWith("/mobile/v1/") is true) for a
  // path that resolves somewhere else entirely once fetched
  // ("${origin}/web/login") -- reject dot-segments outright rather than
  // trying to out-think URL normalization.
  if (path.some((segment) => segment === "." || segment === "..")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const upstreamPath = `/${path.join("/")}`;
  if (!upstreamPath.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getSession();
  const account = getActiveAccount(session);
  const bucketKey = account ? `key:${account.apiKey.slice(0, 8)}` : "anon";
  if (!hit(`bff:${bucketKey}`, SESSION_LIMIT, SESSION_WINDOW_SECONDS)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(`bff:${bucketKey}`)) } },
    );
  }

  const search = new URL(req.url).search;
  const body = req.method === "POST" ? await req.json().catch(() => undefined) : undefined;

  try {
    const upstream = await callOdoo(`${upstreamPath}${search}`, { method: req.method, body });
    const headers = new Headers();
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    return NextResponse.json(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    if (err instanceof OdooUnauthenticatedError) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    throw err;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path);
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path);
}
