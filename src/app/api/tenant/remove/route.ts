// Drops one connected server from the session, regardless of whether it's
// the active one -- unlike /logout (which only ever signs out the active
// server against Odoo itself), this just forgets the local connection.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const { accountId } = await req.json().catch(() => ({}));
  if (typeof accountId !== "string") {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  const session = await getSession();
  const remaining = (session.accounts ?? []).filter((a) => a.id !== accountId);
  if (remaining.length === (session.accounts?.length ?? 0)) {
    return NextResponse.json({ error: "Unknown account." }, { status: 404 });
  }
  if (remaining.length > 0) {
    session.accounts = remaining;
    if (session.activeAccountId === accountId) session.activeAccountId = remaining[0].id;
    await session.save();
  } else {
    session.destroy();
  }
  return NextResponse.json({ ok: true, remaining: remaining.length });
}
