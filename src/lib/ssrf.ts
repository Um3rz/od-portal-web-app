// Validates a user-registered Odoo origin before it's ever fetched from the
// BFF. technical_plan.md §1/§3: HTTPS only, no credentials in the URL, no
// redirects, no loopback/private/link-local/reserved IPs after DNS
// resolution, restricted outbound ports.
import dns from "node:dns/promises";
import net from "node:net";

// Odoo is commonly reverse-proxied on 443, or exposed directly on its own
// default ports when the deployment terminates TLS itself.
const ALLOWED_PORTS = new Set(["", "443", "8069", "8071"]);

// Dev-only escape hatch so this app can be pointed at a local `odoo-bin`
// instance while building/testing -- never allowed in production, and
// scoped to this exact origin (not "any localhost port") so it can't widen
// into a general loopback bypass.
const DEV_LOCAL_ODOO_ORIGIN = "http://localhost:8069";

export class SsrfValidationError extends Error {}

function isPublicIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 0) return false;

  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return false; // 10.0.0.0/8
    if (a === 127) return false; // loopback
    if (a === 169 && b === 254) return false; // link-local
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 0) return false; // "this" network
    if (a >= 224) return false; // multicast/reserved
    return true;
  }

  // IPv6
  const lower = address.toLowerCase();
  if (lower === "::1") return false; // loopback
  if (lower.startsWith("fe80")) return false; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // unique local
  if (lower === "::") return false;
  return true;
}

/**
 * Parses and validates a candidate Odoo origin. Throws SsrfValidationError
 * with a user-safe message on any violation. Returns the normalized origin
 * (scheme://host[:port], no path/query/credentials) on success.
 *
 * Callers MUST re-validate immediately before every outbound fetch, not just
 * once at registration time -- DNS can change between calls (rebinding).
 * ponytail: this re-resolves on every call rather than pinning the validated
 * IP into the actual connection (a custom undici Agent/dispatcher would close
 * that TOCTOU gap fully). Re-resolving immediately before fetch shrinks the
 * window from "forever" to "the time between this call and the fetch call",
 * which is the pragmatic F1 cut. Upgrade path: a dispatcher that connects to
 * the resolved IP directly and sends the original Host header, if the
 * remaining gap ever matters for the threat model.
 */
export async function validateOdooOrigin(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfValidationError("Enter a valid URL, e.g. https://yourcompany.odoo.com");
  }

  if (
    process.env.NODE_ENV !== "production" &&
    `${url.protocol}//${url.host}` === DEV_LOCAL_ODOO_ORIGIN
  ) {
    return DEV_LOCAL_ODOO_ORIGIN;
  }

  if (url.protocol !== "https:") {
    throw new SsrfValidationError("Only HTTPS origins are allowed.");
  }
  if (url.username || url.password) {
    throw new SsrfValidationError("The URL must not contain credentials.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SsrfValidationError("This port is not allowed for an Odoo origin.");
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new SsrfValidationError("Could not resolve this host.");
  }
  if (addresses.length === 0) {
    throw new SsrfValidationError("Could not resolve this host.");
  }
  if (!addresses.every(isPublicIp)) {
    throw new SsrfValidationError("This host resolves to a private or reserved address.");
  }

  return `${url.protocol}//${url.host}`;
}
