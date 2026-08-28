export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin"); if (!origin) return;
  if (new URL(origin).host !== new URL(request.url).host) throw new Error("INVALID_ORIGIN");
}
export function clientIp(request: Request): string { return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"; }
export async function enforceRateLimit(db: D1Database, key: string, limit: number, windowSeconds: number): Promise<void> {
  const current = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`INSERT INTO rate_limits (key, attempts, window_started_at)
    VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE
        WHEN (? - rate_limits.window_started_at) >= ? THEN 1
        ELSE rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN (? - rate_limits.window_started_at) >= ? THEN ?
        ELSE rate_limits.window_started_at
      END
    RETURNING attempts`)
    .bind(key, current, current, windowSeconds, current, windowSeconds, current)
    .first<{ attempts: number }>();
  if (Number(row?.attempts ?? limit + 1) > limit) throw new Error("RATE_LIMITED");
}

type BurstBucket = { attempts: number; expiresAt: number };
const publicBurstBuckets = new Map<string, BurstBucket>();
let lastBurstSweep = 0;

// Public registration traffic must not create a D1 write before every real
// registration write. A short-lived per-isolate limiter absorbs accidental
// double clicks and obvious bursts without turning the database into a queue.
export function enforcePublicRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): void {
  const current = Date.now();
  if (current - lastBurstSweep > 60_000 || publicBurstBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of publicBurstBuckets)
      if (bucket.expiresAt <= current) publicBurstBuckets.delete(bucketKey);
    lastBurstSweep = current;
  }

  const existing = publicBurstBuckets.get(key);
  if (!existing || existing.expiresAt <= current) {
    publicBurstBuckets.set(key, {
      attempts: 1,
      expiresAt: current + windowSeconds * 1_000,
    });
    return;
  }
  existing.attempts += 1;
  if (existing.attempts > limit) throw new Error("RATE_LIMITED");
}
