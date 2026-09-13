import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.odooOrigin || !session.apiKey) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }
  return NextResponse.json({ odooOrigin: session.odooOrigin });
}
