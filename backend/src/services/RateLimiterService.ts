/**
 * Lightweight in-memory sliding window rate limiter with pluggable keys.
 * Intentionally simple; can be swapped for Redis by implementing same interface.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds?: number;
  reason?: string;
}

interface BucketEntry {
  ts: number; // epoch ms
}

interface SlidingWindowConfig {
  windowMs: number;
  limit: number;
  key: string; // fully qualified key
  now?: number; // override time (tests)
}

class InMemorySlidingWindowStore {
  private buckets: Map<string, BucketEntry[]> = new Map();

  pruneAndCount(key: string, windowMs: number, now: number): number {
    const list = this.buckets.get(key);
    if (!list || list.length === 0) return 0;
    const threshold = now - windowMs;
    let idx = 0;
    while (idx < list.length && list[idx].ts < threshold) idx++;
    if (idx > 0) {
      list.splice(0, idx);
    }
    return list.length;
  }

  push(key: string, ts: number): void {
    const list = this.buckets.get(key);
    if (list) {
      list.push({ ts });
    } else {
      this.buckets.set(key, [{ ts }]);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

export class RateLimiterService {
  private static store = new InMemorySlidingWindowStore();

  /**
   * Attempt a consumption for provided key.
   */
  static consume(cfg: SlidingWindowConfig): RateLimitResult {
    if (
      process.env.NODE_ENV === "test" &&
      process.env.RESET_RATE_LIMITER === "true"
    ) {
      // Allow test to force reset before measuring a scenario
      this.store.reset();
      // Unset flag so it doesn't reset every call
      delete process.env.RESET_RATE_LIMITER;
    }
    const now = cfg.now ?? Date.now();
    const count = this.store.pruneAndCount(cfg.key, cfg.windowMs, now);
    if (count >= cfg.limit) {
      // Oldest remaining request determines retryAfter
      const bucket = (this as any).store.buckets.get(cfg.key) as
        | BucketEntry[]
        | undefined;
      let retryAfterSeconds: number | undefined;
      if (bucket && bucket.length) {
        const oldestTs = bucket[0].ts; // oldest after prune
        const diffMs = cfg.windowMs - (now - oldestTs);
        retryAfterSeconds = diffMs > 0 ? Math.ceil(diffMs / 1000) : 1;
      }
      return {
        allowed: false,
        remaining: 0,
        limit: cfg.limit,
        retryAfterSeconds,
        reason: "rate_limited",
      };
    }
    this.store.push(cfg.key, now);
    const remaining = Math.max(cfg.limit - (count + 1), 0);
    return { allowed: true, remaining, limit: cfg.limit };
  }
}

export default RateLimiterService;
