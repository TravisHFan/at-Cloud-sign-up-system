/**
 * Controller Cache Integration Tests
 *
 * Tests the cache integration patterns used by controllers:
 * - Cache invalidation patterns
 * - Service layer cache interactions
 * - Error handling with cache failures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CacheService,
  CachePatterns,
  cacheService,
} from "../../../src/services/infrastructure/CacheService";
import mongoose from "mongoose";

describe("Controller Cache Integration Tests", () => {
  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.clear();
  });

  afterEach(async () => {
    await cacheService.clear();
  });

  describe("Cache Invalidation Patterns", () => {
    it("should invalidate event cache correctly", async () => {
      const eventId = new mongoose.Types.ObjectId().toString();

      // Set some event-related cache entries with proper options format
      await cacheService.set("events:listing:page:1", ["event1", "event2"], {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set(
        `event:${eventId}`,
        { title: "Test Event" },
        { ttl: 300, tags: [`event:${eventId}`, "events"] }
      );
      await cacheService.set(
        "analytics:general",
        { totalEvents: 10 },
        { ttl: 300, tags: ["analytics"] }
      );

      // Verify cache entries exist
      expect(await cacheService.get("events:listing:page:1")).toBeTruthy();
      expect(await cacheService.get(`event:${eventId}`)).toBeTruthy();
      expect(await cacheService.get("analytics:general")).toBeTruthy();

      // Invalidate event cache (this is what controllers do)
      await CachePatterns.invalidateEventCache(eventId);

      // Verify event-related caches are cleared
      expect(await cacheService.get("events:listing:page:1")).toBeNull();
      expect(await cacheService.get(`event:${eventId}`)).toBeNull();
      // Analytics should remain (not tagged with event-related tags)
      expect(await cacheService.get("analytics:general")).toBeTruthy();
    });

    it("should invalidate user cache correctly", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      // Set some user-related cache entries
      await cacheService.set("users:listing:page:1", ["user1", "user2"], {
        ttl: 300,
        tags: ["users", "listings"],
      });
      await cacheService.set(
        `user:${userId}`,
        { username: "testuser" },
        { ttl: 300, tags: [`user:${userId}`, "users"] }
      );
      await cacheService.set("search:users:test", ["user1"], {
        ttl: 300,
        tags: ["search", "users"],
      });

      // Verify cache entries exist
      expect(await cacheService.get("users:listing:page:1")).toBeTruthy();
      expect(await cacheService.get(`user:${userId}`)).toBeTruthy();
      expect(await cacheService.get("search:users:test")).toBeTruthy();

      // Invalidate user cache (this is what controllers do)
      await CachePatterns.invalidateUserCache(userId);

      // Verify user-related caches are cleared
      expect(await cacheService.get("users:listing:page:1")).toBeNull();
      expect(await cacheService.get(`user:${userId}`)).toBeNull();
      expect(await cacheService.get("search:users:test")).toBeNull();
    });

    it("should invalidate analytics cache correctly", async () => {
      // Set analytics cache entries
      await cacheService.set(
        "analytics:general",
        { totalEvents: 10 },
        { ttl: 300, tags: ["analytics"] }
      );
      await cacheService.set(
        "analytics:monthly",
        { January: 5 },
        { ttl: 300, tags: ["analytics"] }
      );
      await cacheService.set(
        "analytics:registrations",
        { total: 100 },
        { ttl: 300, tags: ["analytics"] }
      );

      // Set non-analytics cache that should not be affected
      await cacheService.set("events:listing", ["event1"], {
        ttl: 300,
        tags: ["events"],
      });

      // Verify cache entries exist
      expect(await cacheService.get("analytics:general")).toBeTruthy();
      expect(await cacheService.get("analytics:monthly")).toBeTruthy();
      expect(await cacheService.get("analytics:registrations")).toBeTruthy();
      expect(await cacheService.get("events:listing")).toBeTruthy();

      // Invalidate analytics cache (this is what controllers do)
      await CachePatterns.invalidateAnalyticsCache();

      // Verify analytics caches are cleared
      expect(await cacheService.get("analytics:general")).toBeNull();
      expect(await cacheService.get("analytics:monthly")).toBeNull();
      expect(await cacheService.get("analytics:registrations")).toBeNull();

      // Non-analytics cache should remain
      expect(await cacheService.get("events:listing")).toBeTruthy();
    });
  });

  describe("Cache Service Integration", () => {
    it("should handle getOrSet operations correctly", async () => {
      const key = "test:cache:key";
      let fetcherCallCount = 0;

      const fetcher = async () => {
        fetcherCallCount++;
        return { data: "test data", timestamp: Date.now() };
      };

      // First call should fetch and cache
      const result1 = await cacheService.getOrSet(key, fetcher, { ttl: 300 });
      expect(result1).toHaveProperty("data", "test data");
      expect(fetcherCallCount).toBe(1);

      // Second call should use cache
      const result2 = await cacheService.getOrSet(key, fetcher, { ttl: 300 });
      expect(result2).toEqual(result1);
      expect(fetcherCallCount).toBe(1); // Still 1, no additional fetch

      // Verify cache hit
      const cachedValue = await cacheService.get(key);
      expect(cachedValue).toEqual(result1);
    });

    it("should handle cache errors gracefully", async () => {
      const key = "test:cache:error";
      const fetcher = async () => ({ data: "fetched data" });

      // Mock the cache set method to throw error
      const originalSet = cacheService.set;
      cacheService.set = vi
        .fn()
        .mockRejectedValue(new Error("Cache set failed"));

      // Should still return data even if cache set fails
      const result = await cacheService.getOrSet(key, fetcher, { ttl: 300 });
      expect(result).toHaveProperty("data", "fetched data");

      // Restore original method
      cacheService.set = originalSet;
    });

    it("should provide correct health information", async () => {
      // Add some test data to the cache
      await cacheService.set("test:key:1", "value1", { ttl: 300 });
      await cacheService.set("test:key:2", "value2", { ttl: 300 });

      // Generate some cache hits
      await cacheService.get("test:key:1");
      await cacheService.get("test:key:1");
      await cacheService.get("nonexistent:key"); // Cache miss

      const health = cacheService.getHealthInfo();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("details");
      expect(["healthy", "warning", "critical"]).toContain(health.status);

      expect(health.details).toHaveProperty("memoryUsageMB");
      expect(health.details).toHaveProperty("hitRate");
      expect(health.details).toHaveProperty("totalKeys");
      expect(health.details.totalKeys).toBeGreaterThan(0);
    });
  });

  describe("Cache Pattern Methods", () => {
    it("should cache analytics data with appropriate TTL", async () => {
      const key = "test:analytics:data";
      let fetchCount = 0;

      const fetchAnalytics = async () => {
        fetchCount++;
        return { totalEvents: 10, totalUsers: 25 };
      };

      // Call CachePatterns.getAnalyticsData
      const result1 = await CachePatterns.getAnalyticsData(key, fetchAnalytics);
      expect(result1).toEqual({ totalEvents: 10, totalUsers: 25 });
      expect(fetchCount).toBe(1);

      // Second call should use cache
      const result2 = await CachePatterns.getAnalyticsData(key, fetchAnalytics);
      expect(result2).toEqual(result1);
      expect(fetchCount).toBe(1); // No additional fetch
    });

    it("should cache event listings with appropriate TTL", async () => {
      const key = "test:event:listings";
      let fetchCount = 0;

      const fetchEvents = async () => {
        fetchCount++;
        return [
          { id: 1, title: "Event 1" },
          { id: 2, title: "Event 2" },
        ];
      };

      // Call CachePatterns.getEventListing
      const result1 = await CachePatterns.getEventListing(key, fetchEvents);
      expect(result1).toHaveLength(2);
      expect(fetchCount).toBe(1);

      // Second call should use cache
      const result2 = await CachePatterns.getEventListing(key, fetchEvents);
      expect(result2).toEqual(result1);
      expect(fetchCount).toBe(1);
    });

    it("should cache user session data", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      let fetchCount = 0;

      const fetchUserSession = async () => {
        fetchCount++;
        return { userId, username: "testuser", permissions: ["read", "write"] };
      };

      // Call CachePatterns.getUserSession
      const result1 = await CachePatterns.getUserSession(
        userId,
        fetchUserSession
      );
      expect(result1).toHaveProperty("userId", userId);
      expect(fetchCount).toBe(1);

      // Second call should use cache
      const result2 = await CachePatterns.getUserSession(
        userId,
        fetchUserSession
      );
      expect(result2).toEqual(result1);
      expect(fetchCount).toBe(1);
    });

    it("should cache role availability data", async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      const roleId = "volunteer";
      let fetchCount = 0;

      const fetchRoleAvailability = async () => {
        fetchCount++;
        return { eventId, roleId, available: 5, total: 10 };
      };

      // Call CachePatterns.getRoleAvailability
      const result1 = await CachePatterns.getRoleAvailability(
        eventId,
        roleId,
        fetchRoleAvailability
      );
      expect(result1).toHaveProperty("available", 5);
      expect(fetchCount).toBe(1);

      // Second call should use cache
      const result2 = await CachePatterns.getRoleAvailability(
        eventId,
        roleId,
        fetchRoleAvailability
      );
      expect(result2).toEqual(result1);
      expect(fetchCount).toBe(1);
    });
  });

  describe("Cross-Controller Cache Dependencies", () => {
    it("should handle event creation cache invalidation", async () => {
      const eventId = new mongoose.Types.ObjectId().toString();

      // Set up caches that should be invalidated when an event is created
      await cacheService.set("events:listing:page:1", ["existing_event"], {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set("search:events:test", ["existing_event"], {
        ttl: 300,
        tags: ["search", "events"],
      });
      await cacheService.set(
        "analytics:general",
        { totalEvents: 5 },
        { ttl: 300, tags: ["analytics"] }
      );

      // Verify entries exist
      expect(await cacheService.get("events:listing:page:1")).toBeTruthy();
      expect(await cacheService.get("search:events:test")).toBeTruthy();
      expect(await cacheService.get("analytics:general")).toBeTruthy();

      // Simulate event creation cache invalidation
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();

      // Verify event-related caches are cleared
      expect(await cacheService.get("events:listing:page:1")).toBeNull();
      expect(await cacheService.get("search:events:test")).toBeNull();
      expect(await cacheService.get("analytics:general")).toBeNull();
    });

    it("should handle user signup cache invalidation", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const eventId = new mongoose.Types.ObjectId().toString();

      // Set up caches that should be invalidated when a user signs up for an event
      await cacheService.set(
        `user:${userId}`,
        { username: "testuser" },
        { ttl: 300, tags: [`user:${userId}`, "users"] }
      );
      await cacheService.set(
        `event:${eventId}`,
        { title: "Test Event", signedUp: 5 },
        { ttl: 300, tags: [`event:${eventId}`, "events"] }
      );
      await cacheService.set("events:listing:page:1", ["event1", "event2"], {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set(
        "analytics:registrations",
        { total: 100 },
        { ttl: 300, tags: ["analytics"] }
      );

      // Verify entries exist
      expect(await cacheService.get(`user:${userId}`)).toBeTruthy();
      expect(await cacheService.get(`event:${eventId}`)).toBeTruthy();
      expect(await cacheService.get("events:listing:page:1")).toBeTruthy();
      expect(await cacheService.get("analytics:registrations")).toBeTruthy();

      // Simulate user signup cache invalidation (both user and event caches)
      await CachePatterns.invalidateUserCache(userId);
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();

      // Verify all relevant caches are cleared
      expect(await cacheService.get(`user:${userId}`)).toBeNull();
      expect(await cacheService.get(`event:${eventId}`)).toBeNull();
      expect(await cacheService.get("events:listing:page:1")).toBeNull();
      expect(await cacheService.get("analytics:registrations")).toBeNull();
    });
  });

  describe("Performance and Monitoring", () => {
    it("should track cache performance metrics", async () => {
      const key1 = "perf:test:1";
      const key2 = "perf:test:2";

      // Perform cache operations
      await cacheService.set(key1, "value1", { ttl: 300 });
      await cacheService.get(key1); // Cache hit
      await cacheService.get(key2); // Cache miss

      const metrics = cacheService.getMetrics();

      // Should have performance metrics
      expect(metrics.hitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.totalKeys).toBeGreaterThanOrEqual(0);
      expect(metrics.totalMemoryUsage).toBeGreaterThan(0);
      expect(metrics.hitCount).toBeGreaterThan(0);
      expect(metrics.missCount).toBeGreaterThan(0);
    });

    it("should handle high-frequency cache operations", async () => {
      const promises: Promise<{ value: string }>[] = [];

      // Simulate high-frequency cache operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          cacheService.getOrSet(
            `high-freq:${i % 10}`, // 10 unique keys, many duplicates
            async () => ({ value: `data-${i % 10}` }),
            { ttl: 300 }
          )
        );
      }

      const results = await Promise.all(promises);

      // All operations should complete successfully
      expect(results).toHaveLength(100);
      expect(results.every((r) => r.value)).toBe(true);

      // Should maintain reasonable performance
      const health = cacheService.getHealthInfo();
      expect(health.status).not.toBe("critical");
    });
  });

  describe("Tag-Based Cache Invalidation", () => {
    it("should support tag-based cache clearing", async () => {
      // Set cache entries with different tag patterns
      await cacheService.set("events:listing:page:1", ["event1"], {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set("events:listing:page:2", ["event2"], {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set("users:listing:page:1", ["user1"], {
        ttl: 300,
        tags: ["users", "listings"],
      });
      await cacheService.set("roles:data", ["role1"], {
        ttl: 300,
        tags: ["roles"],
      });

      // Verify entries exist
      expect(await cacheService.get("events:listing:page:1")).toBeTruthy();
      expect(await cacheService.get("events:listing:page:2")).toBeTruthy();
      expect(await cacheService.get("users:listing:page:1")).toBeTruthy();
      expect(await cacheService.get("roles:data")).toBeTruthy();

      // Invalidate only event-related tags
      const removedCount = await cacheService.invalidateByTags(["events"]);

      // Event listings should be cleared
      expect(await cacheService.get("events:listing:page:1")).toBeNull();
      expect(await cacheService.get("events:listing:page:2")).toBeNull();

      // Non-event caches should remain
      expect(await cacheService.get("users:listing:page:1")).toBeTruthy();
      expect(await cacheService.get("roles:data")).toBeTruthy();

      // Should have removed the event entries
      expect(removedCount).toBe(2);
    });

    it("should handle complex tag invalidation patterns", async () => {
      const eventId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();

      // Set up complex cache entries with overlapping tags
      await cacheService.set("event:general", ["event1"], {
        ttl: 300,
        tags: ["events", "general"],
      });
      await cacheService.set(
        `event:${eventId}`,
        { title: "Specific Event" },
        { ttl: 300, tags: ["events", `event:${eventId}`] }
      );
      await cacheService.set("user:general", ["user1"], {
        ttl: 300,
        tags: ["users", "general"],
      });
      await cacheService.set(
        `user:${userId}`,
        { username: "testuser" },
        { ttl: 300, tags: ["users", `user:${userId}`] }
      );
      await cacheService.set(
        "analytics:general",
        { count: 10 },
        { ttl: 300, tags: ["analytics", "general"] }
      );

      // Verify all entries exist
      expect(await cacheService.get("event:general")).toBeTruthy();
      expect(await cacheService.get(`event:${eventId}`)).toBeTruthy();
      expect(await cacheService.get("user:general")).toBeTruthy();
      expect(await cacheService.get(`user:${userId}`)).toBeTruthy();
      expect(await cacheService.get("analytics:general")).toBeTruthy();

      // Invalidate only "general" tagged items
      const removedCount = await cacheService.invalidateByTags(["general"]);

      // General items should be cleared
      expect(await cacheService.get("event:general")).toBeNull();
      expect(await cacheService.get("user:general")).toBeNull();
      expect(await cacheService.get("analytics:general")).toBeNull();

      // Specific tagged items should remain
      expect(await cacheService.get(`event:${eventId}`)).toBeTruthy();
      expect(await cacheService.get(`user:${userId}`)).toBeTruthy();

      // Should have removed 3 entries with "general" tag
      expect(removedCount).toBe(3);
    });
  });
});
