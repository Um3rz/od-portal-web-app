import { NextResponse } from "next/server";
import { getSession, getActiveAccount } from "@/lib/session";

// Never return a full api key to the browser -- only enough to recognize
// which account is which (last 4 chars, same convention as the mobile app's
// settings screen).
function last4(apiKey: string): string {
  return apiKey.slice(-4);
}

export async function GET() {
  const session = await getSession();
  const active = getActiveAccount(session);
  if (!active) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }
  const accounts = (session.accounts ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    odooOrigin: account.odooOrigin,
    apiKeyLast4: last4(account.apiKey),
    isActive: account.id === session.activeAccountId,
  }));
  return NextResponse.json({ name: active.name, odooOrigin: active.odooOrigin, apiKeyLast4: last4(active.apiKey), accounts });
}
