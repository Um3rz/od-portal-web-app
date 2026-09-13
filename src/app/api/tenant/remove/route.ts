// Drops one connected server from the session, regardless of whether it's
// the active one -- unlike /logout (which only ever signs out the active
// server against Odoo itself), this just forgets the local connection.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { captureServerEvent } from "@/lib/posthog-server";

export async function POST(req: Request) {
  const { accountId } = await req.json().catch(() => ({}));
  if (typeof accountId !== "string") {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  const session = await getSession();
  const removedAccount = session.accounts?.find((account) => account.id === accountId);
  const wasActiveAccount = session.activeAccountId === accountId;
  const remaining = (session.accounts ?? []).filter((a) => a.id !== accountId);
  if (!removedAccount) {
    return NextResponse.json({ error: "Unknown account." }, { status: 404 });
  }
  if (remaining.length > 0) {
    session.accounts = remaining;
    if (session.activeAccountId === accountId) session.activeAccountId = remaining[0].id;
    await session.save();
  } else {
    session.destroy();
  }

  await captureServerEvent(removedAccount.id, "server_removed", {
    active_account: wasActiveAccount,
    remaining_count: remaining.length,
    external_grant: Boolean(removedAccount.isExternalGrant),
  });

  return NextResponse.json({ ok: true, remaining: remaining.length });
}
