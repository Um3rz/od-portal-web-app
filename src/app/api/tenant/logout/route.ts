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
  session.destroy();
  return NextResponse.json({ ok: true });
}
