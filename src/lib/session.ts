// Encrypted server-side session (iron-session, AES-256-GCM sealed cookie).
// Holds the tenant's Odoo origin and API key -- technical_plan.md §1/§3:
// never sent to the browser, never logged, never in React Query cache.
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface OdooSessionData {
  odooOrigin?: string;
  apiKey?: string;
  isExternalGrant?: boolean;
  contractVersion?: string;
}

const password = process.env.SESSION_SECRET;
if (!password || password.length < 32) {
  throw new Error(
    "SESSION_SECRET env var must be set to a random string of at least 32 characters.",
  );
}

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "odsaas_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  return getIronSession<OdooSessionData>(await cookies(), sessionOptions);
}
