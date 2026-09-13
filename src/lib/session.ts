// Encrypted server-side session (iron-session, AES-256-GCM sealed cookie).
// Holds every Odoo server/account the user has connected, plus which one is
// active -- technical_plan.md §1/§3: never sent to the browser as plaintext,
// never logged, never in React Query cache. The browser only ever sees a
// masked last-4-chars summary of an api key (see /api/tenant/status).
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface OdooAccount {
  id: string;
  name: string;
  odooOrigin: string;
  apiKey: string;
  isExternalGrant?: boolean;
  contractVersion?: string;
}

export interface OdooSessionData {
  accounts?: OdooAccount[];
  activeAccountId?: string;
}

export function getActiveAccount(session: OdooSessionData): OdooAccount | undefined {
  return session.accounts?.find((account) => account.id === session.activeAccountId);
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
