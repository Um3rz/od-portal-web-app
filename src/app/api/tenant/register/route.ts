// Onboarding: user pastes an Odoo origin + mobile API key (or external-grant
// token). Validates both against the real Odoo instance before persisting
// anything into the encrypted session. technical_plan.md §1/§3.
import { NextResponse } from "next/server";
import { validateOdooOrigin, SsrfValidationError } from "@/lib/ssrf";
import { getSession } from "@/lib/session";
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

  const { odooUrl, apiKey } = await req.json().catch(() => ({}));
  if (typeof odooUrl !== "string" || typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json({ error: "odooUrl and apiKey are required" }, { status: 400 });
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

  const session = await getSession();
  session.odooOrigin = origin;
  session.apiKey = apiKey;
  session.contractVersion = pingBody.contract_version;
  await session.save();

  return NextResponse.json({ ok: true, contractVersion: pingBody.contract_version });
}
