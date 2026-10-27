import { Cache } from 'cache-manager';

export type CacheOptions = { skipCache?: boolean };

export async function withCache<T>(
  cacheManager: Cache,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts?: CacheOptions,
): Promise<T> {
  // A resource has one server in Coders. Read current authorization state so
  // additions and revocations take effect on the next request, without stale
  // positive or negative permission entries.
  if (opts?.skipCache || process.env.CODERS_MODE === 'true') return fn();

  try {
    const cached = await cacheManager.get<{ v: T }>(key);
    if (cached !== undefined && cached !== null) {
      return cached.v;
    }
  } catch (err) {
    console.warn(`[withCache] get failed for "${key}", falling back to source`, err);
  }

  const value = await fn();

  cacheManager
    .set(key, { v: value }, ttlMs)
    .catch((err) => console.warn(`[withCache] set failed for "${key}"`, err));

  return value;
}
