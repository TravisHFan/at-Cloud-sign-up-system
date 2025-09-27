import { describe, it, expect, vi } from "vitest";
import { LruCache } from "../../../src/utils/lru";

describe("LruCache", () => {
  it("stores and retrieves positive entry within TTL", () => {
    const cache = new LruCache<{ v: number }>({ maxSize: 2, ttlMs: 1000 });
    cache.set("a", { v: 1 });
    const g = cache.get("a");
    expect(g.hit).toBe(true);
    expect(g.value?.v).toBe(1);
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    const cache = new LruCache<{ v: number }>({ maxSize: 2, ttlMs: 5 });
    cache.set("a", { v: 1 });
    vi.advanceTimersByTime(6); // advance just past TTL
    const g = cache.get("a");
    expect(g.hit).toBe(false);
    vi.useRealTimers();
  });

  it("evicts least recently used when over capacity", () => {
    const cache = new LruCache<{ v: number }>({ maxSize: 2, ttlMs: 1000 });
    cache.set("a", { v: 1 });
    cache.set("b", { v: 2 });
    // access a to make b the LRU
    cache.get("a");
    const evicted = cache.set("c", { v: 3 });
    expect(evicted).toBe(1); // one eviction
    // b should be gone
    expect(cache.get("b").hit).toBe(false);
    // a and c present
    expect(cache.get("a").hit).toBe(true);
    expect(cache.get("c").hit).toBe(true);
  });

  it("records negative cache hits when enabled", () => {
    const cache = new LruCache<{ v: number }>({
      maxSize: 2,
      ttlMs: 1000,
      enableNegative: true,
      negativeTtlMs: 100,
    });
    cache.setNegative("missing");
    const g = cache.get("missing");
    expect(g.hit).toBe(true);
    expect(g.negative).toBe(true);
  });
});
