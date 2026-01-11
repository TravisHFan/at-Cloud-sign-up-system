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

  it("upgrades negative entry to positive when set() is called", () => {
    const cache = new LruCache<{ v: number }>({
      maxSize: 5,
      ttlMs: 1000,
      enableNegative: true,
      negativeTtlMs: 100,
    });
    // First, set a negative entry
    cache.setNegative("key1");
    const negResult = cache.get("key1");
    expect(negResult.hit).toBe(true);
    expect(negResult.negative).toBe(true);

    // Now set a positive value for the same key
    cache.set("key1", { v: 42 });
    const posResult = cache.get("key1");
    expect(posResult.hit).toBe(true);
    expect(posResult.negative).toBeFalsy(); // positive entries don't have negative=true
    expect(posResult.value?.v).toBe(42);
  });

  it("converts positive entry to negative when setNegative() is called (rare case)", () => {
    const cache = new LruCache<{ v: number }>({
      maxSize: 5,
      ttlMs: 1000,
      enableNegative: true,
      negativeTtlMs: 100,
    });
    // First, set a positive entry
    cache.set("key1", { v: 99 });
    const posResult = cache.get("key1");
    expect(posResult.hit).toBe(true);
    expect(posResult.negative).toBeFalsy(); // positive entries are not negative
    expect(posResult.value?.v).toBe(99);

    // Now mark it as negative (simulates expired/not-found scenario)
    cache.setNegative("key1");
    const negResult = cache.get("key1");
    expect(negResult.hit).toBe(true);
    expect(negResult.negative).toBe(true);
    expect(negResult.value).toBeUndefined();
  });

  it("delete removes an entry from cache", () => {
    const cache = new LruCache<{ v: number }>({ maxSize: 5, ttlMs: 1000 });
    cache.set("a", { v: 1 });
    expect(cache.get("a").hit).toBe(true);
    cache.delete("a");
    expect(cache.get("a").hit).toBe(false);
  });

  it("delete does nothing for non-existent key", () => {
    const cache = new LruCache<{ v: number }>({ maxSize: 5, ttlMs: 1000 });
    // Should not throw
    cache.delete("nonexistent");
    expect(cache.get("nonexistent").hit).toBe(false);
  });

  it("ignores setNegative when enableNegative is false", () => {
    const cache = new LruCache<{ v: number }>({
      maxSize: 5,
      ttlMs: 1000,
      enableNegative: false,
    });
    cache.setNegative("key1");
    // Should not be cached since negative caching is disabled
    const result = cache.get("key1");
    expect(result.hit).toBe(false);
  });

  it("updates existing positive entry value and TTL", () => {
    vi.useFakeTimers();
    const cache = new LruCache<{ v: number }>({ maxSize: 5, ttlMs: 100 });
    cache.set("a", { v: 1 });
    vi.advanceTimersByTime(50);
    // Update the entry - should reset TTL
    cache.set("a", { v: 2 });
    vi.advanceTimersByTime(60);
    // Should still be valid (50 + 60 = 110ms, but TTL was reset at 50ms)
    const result = cache.get("a");
    expect(result.hit).toBe(true);
    expect(result.value?.v).toBe(2);
    vi.useRealTimers();
  });
});
