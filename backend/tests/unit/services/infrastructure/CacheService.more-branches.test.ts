import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CacheService,
  CachePatterns,
  cacheService,
} from "../../../../src/services/infrastructure/CacheService";

describe("CacheService - more branches", () => {
  let localCache: CacheService;

  beforeEach(async () => {
    localCache = new CacheService({
      defaultTtl: 60,
      maxSize: 3,
      cleanupInterval: 1,
      enableMetrics: true,
    } as any);
    await cacheService.clear();
  });

  afterEach(async () => {
    await localCache.shutdown();
  });

  it("emits eviction event when LRU eviction occurs", async () => {
    const evictionListener = vi.fn();
    localCache.on("eviction", evictionListener);

    // Fill to capacity
    await localCache.set("a", "1");
    await localCache.set("b", "2");
    await localCache.set("c", "3");

    // Access some keys to move their lastAccessed forward
    await localCache.get("b");

    // Trigger eviction
    await localCache.set("d", "4");

    const metrics = localCache.getMetrics();
    expect(metrics.totalKeys).toBeLessThanOrEqual(3);
    expect(metrics.evictionCount).toBeGreaterThan(0);
    expect(evictionListener).toHaveBeenCalledWith(
      expect.objectContaining({ keysRemoved: expect.any(Number) })
    );
  });

  it("emits miss event with reason 'expired' when TTL elapses", async () => {
    const missListener = vi.fn();
    localCache.on("miss", missListener);

    await localCache.set("ttl-key", "v", { ttl: 1 });

    // Use fake timers to simulate passage of time deterministically
    vi.useFakeTimers();
    try {
      const now = Date.now();
      vi.setSystemTime(now + 2000); // advance beyond TTL (1s)

      const result = await localCache.get("ttl-key");
      expect(result).toBeNull();
      expect(missListener).toHaveBeenCalledWith(
        expect.objectContaining({ key: "ttl-key", reason: "expired" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cache when ttl is 0 (no set event, no stored value)", async () => {
    const setListener = vi.fn();
    localCache.on("set", setListener);

    await localCache.set("no-cache", "v", { ttl: 0 });

    const v = await localCache.get("no-cache");
    expect(v).toBeNull();
    expect(setListener).not.toHaveBeenCalled();
  });

  it("emits cleanup event of type 'cache-warming' after warmCache", async () => {
    const cleanupListener = vi.fn();
    localCache.on("cleanup", cleanupListener);

    await localCache.warmCache([
      { key: "w1", fetchFunction: async () => 1 },
      { key: "w2", fetchFunction: async () => ({ a: 2 }) },
    ]);

    expect(await localCache.get("w1")).toEqual(1);
    expect(await localCache.get("w2")).toEqual({ a: 2 });
    expect(cleanupListener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cache-warming", keysAdded: 2 })
    );
  });

  it("auto cleanup timer removes expired entries and emits 'expired' cleanup event", async () => {
    vi.useFakeTimers();
    const timedCache = new CacheService({
      defaultTtl: 60,
      cleanupInterval: 1,
      enableMetrics: true,
    } as any);
    try {
      const cleanupListener = vi.fn();
      timedCache.on("cleanup", cleanupListener);

      await timedCache.set("e1", "x", { ttl: 1 });
      await timedCache.set("e2", "y", { ttl: 1 });

      const now = Date.now();
      vi.setSystemTime(now + 2500); // beyond ttl and interval
      vi.advanceTimersByTime(2000); // allow interval tick to run

      // After cleanup, entries should be gone and event emitted
      expect(await timedCache.get("e1")).toBeNull();
      expect(await timedCache.get("e2")).toBeNull();
      expect(cleanupListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "expired",
          keysRemoved: expect.any(Number),
        })
      );
    } finally {
      await timedCache.shutdown();
      vi.useRealTimers();
    }
  });

  it("getHealthInfo reports 'warning' when hitRate is between 30 and 50 with sufficient requests", async () => {
    // Prepare some hits
    await localCache.set("hit-key", 42, { ttl: 60 });
    await localCache.get("hit-key");
    await localCache.get("hit-key");
    await localCache.get("hit-key");
    await localCache.get("hit-key"); // 4 hits

    // And 8 misses on different keys
    for (let i = 0; i < 8; i++) {
      await localCache.get(`miss-${i}`);
    }

    const health = localCache.getHealthInfo();
    expect(health.status).toBe("warning");
    expect(health.details.hitRate).toBeGreaterThan(30);
    expect(health.details.hitRate).toBeLessThan(50);
  });

  it("getHealthInfo reports 'critical' when hitRate is below 30 with sufficient requests", async () => {
    const another = new CacheService({
      defaultTtl: 60,
      cleanupInterval: 5,
    } as any);
    try {
      // 11 misses -> hitRate 0
      for (let i = 0; i < 11; i++) {
        await another.get(`nope-${i}`);
      }
      const health = another.getHealthInfo();
      expect(health.status).toBe("critical");
      expect(health.details.hitRate).toBe(0);
    } finally {
      await another.shutdown();
    }
  });

  it("get records miss and rethrows when internal error occurs", async () => {
    // Arrange a key present so we bypass the initial null/expired paths,
    // then monkey-patch the internal map.get to throw
    await localCache.set("boom", { x: 1 }, { ttl: 60 });

    const realMap = (localCache as any).cache as Map<string, any>;
    const realGet = realMap.get.bind(realMap);
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Replace .get to throw only for our key
      (realMap as any).get = (k: string) => {
        if (k === "boom") throw new Error("boom");
        return realGet(k);
      };

      await expect(localCache.get("boom")).rejects.toThrow("boom");

      // Miss count should increase
      const metrics = localCache.getMetrics();
      expect(metrics.missCount).toBeGreaterThan(0);
    } finally {
      // restore
      (realMap as any).get = realGet;
      spyWarn.mockRestore();
    }
  });

  it("getOrSet refreshCache logs warning when set fails and still returns value", async () => {
    const key = "refresh-key";
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const setSpy = vi
      .spyOn(localCache as any, "set")
      .mockRejectedValue(new Error("fail-set"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const value = await localCache.getOrSet(key, fetcher, {
      refreshCache: true,
      ttl: 10,
      tags: ["users"],
    });

    expect(value).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      `Failed to refresh cache for key: ${key}`,
      expect.any(Error)
    );

    // Not cached due to set failure
    expect(await localCache.get(key)).toBeNull();

    setSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("shutdown removes listeners so subsequent emits are not received", async () => {
    const c = new CacheService({ cleanupInterval: 60 } as any);
    const listener = vi.fn();
    c.on("cleanup", listener);
    await c.shutdown();

    // Emitting via clear after shutdown should not reach old listener
    await c.clear();
    expect(listener).not.toHaveBeenCalled();

    await c.shutdown();
  });
});

describe("CachePatterns - additional invalidations", () => {
  beforeEach(async () => {
    await cacheService.clear();
  });

  it("invalidateListingCaches removes entries tagged with 'listings'", async () => {
    await cacheService.set("user-list", [1], { tags: ["users", "listings"] });
    await cacheService.set("event-list", [2], {
      tags: ["events", "event-listings", "listings"],
    });
    await cacheService.set("unrelated", "x", { tags: ["users"] });

    await CachePatterns.invalidateListingCaches();

    expect(await cacheService.get("user-list")).toBeNull();
    expect(await cacheService.get("event-list")).toBeNull();
    expect(await cacheService.get("unrelated")).toBe("x");
  });

  it("invalidateSearchCaches removes entries tagged with 'search'", async () => {
    await cacheService.set("search-users", {}, { tags: ["search", "users"] });
    await cacheService.set("search-events", {}, { tags: ["search", "events"] });
    await cacheService.set("keep-me", {}, { tags: ["users"] });

    await CachePatterns.invalidateSearchCaches();

    expect(await cacheService.get("search-users")).toBeNull();
    expect(await cacheService.get("search-events")).toBeNull();
    expect(await cacheService.get("keep-me")).not.toBeNull();
  });

  it("invalidateAllUserCaches clears users/sessions/listings/search tagged entries", async () => {
    await cacheService.set("u1", {}, { tags: ["users"] });
    await cacheService.set("s1", {}, { tags: ["sessions"] });
    await cacheService.set("l1", {}, { tags: ["listings"] });
    await cacheService.set("srch", {}, { tags: ["search"] });
    await cacheService.set("other", {}, { tags: ["events"] });

    await CachePatterns.invalidateAllUserCaches();

    expect(await cacheService.get("u1")).toBeNull();
    expect(await cacheService.get("s1")).toBeNull();
    expect(await cacheService.get("l1")).toBeNull();
    expect(await cacheService.get("srch")).toBeNull();
    expect(await cacheService.get("other")).not.toBeNull();
  });

  it("invalidateEventCache clears events/event-listings/roles and event-specific tags", async () => {
    const eventId = "E100";
    await cacheService.set(
      "evt-list",
      {},
      { tags: ["events", "event-listings"] }
    );
    await cacheService.set(
      "role-avail",
      {},
      { tags: ["roles", `event:${eventId}`] }
    );
    await cacheService.set("keep-other", {}, { tags: ["users"] });

    await CachePatterns.invalidateEventCache(eventId);

    expect(await cacheService.get("evt-list")).toBeNull();
    expect(await cacheService.get("role-avail")).toBeNull();
    expect(await cacheService.get("keep-other")).not.toBeNull();
  });

  it("invalidateUserCache clears users-related, sessions, search and user-specific tag", async () => {
    const userId = "U55";
    await cacheService.set(
      "user-listing",
      {},
      { tags: ["users", "user-listings"] }
    );
    await cacheService.set(
      "session",
      {},
      { tags: ["sessions", `user:${userId}`] }
    );
    await cacheService.set("search-u", {}, { tags: ["search"] });
    await cacheService.set("keep-events", {}, { tags: ["events"] });

    await CachePatterns.invalidateUserCache(userId);

    expect(await cacheService.get("user-listing")).toBeNull();
    expect(await cacheService.get("session")).toBeNull();
    expect(await cacheService.get("search-u")).toBeNull();
    expect(await cacheService.get("keep-events")).not.toBeNull();
  });

  it("getUserListing caches result and reuses it on subsequent calls", async () => {
    await cacheService.clear();
    const key = "user-listing:key1";
    const fetch1 = vi.fn().mockResolvedValue({ rows: [1, 2, 3] });

    const v1 = await CachePatterns.getUserListing(key, fetch1);
    expect(v1).toEqual({ rows: [1, 2, 3] });
    expect(fetch1).toHaveBeenCalledTimes(1);

    // Second call with a different fetch should still return cached value and not call new fetch
    const fetch2 = vi.fn().mockResolvedValue({ rows: [9, 9] });
    const v2 = await CachePatterns.getUserListing(key, fetch2);
    expect(v2).toEqual({ rows: [1, 2, 3] });
    expect(fetch2).not.toHaveBeenCalled();
  });

  it("getSearchResults caches result and reuses it on subsequent calls", async () => {
    await cacheService.clear();
    const key = "search:users:query=abc";
    const fetch1 = vi.fn().mockResolvedValue({ hits: ["a", "b"] });

    const v1 = await CachePatterns.getSearchResults(key, fetch1);
    expect(v1).toEqual({ hits: ["a", "b"] });
    expect(fetch1).toHaveBeenCalledTimes(1);

    const fetch2 = vi.fn().mockResolvedValue({ hits: ["x"] });
    const v2 = await CachePatterns.getSearchResults(key, fetch2);
    expect(v2).toEqual({ hits: ["a", "b"] });
    expect(fetch2).not.toHaveBeenCalled();
  });
});

describe("CacheService - timer restart branch", () => {
  it("startCleanupTimer clears existing interval before setting a new one", async () => {
    vi.useFakeTimers();
    const c = new CacheService({ cleanupInterval: 60 } as any);
    const spy = vi.spyOn(globalThis, "clearInterval");
    try {
      // Constructor already started the timer; calling again should clear the existing one first
      (c as any).startCleanupTimer();
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      await c.shutdown();
      vi.useRealTimers();
    }
  });
});

describe("CachePatterns - getEventListingOrdering", () => {
  beforeEach(async () => {
    await cacheService.clear();
  });

  it("caches event listing ordering via getOrSet", async () => {
    const fetchFn = vi.fn().mockResolvedValue(["event1", "event2", "event3"]);

    const result = await CachePatterns.getEventListingOrdering(
      "event-listing:test-query",
      fetchFn
    );

    expect(result).toEqual(["event1", "event2", "event3"]);
    expect(fetchFn).toHaveBeenCalledOnce();

    // Second call should use cache
    const result2 = await CachePatterns.getEventListingOrdering(
      "event-listing:test-query",
      fetchFn
    );

    expect(result2).toEqual(["event1", "event2", "event3"]);
    expect(fetchFn).toHaveBeenCalledOnce(); // Still only once
  });
});
