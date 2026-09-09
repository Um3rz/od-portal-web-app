// Per-IP / per-session request limiter for the BFF itself, distinct from
// Odoo's own per-key limits (which callOdoo() passes through untouched).
// technical_plan.md §Rate limits: per-IP tenant registration + failed-key
// attempts, per-session request limits.
//
// ponytail: in-memory Map, correct for one Next.js instance, wrong the
// moment this runs behind more than one. Upgrade path: swap the Map for a
// Redis INCR+EXPIRE (or Upstash) once this deploys horizontally -- the
// _hit() call signature below is deliberately the same shape Odoo's own
// mobile.rate.limit.saas._hit(bucket, limit, window) uses, so the swap is a
// body-only change.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hit(bucketKey: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  existing.count += 1;
  return existing.count <= limit;
}

export function retryAfterSeconds(bucketKey: string): number {
  const existing = buckets.get(bucketKey);
  if (!existing) return 0;
  return Math.max(0, Math.ceil((existing.resetAt - Date.now()) / 1000));
}
