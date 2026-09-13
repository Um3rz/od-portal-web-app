// Switches the active account among already-connected servers -- no
// re-validation against Odoo, the account was already validated when it was
// added (register/route.ts). Lets the user move between connections without
// re-entering credentials, same as the mobile app's server switcher.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const { accountId } = await req.json().catch(() => ({}));
  if (typeof accountId !== "string") {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const session = await getSession();
  const account = session.accounts?.find((a) => a.id === accountId);
  if (!account) {
    return NextResponse.json({ error: "Unknown account." }, { status: 404 });
  }

  session.activeAccountId = account.id;
  await session.save();

  return NextResponse.json({ ok: true });
}
