// Fixed-window in-memory rate limiter.
// Per server instance: good enough for dev and a single Node server. On serverless/multi-instance
// deployments swap the store for a shared one (e.g. Upstash Redis) behind the same function.

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()
let lastSweep = Date.now()

export function rateLimit(key: string, { limit, windowMs }: RateLimitOptions) {
  const now = Date.now()
  if (now - lastSweep > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k)
    lastSweep = now
  }

  const bucket = store.get(key)
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true as const, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) {
    return { ok: false as const, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }
  bucket.count += 1
  return { ok: true as const, remaining: limit - bucket.count, retryAfterMs: 0 }
}
