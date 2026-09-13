// Signs out of the ACTIVE server only -- other connected servers (see
// session.ts's accounts list) stay connected, matching the mobile app's
// per-server disconnect. Only destroys the whole session once no accounts
// are left.
import { NextResponse } from "next/server";
import { callOdoo, OdooUnauthenticatedError } from "@/lib/odoo-client";
import { getSession } from "@/lib/session";

export async function POST() {
  try {
    await callOdoo("/mobile/v1/logout", { method: "POST" });
  } catch (err) {
    if (!(err instanceof OdooUnauthenticatedError)) throw err;
  }
  const session = await getSession();
  const remaining = (session.accounts ?? []).filter((a) => a.id !== session.activeAccountId);
  if (remaining.length > 0) {
    session.accounts = remaining;
    session.activeAccountId = remaining[0].id;
    await session.save();
  } else {
    session.destroy();
  }
  return NextResponse.json({ ok: true, remaining: remaining.length });
}
