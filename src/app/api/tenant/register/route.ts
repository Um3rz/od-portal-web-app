// Onboarding AND "add another server": user pastes an Odoo origin +
// external API key. Validates both against the real Odoo instance before
// persisting anything into the encrypted session. technical_plan.md §1/§3.
// This endpoint always ADDS an account (or re-activates a matching existing
// one) -- it never replaces the accounts already in the session, so
// connecting a new server doesn't drop the old connection.
import { NextResponse } from "next/server";
import { validateOdooOrigin, SsrfValidationError } from "@/lib/ssrf";
import { getSession, type OdooAccount } from "@/lib/session";
import { hit, retryAfterSeconds } from "@/lib/rate-limit";

const REGISTER_LIMIT = 10;
const REGISTER_WINDOW_SECONDS = 60;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!hit(`register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_SECONDS)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(`register:${ip}`)) } },
    );
  }

  const { odooUrl, apiKey, name } = await req.json().catch(() => ({}));
  if (typeof odooUrl !== "string" || typeof apiKey !== "string" || !apiKey.trim() || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "odooUrl, apiKey and name are required" }, { status: 400 });
  }

  let origin: string;
  try {
    origin = await validateOdooOrigin(odooUrl);
  } catch (err) {
    if (err instanceof SsrfValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Unauthenticated: confirms this is actually an Odoo Dashboards install
  // and surfaces contract_version before we ever try the key.
  let ping: Response;
  try {
    ping = await fetch(`${origin}/mobile/v1/ping`, { redirect: "manual", cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Could not reach this Odoo instance." }, { status: 502 });
  }
  if (!ping.ok) {
    return NextResponse.json({ error: "This does not look like an Odoo Dashboards instance." }, { status: 502 });
  }
  const pingBody = await ping.json().catch(() => null);
  if (!pingBody?.ok) {
    return NextResponse.json({ error: "This does not look like an Odoo Dashboards instance." }, { status: 502 });
  }

  // Authenticated: the only way to actually validate the key is to use it.
  // Bad-key attempts are also Odoo's own rate-limited bucket
  // (BAD_KEY_LIMIT/BAD_KEY_WINDOW in mobile.py) -- a 429 here is Odoo's, not
  // ours, and must pass through untouched.
  let check: Response;
  try {
    check = await fetch(`${origin}/mobile/v1/dashboards`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach this Odoo instance." }, { status: 502 });
  }
  if (check.status === 429) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": check.headers.get("Retry-After") ?? "60" } },
    );
  }
  if (check.status === 401) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }
  if (!check.ok) {
    return NextResponse.json({ error: "Could not verify this key." }, { status: 502 });
  }

  // External-access grants 404 on every internal-only route (notifications,
  // alerts, devices -- _internal_mobile_or_404 in mobile.py); probing one of
  // them here is the only way to tell the two key types apart, since the
  // backend has no dedicated "what kind of key is this" field. Same heuristic
  // the reference mobile client uses (codename-portals' probeExternal()).
  let isExternalGrant = false;
  try {
    const probe = await fetch(`${origin}/mobile/v1/notifications`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: "manual",
      cache: "no-store",
    });
    isExternalGrant = probe.status === 404;
  } catch {
    // Unreachable here is surprising (the key check above just succeeded
    // against the same origin) -- default to false rather than hiding
    // internal-only UI for a real internal user over a transient blip.
  }

  const session = await getSession();
  const accounts = session.accounts ?? [];
  const existing = accounts.find((a) => a.odooOrigin === origin && a.apiKey === apiKey);
  let account: OdooAccount;
  if (existing) {
    // Same server + same key already connected -- refresh its metadata and
    // just re-activate it rather than adding a duplicate entry.
    existing.name = name.trim();
    existing.contractVersion = pingBody.contract_version;
    existing.isExternalGrant = isExternalGrant;
    account = existing;
  } else {
    account = {
      id: crypto.randomUUID(),
      name: name.trim(),
      odooOrigin: origin,
      apiKey,
      contractVersion: pingBody.contract_version,
      isExternalGrant,
    };
    accounts.push(account);
  }
  session.accounts = accounts;
  session.activeAccountId = account.id;
  await session.save();

  return NextResponse.json({ ok: true, contractVersion: pingBody.contract_version });
}
