const globalAny = globalThis as typeof globalThis & { __rt_store?: Map<string, number[]> };
const store: Map<string, number[]> = globalAny.__rt_store ?? new Map();
if (!globalAny.__rt_store) {
  globalAny.__rt_store = store;
}

/**
 * Simple in-memory rate limiter. Tracks per-key timestamps within the window.
 * Throws an error when the limit is exceeded.
 */
export function rateLimit({
  key,
  limit = 10,
  windowMs = 60_000,
}: {
  key: string;
  limit?: number;
  windowMs?: number;
}) {
  const now = Date.now();
  const timestamps = store.get(key) ?? [];
  const fresh = timestamps.filter((stamp) => now - stamp < windowMs);

  if (fresh.length >= limit) {
    throw new Error("ratelimited");
  }

  fresh.push(now);
  store.set(key, fresh);
}
