// Renames one connected server in the session -- purely local, no Odoo call.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { captureServerEvent } from "@/lib/posthog-server";

export async function POST(req: Request) {
  const { accountId, name } = await req.json().catch(() => ({}));
  if (typeof accountId !== "string" || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "accountId and a non-empty name are required" }, { status: 400 });
  }
  const session = await getSession();
  const account = session.accounts?.find((a) => a.id === accountId);
  if (!account) {
    return NextResponse.json({ error: "Unknown account." }, { status: 404 });
  }
  account.name = name.trim();
  await session.save();
  await captureServerEvent(accountId, "server_renamed", {});
  return NextResponse.json({ ok: true });
}
