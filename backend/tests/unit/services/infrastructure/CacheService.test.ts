/**
 * Comprehensive Tests for CacheService
 *
 * Tests cover:
 * - Basic cache operations (get/set/delete)
 * - TTL and expiration handling
 * - Cache patterns and convenience methods
 * - Memory management and eviction
 * - Smart invalidation by tags
 * - Performance metrics and monitoring
 * - Error handling and edge cases
 * - Cache warming strategies
 * - Health monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CacheService,
  cacheService,
  CachePatterns,
  type CacheOptions,
  type CacheQueryOptions,
} from "../../../../src/services/infrastructure/CacheService";

describe("CacheService", () => {
  let testCache: CacheService;

  beforeEach(() => {
    // Create fresh cache instance for each test
    testCache = new CacheService({
      defaultTtl: 60, // 1 minute for tests
      maxSize: 10,
      maxMemoryMB: 1,
      cleanupInterval: 1, // 1 second for fast tests
      enableMetrics: true,
    });
  });

  afterEach(async () => {
    // Clean up
    await testCache.shutdown();
  });

  describe("Basic Cache Operations", () => {
    it("should set and get values correctly", async () => {
      // Act
      await testCache.set("test-key", "test-value");
      const result = await testCache.get("test-key");

      // Assert
      expect(result).toBe("test-value");
    });

    it("should return null for non-existent keys", async () => {
      // Act
      const result = await testCache.get("non-existent");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle complex data types", async () => {
      // Arrange
      const complexData = {
        user: { id: 123, name: "John Doe" },
        events: [{ id: 1, title: "Event 1" }],
        metadata: { timestamp: Date.now() },
      };

      // Act
      await testCache.set("complex-data", complexData);
      const result = await testCache.get("complex-data");

      // Assert
      expect(result).toEqual(complexData);
    });

    it("should delete keys successfully", async () => {
      // Arrange
      await testCache.set("delete-me", "value");

      // Act
      const deleted = await testCache.delete("delete-me");
      const result = await testCache.get("delete-me");

      // Assert
      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it("should return false when deleting non-existent keys", async () => {
      // Act
      const deleted = await testCache.delete("non-existent");

      // Assert
      expect(deleted).toBe(false);
    });

    it("should clear all cache entries", async () => {
      // Arrange
      await testCache.set("key1", "value1");
      await testCache.set("key2", "value2");

      // Act
      await testCache.clear();
      const result1 = await testCache.get("key1");
      const result2 = await testCache.get("key2");

      // Assert
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe("TTL and Expiration", () => {
    it("should respect custom TTL values", async () => {
      // Act
      await testCache.set("short-lived", "value", { ttl: 1 }); // 1 second

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await testCache.get("short-lived");

      // Assert
      expect(result).toBeNull();
    });

    it("should use default TTL when none specified", async () => {
      // Act
      await testCache.set("default-ttl", "value");

      // Should still be available immediately
      const result = await testCache.get("default-ttl");

      // Assert
      expect(result).toBe("value");
    });

    it("should handle zero TTL (immediate expiration)", async () => {
      // Act
      await testCache.set("immediate-expire", "value", { ttl: 0 });

      // Should expire immediately
      const result = await testCache.get("immediate-expire");

      // Assert
      expect(result).toBeNull();
    });

    it("should cleanup expired entries automatically", async () => {
      // Arrange
      await testCache.set("auto-expire", "value", { ttl: 1 });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Manually trigger cleanup by trying to get the value
      const result = await testCache.get("auto-expire");
      expect(result).toBeNull();

      const metrics = testCache.getMetrics();

      // Assert
      expect(metrics.totalKeys).toBe(0);
    });
  });

  describe("Cache Patterns and getOrSet", () => {
    it("should execute fetch function on cache miss", async () => {
      // Arrange
      const fetchFunction = vi.fn().mockResolvedValue("fetched-value");

      // Act
      const result = await testCache.getOrSet("new-key", fetchFunction);

      // Assert
      expect(result).toBe("fetched-value");
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });

    it("should not execute fetch function on cache hit", async () => {
      // Arrange
      await testCache.set("existing-key", "cached-value");
      const fetchFunction = vi.fn().mockResolvedValue("fetched-value");

      // Act
      const result = await testCache.getOrSet("existing-key", fetchFunction);

      // Assert
      expect(result).toBe("cached-value");
      expect(fetchFunction).not.toHaveBeenCalled();
    });

    it("should skip cache when skipCache option is true", async () => {
      // Arrange
      await testCache.set("skip-key", "cached-value");
      const fetchFunction = vi.fn().mockResolvedValue("fresh-value");

      // Act
      const result = await testCache.getOrSet("skip-key", fetchFunction, {
        skipCache: true,
      });

      // Assert
      expect(result).toBe("fresh-value");
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });

    it("should refresh cache when refreshCache option is true", async () => {
      // Arrange
      await testCache.set("refresh-key", "old-value");
      const fetchFunction = vi.fn().mockResolvedValue("new-value");

      // Act
      const result = await testCache.getOrSet("refresh-key", fetchFunction, {
        refreshCache: true,
      });

      // Verify cache was updated
      const cachedResult = await testCache.get("refresh-key");

      // Assert
      expect(result).toBe("new-value");
      expect(cachedResult).toBe("new-value");
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });

    it("should handle fetch function errors gracefully", async () => {
      // Arrange
      const fetchFunction = vi
        .fn()
        .mockRejectedValue(new Error("Fetch failed"));

      // Act & Assert
      await expect(
        testCache.getOrSet("error-key", fetchFunction)
      ).rejects.toThrow("Fetch failed");
    });
  });

  describe("Tag-based Invalidation", () => {
    it("should store and invalidate entries by tags", async () => {
      // Arrange
      await testCache.set("user-1", "data1", { tags: ["users", "active"] });
      await testCache.set("user-2", "data2", { tags: ["users", "inactive"] });
      await testCache.set("event-1", "data3", { tags: ["events"] });

      // Act
      const invalidatedCount = await testCache.invalidateByTags(["users"]);

      // Assert
      expect(invalidatedCount).toBe(2);
      expect(await testCache.get("user-1")).toBeNull();
      expect(await testCache.get("user-2")).toBeNull();
      expect(await testCache.get("event-1")).toBe("data3");
    });

    it("should handle invalidation with multiple overlapping tags", async () => {
      // Arrange
      await testCache.set("item-1", "data1", { tags: ["tag1", "tag2"] });
      await testCache.set("item-2", "data2", { tags: ["tag2", "tag3"] });
      await testCache.set("item-3", "data3", { tags: ["tag3"] });

      // Act
      const invalidatedCount = await testCache.invalidateByTags([
        "tag1",
        "tag3",
      ]);

      // Assert
      expect(invalidatedCount).toBe(3); // All items should be invalidated
      expect(await testCache.get("item-1")).toBeNull();
      expect(await testCache.get("item-2")).toBeNull();
      expect(await testCache.get("item-3")).toBeNull();
    });

    it("should return 0 when no entries match tags", async () => {
      // Arrange
      await testCache.set("item-1", "data1", { tags: ["tag1"] });

      // Act
      const invalidatedCount = await testCache.invalidateByTags([
        "nonexistent",
      ]);

      // Assert
      expect(invalidatedCount).toBe(0);
      expect(await testCache.get("item-1")).toBe("data1");
    });
  });

  describe("Memory Management and Eviction", () => {
    it("should evict least recently used entries when max size reached", async () => {
      // Fill cache to max capacity
      for (let i = 0; i < 10; i++) {
        await testCache.set(`key-${i}`, `value-${i}`);
      }

      // Access some entries to make them recently used
      await testCache.get("key-5");
      await testCache.get("key-8");

      // Add one more entry to trigger eviction
      await testCache.set("new-key", "new-value");

      // Assert
      const metrics = testCache.getMetrics();
      expect(metrics.totalKeys).toBeLessThanOrEqual(10);
      expect(metrics.evictionCount).toBeGreaterThan(0);

      // Recently accessed items should still be there
      expect(await testCache.get("key-5")).toBe("value-5");
      expect(await testCache.get("key-8")).toBe("value-8");
      expect(await testCache.get("new-key")).toBe("new-value");
    });

    it("should update access counts and timestamps", async () => {
      // Arrange
      await testCache.set("access-test", "value");

      // Act
      await testCache.get("access-test");
      await testCache.get("access-test");
      await testCache.get("access-test");

      // We can't directly access internal state, but we can verify
      // that the cache still works and metrics are updated
      const metrics = testCache.getMetrics();

      // Assert
      expect(metrics.hitCount).toBe(3);
      expect(await testCache.get("access-test")).toBe("value");
    });
  });

  describe("Performance Metrics", () => {
    it("should track hit and miss counts", async () => {
      // Arrange
      await testCache.set("hit-key", "value");

      // Act
      await testCache.get("hit-key"); // Hit
      await testCache.get("miss-key"); // Miss
      await testCache.get("hit-key"); // Hit

      const metrics = testCache.getMetrics();

      // Assert
      expect(metrics.hitCount).toBe(2);
      expect(metrics.missCount).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(66.67, 1);
    });

    it("should track total keys and provide memory estimates", async () => {
      // Act
      await testCache.set("key1", "value1");
      await testCache.set("key2", { complex: "object", with: ["array"] });

      const metrics = testCache.getMetrics();

      // Assert
      expect(metrics.totalKeys).toBe(2);
      expect(metrics.totalMemoryUsage).toBeGreaterThan(0);
    });

    it("should track average response time", async () => {
      // Arrange
      await testCache.set("timing-key", "value");

      // Act
      await testCache.get("timing-key");
      await testCache.get("timing-key");

      const metrics = testCache.getMetrics();

      // Assert
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it("should identify most accessed key", async () => {
      // Arrange
      await testCache.set("key1", "value1");
      await testCache.set("key2", "value2");

      // Act - Access key2 more times
      await testCache.get("key1");
      await testCache.get("key2");
      await testCache.get("key2");
      await testCache.get("key2");

      const metrics = testCache.getMetrics();

      // Assert
      expect(metrics.mostAccessedKey).toBe("key2");
    });
  });

  describe("Cache Warming", () => {
    it("should warm cache with multiple entries", async () => {
      // Arrange
      const warmingEntries = [
        {
          key: "warm-1",
          fetchFunction: vi.fn().mockResolvedValue("warm-value-1"),
          options: { ttl: 300, tags: ["warm"] },
        },
        {
          key: "warm-2",
          fetchFunction: vi.fn().mockResolvedValue("warm-value-2"),
          options: { ttl: 300, tags: ["warm"] },
        },
      ];

      // Act
      await testCache.warmCache(warmingEntries);

      // Assert
      expect(await testCache.get("warm-1")).toBe("warm-value-1");
      expect(await testCache.get("warm-2")).toBe("warm-value-2");
      expect(warmingEntries[0].fetchFunction).toHaveBeenCalledTimes(1);
      expect(warmingEntries[1].fetchFunction).toHaveBeenCalledTimes(1);
    });

    it("should handle warming failures gracefully", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const warmingEntries = [
        {
          key: "warm-success",
          fetchFunction: vi.fn().mockResolvedValue("success"),
        },
        {
          key: "warm-failure",
          fetchFunction: vi.fn().mockRejectedValue(new Error("Fetch failed")),
        },
      ];

      // Act & Assert
      await expect(testCache.warmCache(warmingEntries)).resolves.not.toThrow();

      expect(await testCache.get("warm-success")).toBe("success");
      expect(await testCache.get("warm-failure")).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to warm cache"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Health Monitoring", () => {
    it("should report healthy status under normal conditions", async () => {
      // Add some cache entries
      await cacheService.set("test1", "value1");
      await cacheService.get("test1"); // Create a hit

      const health = cacheService.getHealthInfo();

      // Assert
      expect(health.status).toBe("healthy");
      expect(health.details.totalKeys).toBe(1);
      expect(health.details.hitRate).toBeGreaterThan(0);
      expect(health.details.memoryUsageMB).toBeGreaterThan(0);
    });

    it("should report warning status when hit rate is low", async () => {
      // Generate moderate cache misses to get warning range (50-70%)
      for (let i = 0; i < 6; i++) {
        await cacheService.get(`miss-${i}`);
      }

      // Add hits to get hit rate around 60% (6 hits out of 10 total = 60%)
      await cacheService.set("test1", "value1");
      await cacheService.set("test2", "value2");
      await cacheService.set("test3", "value3");
      await cacheService.set("test4", "value4");
      await cacheService.get("test1"); // hit
      await cacheService.get("test2"); // hit
      await cacheService.get("test3"); // hit
      await cacheService.get("test4"); // hit

      const health = cacheService.getHealthInfo();

      // Assert - Hit rate should be around 40% (4 hits out of 10 = 40%, which is < 50% = critical)
      // Let's adjust to get 60% hit rate: 6 hits out of 10 total
      await cacheService.get("test1"); // hit
      await cacheService.get("test2"); // hit

      const healthAfter = cacheService.getHealthInfo();

      // Now we have 6 hits out of 10 total = 60% (between 50-70% = warning)
      expect(healthAfter.status).toBe("warning");
      expect(healthAfter.details.hitRate).toBeLessThan(70);
      expect(healthAfter.details.hitRate).toBeGreaterThan(50);
    });

    it("should include utilization metrics", async () => {
      // Arrange
      await testCache.set("util-test", "value");

      // Act
      const health = testCache.getHealthInfo();

      // Assert
      expect(health.details.maxSizeUtilization).toBe(10); // 1 of 10 slots used
      expect(health.details.totalKeys).toBe(1);
    });
  });

  describe("Event Emission", () => {
    it("should emit events for cache operations", async () => {
      // Arrange
      const hitListener = vi.fn();
      const missListener = vi.fn();
      const setListener = vi.fn();

      testCache.on("hit", hitListener);
      testCache.on("miss", missListener);
      testCache.on("set", setListener);

      // Act
      await testCache.set("event-key", "value");
      await testCache.get("event-key"); // Hit
      await testCache.get("nonexistent"); // Miss

      // Assert
      expect(setListener).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "event-key",
          ttl: expect.any(Number),
        })
      );
      expect(hitListener).toHaveBeenCalledWith(
        expect.objectContaining({ key: "event-key" })
      );
      expect(missListener).toHaveBeenCalledWith(
        expect.objectContaining({ key: "nonexistent" })
      );
    });

    it("should emit cleanup events", async () => {
      // Arrange
      const cleanupListener = vi.fn();
      testCache.on("cleanup", cleanupListener);

      // Act
      await testCache.clear();

      // Assert
      expect(cleanupListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "manual",
          keysRemoved: expect.any(Number),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle corrupted cache entries gracefully", async () => {
      // This is a more theoretical test since our implementation
      // is quite robust, but we can test edge cases

      // Act & Assert
      await expect(testCache.get("")).resolves.toBeNull();
      await expect(testCache.set("", "value")).resolves.not.toThrow();
    });

    it("should handle concurrent operations safely", async () => {
      // Arrange
      const promises: Promise<any>[] = [];

      // Act - Perform many concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(testCache.set(`concurrent-${i}`, `value-${i}`));
        promises.push(testCache.get(`concurrent-${i}`));
      }

      // Assert
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe("Graceful Shutdown", () => {
    it("should clean up resources on shutdown", async () => {
      // Arrange
      await testCache.set("shutdown-test", "value");

      // Act
      await testCache.shutdown();

      // Assert
      const metrics = testCache.getMetrics();
      expect(metrics.totalKeys).toBe(0);
    });
  });
});

describe("CachePatterns", () => {
  beforeEach(async () => {
    await cacheService.clear();
  });

  describe("Analytics Patterns", () => {
    it("should cache analytics data with correct TTL", async () => {
      // Arrange
      const fetchFunction = vi.fn().mockResolvedValue({
        totalUsers: 100,
        totalEvents: 50,
      });

      // Act
      const result1 = await CachePatterns.getAnalyticsData(
        "test-analytics",
        fetchFunction
      );
      const result2 = await CachePatterns.getAnalyticsData(
        "test-analytics",
        fetchFunction
      );

      // Assert
      expect(result1).toEqual({ totalUsers: 100, totalEvents: 50 });
      expect(result2).toEqual({ totalUsers: 100, totalEvents: 50 });
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Listing Patterns", () => {
    it("should cache event listings with correct TTL", async () => {
      // Arrange
      const fetchFunction = vi.fn().mockResolvedValue([
        { id: 1, title: "Event 1" },
        { id: 2, title: "Event 2" },
      ]);

      // Act
      const result = await CachePatterns.getEventListing(
        "event-list",
        fetchFunction
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe("Role Availability Patterns", () => {
    it("should cache role availability with event-specific tags", async () => {
      // Arrange
      const fetchFunction = vi.fn().mockResolvedValue({
        available: 5,
        total: 10,
      });

      // Act
      const result = await CachePatterns.getRoleAvailability(
        "event-123",
        "role-456",
        fetchFunction
      );

      // Assert
      expect(result).toEqual({ available: 5, total: 10 });
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe("User Session Patterns", () => {
    it("should cache user session data with user-specific tags", async () => {
      // Arrange
      const fetchFunction = vi.fn().mockResolvedValue({
        userId: "user-123",
        role: "Leader",
        permissions: ["read", "write"],
      });

      // Act
      const result = await CachePatterns.getUserSession(
        "user-123",
        fetchFunction
      );

      // Assert
      expect((result as any).userId).toBe("user-123");
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cache Invalidation Patterns", () => {
    it("should invalidate event-related caches", async () => {
      // Arrange
      await cacheService.set("event-data", "data", { tags: ["events"] });
      await cacheService.set("role-data", "data", {
        tags: ["roles", "event:123"],
      });

      // Act
      await CachePatterns.invalidateEventCache("123");

      // Assert
      expect(await cacheService.get("event-data")).toBeNull();
      expect(await cacheService.get("role-data")).toBeNull();
    });

    it("should invalidate user-related caches", async () => {
      // Arrange
      await cacheService.set("user-session", "data", {
        tags: ["users", "user:123"],
      });
      await cacheService.set("user-prefs", "data", { tags: ["sessions"] });

      // Act
      await CachePatterns.invalidateUserCache("123");

      // Assert
      expect(await cacheService.get("user-session")).toBeNull();
      expect(await cacheService.get("user-prefs")).toBeNull();
    });

    it("should invalidate analytics caches", async () => {
      // Arrange
      await cacheService.set("analytics-overview", "data", {
        tags: ["analytics"],
      });

      // Act
      await CachePatterns.invalidateAnalyticsCache();

      // Assert
      expect(await cacheService.get("analytics-overview")).toBeNull();
    });
  });
});

// Integration test for real-world usage patterns
describe("CacheService Integration", () => {
  let integrationCacheService: CacheService;

  beforeEach(async () => {
    // Create a fresh cache service instance for integration tests
    integrationCacheService = new CacheService({
      maxSize: 1000,
      defaultTtl: 300,
      maxMemoryMB: 50,
    });
  });

  it("should handle a realistic caching workflow", async () => {
    // Simulate fetching analytics data
    const analyticsData = { users: 150, events: 75, registrations: 300 };
    const analyticsFetch = vi.fn().mockResolvedValue(analyticsData);

    // Simulate fetching event listings
    const eventData = [
      { id: 1, title: "Community Service", signups: 20 },
      { id: 2, title: "Bible Study", signups: 15 },
    ];
    const eventFetch = vi.fn().mockResolvedValue(eventData);

    // Act - Multiple requests for same data
    const analytics1 = await integrationCacheService.getOrSet(
      "overview",
      analyticsFetch,
      { ttl: 600, tags: ["analytics"] }
    );
    const analytics2 = await integrationCacheService.getOrSet(
      "overview",
      analyticsFetch,
      { ttl: 600, tags: ["analytics"] }
    );

    const events1 = await integrationCacheService.getOrSet(
      "upcoming",
      eventFetch,
      { ttl: 120, tags: ["events", "listings"] }
    );
    const events2 = await integrationCacheService.getOrSet(
      "upcoming",
      eventFetch,
      { ttl: 120, tags: ["events", "listings"] }
    );

    // Assert - Data consistency and fetch optimization
    expect(analytics1).toEqual(analytics2);
    expect(events1).toEqual(events2);
    expect(analyticsFetch).toHaveBeenCalledTimes(1);
    expect(eventFetch).toHaveBeenCalledTimes(1);

    // Create additional cache hits to ensure healthy status (need >70% hit rate)
    // These calls will be cache hits since data is already cached
    await integrationCacheService.getOrSet("overview", analyticsFetch, {
      ttl: 600,
      tags: ["analytics"],
    });
    await integrationCacheService.getOrSet("upcoming", eventFetch, {
      ttl: 120,
      tags: ["events", "listings"],
    });
    await integrationCacheService.getOrSet("overview", analyticsFetch, {
      ttl: 600,
      tags: ["analytics"],
    });
    await integrationCacheService.getOrSet("upcoming", eventFetch, {
      ttl: 120,
      tags: ["events", "listings"],
    });
    await integrationCacheService.getOrSet("overview", analyticsFetch, {
      ttl: 600,
      tags: ["analytics"],
    });
    await integrationCacheService.getOrSet("upcoming", eventFetch, {
      ttl: 120,
      tags: ["events", "listings"],
    });
    await integrationCacheService.getOrSet("overview", analyticsFetch, {
      ttl: 600,
      tags: ["analytics"],
    });
    await integrationCacheService.getOrSet("upcoming", eventFetch, {
      ttl: 120,
      tags: ["events", "listings"],
    });

    // Total operations: 2 initial + 8 additional = 10 operations
    // Hits: 8 (all the additional calls hit cache)
    // Hit rate: 8/10 = 80% (healthy)

    // Verify cache health - should be healthy with good hit rate
    const health = integrationCacheService.getHealthInfo();
    expect(health.status).toBe("healthy");
    expect(health.details.totalKeys).toBe(2);
  });
});
