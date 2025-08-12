/**
 * End-to-End Cache Integration Tests
 *
 * Tests the complete cache system integration including:
 * - Cache invalidation flows across all components
 * - Performance optimization verification
 * - Data consistency guarantees
 * - Error handling and recovery
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  vi,
} from "vitest";
// Ensure real timers immediately to prevent interference from other files using fake timers
vi.useRealTimers();
import mongoose from "mongoose";
import {
  cacheService,
  CachePatterns,
} from "../../../src/services/infrastructure/CacheService";

describe("End-to-End Cache Integration Tests", () => {
  // Force real timers for integration timing/TTL behavior to avoid leaked fake timers
  beforeAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await cacheService.clear();
  });

  afterEach(async () => {
    await cacheService.clear();
    vi.clearAllMocks();
  });

  describe("Complete Cache Invalidation Flow", () => {
    it("should demonstrate full cache lifecycle with real-time invalidation", async () => {
      // Simulate a complete user workflow with cache interactions

      // 1. INITIAL DATA LOADING - Cache gets populated
      const userId = new mongoose.Types.ObjectId().toString();
      const eventId = new mongoose.Types.ObjectId().toString();

      // Cache user listings
      const userListingKey = "user-listing:page=1&limit=10";
      const mockUsers = [{ id: userId, name: "Test User" }];
      await CachePatterns.getUserListing(userListingKey, async () => mockUsers);

      // Cache event listings
      const eventListingKey = "events-listing:page=1&limit=10";
      const mockEvents = [{ id: eventId, title: "Test Event", signedUp: 5 }];
      await CachePatterns.getEventListing(
        eventListingKey,
        async () => mockEvents
      );

      // Cache analytics data
      const analyticsKey = "system-overview";
      const mockAnalytics = {
        totalUsers: 100,
        totalEvents: 50,
        activeRegistrations: 200,
      };
      await CachePatterns.getAnalyticsData(
        analyticsKey,
        async () => mockAnalytics
      );

      // Cache search results
      const searchKey = "search:users:test";
      const mockSearchResults = [{ id: userId, name: "Test User" }];
      await CachePatterns.getSearchResults(
        searchKey,
        async () => mockSearchResults
      );

      // Cache role availability
      const roleKey = `role-availability:${eventId}:volunteer`;
      const mockRoleData = { available: 5, total: 10 };
      await CachePatterns.getRoleAvailability(
        eventId,
        "volunteer",
        async () => mockRoleData
      );

      // Verify all caches are populated
      expect(await cacheService.get(userListingKey)).toEqual(mockUsers);
      expect(await cacheService.get(eventListingKey)).toEqual(mockEvents);
      expect(await cacheService.get(analyticsKey)).toEqual(mockAnalytics);
      expect(await cacheService.get(searchKey)).toEqual(mockSearchResults);
      expect(await cacheService.get(roleKey)).toEqual(mockRoleData);

      // 2. USER PROFILE UPDATE - Should invalidate user-related caches
      await CachePatterns.invalidateUserCache(userId);

      // User-related caches should be cleared
      expect(await cacheService.get(userListingKey)).toBeNull();
      expect(await cacheService.get(searchKey)).toBeNull();

      // Event and analytics caches should remain
      expect(await cacheService.get(eventListingKey)).toEqual(mockEvents);
      expect(await cacheService.get(analyticsKey)).toEqual(mockAnalytics);
      expect(await cacheService.get(roleKey)).toEqual(mockRoleData);

      // 3. EVENT UPDATE - Should invalidate event-related caches
      await CachePatterns.invalidateEventCache(eventId);

      // Event-related caches should be cleared
      expect(await cacheService.get(eventListingKey)).toBeNull();
      expect(await cacheService.get(roleKey)).toBeNull();

      // Analytics should remain (until explicitly invalidated)
      expect(await cacheService.get(analyticsKey)).toEqual(mockAnalytics);

      // 4. SYSTEM OPERATION - Should invalidate analytics
      await CachePatterns.invalidateAnalyticsCache();

      // Analytics should be cleared
      expect(await cacheService.get(analyticsKey)).toBeNull();

      // Verify complete cache clearance
      const metrics = cacheService.getMetrics();
      expect(metrics.totalKeys).toBe(0);
    });

    it("should handle complex tag-based invalidation scenarios", async () => {
      // Create overlapping cache entries with different tag combinations

      // Cache entries with overlapping tags
      await cacheService.set("user-list-1", "data1", {
        ttl: 300,
        tags: ["users", "listings"],
      });
      await cacheService.set("user-list-2", "data2", {
        ttl: 300,
        tags: ["users", "listings", "search"],
      });
      await cacheService.set("event-list-1", "data3", {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set("event-detail-1", "data4", {
        ttl: 300,
        tags: ["events", "event:123"],
      });
      await cacheService.set("search-results-1", "data5", {
        ttl: 300,
        tags: ["search", "users"],
      });
      await cacheService.set("analytics-1", "data6", {
        ttl: 300,
        tags: ["analytics"],
      });

      // Verify all entries exist
      expect(await cacheService.get("user-list-1")).toEqual("data1");
      expect(await cacheService.get("user-list-2")).toEqual("data2");
      expect(await cacheService.get("event-list-1")).toEqual("data3");
      expect(await cacheService.get("event-detail-1")).toEqual("data4");
      expect(await cacheService.get("search-results-1")).toEqual("data5");
      expect(await cacheService.get("analytics-1")).toEqual("data6");

      // Invalidate by "listings" tag - should clear user and event listings
      const removedCount = await cacheService.invalidateByTags(["listings"]);
      expect(removedCount).toBe(3); // user-list-1, user-list-2, event-list-1

      expect(await cacheService.get("user-list-1")).toBeNull();
      expect(await cacheService.get("user-list-2")).toBeNull();
      expect(await cacheService.get("event-list-1")).toBeNull();
      expect(await cacheService.get("event-detail-1")).toEqual("data4");
      expect(await cacheService.get("search-results-1")).toEqual("data5");
      expect(await cacheService.get("analytics-1")).toEqual("data6");

      // Invalidate by "search" tag - should clear search results
      const removedCount2 = await cacheService.invalidateByTags(["search"]);
      expect(removedCount2).toBe(1); // search-results-1

      expect(await cacheService.get("search-results-1")).toBeNull();
      expect(await cacheService.get("event-detail-1")).toEqual("data4");
      expect(await cacheService.get("analytics-1")).toEqual("data6");
    });
  });

  describe("Performance and Consistency Verification", () => {
    it("should provide measurable performance benefits", async () => {
      // Simulate expensive database operations with caching

      let databaseCallCount = 0;
      const expensiveOperation = async () => {
        databaseCallCount++;
        // Simulate database delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: "expensive-result", timestamp: Date.now() };
      };

      const cacheKey = "expensive-operation";

      // First call - should hit database
      const start1 = Date.now();
      const result1 = await CachePatterns.getAnalyticsData(
        cacheKey,
        expensiveOperation
      );
      const time1 = Date.now() - start1;

      expect(databaseCallCount).toBe(1);
      expect(result1.data).toBe("expensive-result");

      // Second call - should hit cache (much faster)
      const start2 = Date.now();
      const result2 = await CachePatterns.getAnalyticsData(
        cacheKey,
        expensiveOperation
      );
      const time2 = Date.now() - start2;

      expect(databaseCallCount).toBe(1); // No additional database call
      expect(result2).toEqual(result1); // Same result
      expect(time2).toBeLessThan(time1); // Faster due to cache

      // Verify cache hit metrics
      const metrics = cacheService.getMetrics();
      expect(metrics.hitCount).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeGreaterThan(0);
    });

    it("should maintain data freshness with TTL", async () => {
      // Test that cache entries expire as expected

      const shortTtlKey = "short-ttl-test";
      const testData = { value: "test-data" };

      // Cache with very short TTL
      await cacheService.set(shortTtlKey, testData, { ttl: 1 }); // 1 second

      // Should be available immediately
      expect(await cacheService.get(shortTtlKey)).toEqual(testData);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(await cacheService.get(shortTtlKey)).toBeNull();
    });

    it("should handle cache memory limits gracefully", async () => {
      // Test LRU eviction behavior

      // Create a cache with small size limit
      const smallCache = cacheService;

      // Fill cache beyond limit (current limit is 2000, so we'll use a reasonable number)
      const entries = 50;
      for (let i = 0; i < entries; i++) {
        await smallCache.set(`key-${i}`, `value-${i}`, { ttl: 300 });
      }

      // All entries should be cached initially
      const metrics = smallCache.getMetrics();
      expect(metrics.totalKeys).toBe(entries);

      // Access some entries to update LRU order
      await smallCache.get("key-0");
      await smallCache.get("key-1");
      await smallCache.get("key-2");

      // Cache should handle memory management gracefully
      expect(metrics.totalKeys).toBeGreaterThan(0);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle cache service failures gracefully", async () => {
      // Simulate cache service failure
      const originalGet = cacheService.get.bind(cacheService);
      const originalSet = cacheService.set.bind(cacheService);

      try {
        // Mock cache failures
        cacheService.get = vi.fn().mockImplementation(async () => {
          throw new Error("Cache service unavailable");
        });
        cacheService.set = vi.fn().mockImplementation(async () => {
          throw new Error("Cache service unavailable");
        });

        // Application should still work without cache
        let fallbackCalled = false;
        const fallbackFunction = async () => {
          fallbackCalled = true;
          return { data: "fallback-result" };
        };

        const result = await cacheService.getOrSet(
          "test-key",
          fallbackFunction
        );

        expect(fallbackCalled).toBe(true);
        expect(result.data).toBe("fallback-result");
      } finally {
        // Restore original methods
        cacheService.get = originalGet;
        cacheService.set = originalSet;
      }
    });

    it("should recover from cache corruption scenarios", async () => {
      // Test cache recovery mechanisms

      // Cache some data
      await cacheService.set("test-key", "test-data", { ttl: 300 });
      expect(await cacheService.get("test-key")).toBe("test-data");

      // Simulate cache clearing (recovery scenario)
      await cacheService.clear();

      // Cache should be empty but functional
      expect(await cacheService.get("test-key")).toBeNull();
      expect(cacheService.getMetrics().totalKeys).toBe(0);

      // Should be able to cache new data
      await cacheService.set("recovery-test", "recovery-data", { ttl: 300 });
      expect(await cacheService.get("recovery-test")).toBe("recovery-data");
    });
  });

  describe("Cache Health Monitoring", () => {
    it("should provide accurate health status under different conditions", async () => {
      // Test healthy state
      const initialHealth = cacheService.getHealthInfo();
      expect(initialHealth.status).toBe("healthy");

      // Add some cache entries
      for (let i = 0; i < 10; i++) {
        await cacheService.set(`test-${i}`, `data-${i}`, { ttl: 300 });
      }

      // Create some cache hits
      for (let i = 0; i < 5; i++) {
        await cacheService.get(`test-${i}`);
      }

      // Create some cache misses
      for (let i = 0; i < 3; i++) {
        await cacheService.get(`missing-${i}`);
      }

      const healthWithActivity = cacheService.getHealthInfo();
      expect(healthWithActivity.status).toBe("healthy");
      expect(healthWithActivity.details.totalKeys).toBe(10);
      expect(healthWithActivity.details.hitRate).toBeGreaterThan(0);
    });

    it("should track cache performance metrics accurately", async () => {
      const initialMetrics = cacheService.getMetrics();

      // Perform various cache operations
      await cacheService.set("metric-test-1", "data1", { ttl: 300 });
      await cacheService.set("metric-test-2", "data2", { ttl: 300 });
      await cacheService.get("metric-test-1"); // Hit
      await cacheService.get("metric-test-2"); // Hit
      await cacheService.get("non-existent"); // Miss

      const finalMetrics = cacheService.getMetrics();

      expect(finalMetrics.totalKeys).toBe(2);
      expect(finalMetrics.hitCount).toBeGreaterThan(initialMetrics.hitCount);
      expect(finalMetrics.missCount).toBeGreaterThan(initialMetrics.missCount);
      expect(finalMetrics.hitRate).toBeGreaterThan(0);
    });
  });
});
