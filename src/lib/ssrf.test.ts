// Minimal self-check for the SSRF gate -- run with: npx tsx src/lib/ssrf.test.ts
import assert from "node:assert";
import { validateOdooOrigin, SsrfValidationError } from "./ssrf";

async function expectRejected(url: string, label: string) {
  try {
    await validateOdooOrigin(url);
    throw new Error(`expected rejection for ${label}: ${url}`);
  } catch (err) {
    assert(err instanceof SsrfValidationError, `${label} should be an SsrfValidationError, got ${err}`);
  }
}

async function main() {
  await expectRejected("http://example.com", "non-https");
  await expectRejected("https://user:pass@example.com", "credentials in URL");
  await expectRejected("https://example.com:2222", "disallowed port");
  await expectRejected("https://localhost", "loopback hostname");
  await expectRejected("https://127.0.0.1", "loopback IP");
  await expectRejected("https://169.254.169.254", "link-local / cloud metadata IP");
  await expectRejected("https://10.0.0.5", "private IP (10/8)");
  await expectRejected("https://192.168.1.1", "private IP (192.168/16)");
  await expectRejected("not a url", "malformed URL");

  const ok = await validateOdooOrigin("https://google.com/some/path?x=1");
  assert.strictEqual(ok, "https://google.com", "should normalize to bare origin, stripping path/query");

  // Dev-only local Odoo escape hatch: exact origin only, not a general
  // loopback bypass.
  const local = await validateOdooOrigin("http://localhost:8069");
  assert.strictEqual(local, "http://localhost:8069");
  await expectRejected("http://localhost:8070", "different port, not the exact dev origin");
  await expectRejected("http://127.0.0.1:8069", "loopback IP, not the exact dev hostname");

  console.log("ssrf.test.ts: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
