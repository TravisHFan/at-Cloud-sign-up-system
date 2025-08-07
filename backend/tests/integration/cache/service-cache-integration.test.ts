/**
 * Service Cache Integration Tests (Simplified)
 *
 * Tests cache integration with service layer operations focusing on:
 * - Cache invalidation patterns
 * - Service-level cache interaction
 * - Error handling during cache operations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  cacheService,
  CachePatterns,
} from "../../../src/services/infrastructure/CacheService";

describe("Service Cache Integration Tests", () => {
  let mockUser: any;
  let mockEvent: any;

  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.clear();
    vi.clearAllMocks();

    // Setup mock data
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: "user@example.com",
      username: "testuser",
      role: "user",
    };

    mockEvent = {
      _id: new mongoose.Types.ObjectId(),
      title: "Test Event",
      description: "Test Description",
      signedUp: 5,
      maxSignups: 10,
      roles: [
        {
          _id: new mongoose.Types.ObjectId(),
          name: "role1",
          maxSignups: 5,
          signedUp: 2,
        },
      ],
    };
  });

  describe("CachePatterns Direct Testing", () => {
    it("should handle cache invalidation for user operations", async () => {
      // Set some cache data with appropriate tags
      await cacheService.set("user_listing", [mockUser], {
        ttl: 300,
        tags: ["users", "listings"],
      });
      await cacheService.set(`user_${mockUser._id}`, mockUser, {
        ttl: 300,
        tags: ["users", `user:${mockUser._id}`],
      });
      await cacheService.set(
        "analytics_user_stats",
        { total: 1 },
        { ttl: 300, tags: ["analytics", "users"] }
      );

      // Verify data is cached
      expect(await cacheService.get("user_listing")).toEqual([mockUser]);
      expect(await cacheService.get(`user_${mockUser._id}`)).toEqual(mockUser);
      expect(await cacheService.get("analytics_user_stats")).toEqual({
        total: 1,
      });

      // Call invalidation
      await CachePatterns.invalidateUserCache(mockUser._id.toString());

      // Verify user-related caches are cleared
      expect(await cacheService.get("user_listing")).toBeNull();
      expect(await cacheService.get(`user_${mockUser._id}`)).toBeNull();
      expect(await cacheService.get("analytics_user_stats")).toBeNull();
    });

    it("should handle cache invalidation for event operations", async () => {
      // Set some cache data with appropriate tags
      await cacheService.set("event_listing", [mockEvent], {
        ttl: 300,
        tags: ["events", "listings"],
      });
      await cacheService.set(`event_${mockEvent._id}`, mockEvent, {
        ttl: 300,
        tags: ["events", `event:${mockEvent._id}`],
      });
      await cacheService.set(
        "analytics_event_stats",
        { total: 1 },
        { ttl: 300, tags: ["analytics", "events"] }
      );

      // Verify data is cached
      expect(await cacheService.get("event_listing")).toEqual([mockEvent]);
      expect(await cacheService.get(`event_${mockEvent._id}`)).toEqual(
        mockEvent
      );

      // Call invalidation
      await CachePatterns.invalidateEventCache(mockEvent._id.toString());

      // Verify event-related caches are cleared
      expect(await cacheService.get("event_listing")).toBeNull();
      expect(await cacheService.get(`event_${mockEvent._id}`)).toBeNull();
    });

    it("should handle analytics cache invalidation", async () => {
      // Set analytics cache data with appropriate tags
      await cacheService.set(
        "analytics_summary",
        { users: 10, events: 5 },
        { ttl: 300, tags: ["analytics"] }
      );
      await cacheService.set(
        "analytics_user_stats",
        { active: 8 },
        { ttl: 300, tags: ["analytics"] }
      );
      await cacheService.set(
        "analytics_event_stats",
        { upcoming: 3 },
        { ttl: 300, tags: ["analytics"] }
      );

      // Verify data is cached
      expect(await cacheService.get("analytics_summary")).toEqual({
        users: 10,
        events: 5,
      });

      // Call invalidation
      await CachePatterns.invalidateAnalyticsCache();

      // Verify analytics caches are cleared
      expect(await cacheService.get("analytics_summary")).toBeNull();
      expect(await cacheService.get("analytics_user_stats")).toBeNull();
      expect(await cacheService.get("analytics_event_stats")).toBeNull();
    });

    it("should handle cache errors gracefully", async () => {
      // Mock cache service to throw errors
      vi.spyOn(cacheService, "delete").mockRejectedValue(
        new Error("Cache delete failed")
      );

      // Should not throw even if cache operations fail
      await expect(
        CachePatterns.invalidateUserCache(mockUser._id.toString())
      ).resolves.not.toThrow();
      await expect(
        CachePatterns.invalidateEventCache(mockEvent._id.toString())
      ).resolves.not.toThrow();
      await expect(
        CachePatterns.invalidateAnalyticsCache()
      ).resolves.not.toThrow();

      // Restore original methods
      vi.restoreAllMocks();
    });

    it("should maintain cache consistency across operations", async () => {
      // Set cross-related cache data with appropriate tags
      await cacheService.set("user_listing", [mockUser], {
        ttl: 300,
        tags: ["users", "listings"],
      });
      await cacheService.set("event_listing", [mockEvent], {
        ttl: 300,
        tags: ["events"],
      });
      await cacheService.set(
        "analytics_summary",
        { users: 1, events: 1 },
        { ttl: 300, tags: ["analytics", "users"] }
      );

      // User deletion should invalidate user and analytics cache but not events
      await CachePatterns.invalidateUserCache(mockUser._id.toString());

      // User-related caches should be cleared, but event cache should remain
      expect(await cacheService.get("user_listing")).toBeNull();
      expect(await cacheService.get("analytics_summary")).toBeNull();
      expect(await cacheService.get("event_listing")).toEqual([mockEvent]); // Should remain
    });
  });
});
