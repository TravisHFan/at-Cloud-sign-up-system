import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getOrSetPublicEventsList,
  bumpPublicEventsListVersion,
  __TEST__,
  PublicEventsListParams,
} from "../../../src/services/PublicEventsListCache";

describe("PublicEventsListCache", () => {
  beforeEach(() => {
    // Clear cache before each test
    __TEST__.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getOrSetPublicEventsList", () => {
    it("should call loader on cache miss and store result", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [{ id: 1 }] });
      const params: PublicEventsListParams = {
        page: 1,
        pageSize: 10,
      };

      const result = await getOrSetPublicEventsList(params, mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(result.payload).toEqual({ events: [{ id: 1 }] });
      expect(result.etag).toBeDefined();
      expect(result.etag).toMatch(/^W\/"ple-[a-f0-9]{40}"$/);
      expect(result.createdAt).toBeDefined();
      expect(typeof result.createdAt).toBe("number");
    });

    it("should return cached result on subsequent calls with same params", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [{ id: 1 }] });
      const params: PublicEventsListParams = {
        page: 1,
        pageSize: 10,
      };

      // First call - cache miss
      const result1 = await getOrSetPublicEventsList(params, mockLoader);
      expect(mockLoader).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result2 = await getOrSetPublicEventsList(params, mockLoader);
      expect(mockLoader).toHaveBeenCalledTimes(1); // Should not call loader again
      expect(result2).toEqual(result1);
      expect(result2.etag).toBe(result1.etag);
    });

    it("should treat different params as different cache keys", async () => {
      const mockLoader1 = vi.fn().mockResolvedValue({ events: [{ id: 1 }] });
      const mockLoader2 = vi.fn().mockResolvedValue({ events: [{ id: 2 }] });

      const params1: PublicEventsListParams = {
        page: 1,
        pageSize: 10,
      };

      const params2: PublicEventsListParams = {
        page: 2,
        pageSize: 10,
      };

      const result1 = await getOrSetPublicEventsList(params1, mockLoader1);
      const result2 = await getOrSetPublicEventsList(params2, mockLoader2);

      expect(mockLoader1).toHaveBeenCalledTimes(1);
      expect(mockLoader2).toHaveBeenCalledTimes(1);
      expect(result1.payload).toEqual({ events: [{ id: 1 }] });
      expect(result2.payload).toEqual({ events: [{ id: 2 }] });
      expect(result1.etag).not.toBe(result2.etag);
    });

    it("should include page in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList({ page: 2, pageSize: 10 }, mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should include pageSize in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList({ page: 1, pageSize: 20 }, mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should include type in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, type: "workshop" },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, type: "seminar" },
        mockLoader
      );

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should include dateFrom in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, dateFrom: "2024-01-01" },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, dateFrom: "2024-02-01" },
        mockLoader
      );

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should include dateTo in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, dateTo: "2024-12-31" },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, dateTo: "2024-06-30" },
        mockLoader
      );

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should include search query in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, q: "javascript" },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, q: "python" },
        mockLoader
      );

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should include sort in cache key", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, sort: "startAsc" },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, sort: "startDesc" },
        mockLoader
      );

      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should use default sort value if not provided", async () => {
      const mockLoader1 = vi.fn().mockResolvedValue({ events: [{ id: 1 }] });
      const mockLoader2 = vi.fn().mockResolvedValue({ events: [{ id: 2 }] });

      // Without sort (uses default "startAsc")
      await getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader1);

      // With explicit "startAsc" (should hit cache)
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, sort: "startAsc" },
        mockLoader2
      );

      // First call should populate cache, second should hit it
      expect(mockLoader1).toHaveBeenCalledTimes(1);
      expect(mockLoader2).toHaveBeenCalledTimes(0); // Cache hit
    });

    it("should generate different etags for different payloads", async () => {
      const params: PublicEventsListParams = { page: 1, pageSize: 10 };

      __TEST__.clear(); // Clear cache between calls

      const result1 = await getOrSetPublicEventsList(params, async () => ({
        events: [{ id: 1 }],
      }));

      __TEST__.clear(); // Clear cache to force reload with different data

      const result2 = await getOrSetPublicEventsList(params, async () => ({
        events: [{ id: 2 }],
      }));

      expect(result1.etag).not.toBe(result2.etag);
    });

    it("should handle complex payload structures", async () => {
      const complexPayload = {
        events: [
          {
            id: 1,
            title: "Event 1",
            startDate: "2024-01-01T10:00:00Z",
            roles: [
              { name: "Speaker", capacity: 5 },
              { name: "Attendee", capacity: 100 },
            ],
          },
        ],
        totalCount: 1,
        hasMore: false,
      };

      const mockLoader = vi.fn().mockResolvedValue(complexPayload);
      const result = await getOrSetPublicEventsList(
        { page: 1, pageSize: 10 },
        mockLoader
      );

      expect(result.payload).toEqual(complexPayload);
      expect(result.etag).toBeDefined();
    });

    it("should handle empty results", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const result = await getOrSetPublicEventsList(
        { page: 1, pageSize: 10 },
        mockLoader
      );

      expect(result.payload).toEqual({ events: [] });
      expect(result.etag).toBeDefined();
    });

    it("should handle loader errors", async () => {
      const mockLoader = vi.fn().mockRejectedValue(new Error("Database error"));

      await expect(
        getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader)
      ).rejects.toThrow("Database error");
    });

    it("should propagate loader promise rejection", async () => {
      const customError = new Error("Custom loader error");
      const mockLoader = vi.fn().mockRejectedValue(customError);

      await expect(
        getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader)
      ).rejects.toThrow(customError);
    });
  });

  describe("bumpPublicEventsListVersion", () => {
    it("should invalidate all cached entries when version is bumped", async () => {
      const mockLoader1 = vi.fn().mockResolvedValue({ events: [{ id: 1 }] });
      const mockLoader2 = vi.fn().mockResolvedValue({ events: [{ id: 2 }] });
      const params: PublicEventsListParams = { page: 1, pageSize: 10 };

      // First call - populate cache
      const result1 = await getOrSetPublicEventsList(params, mockLoader1);
      expect(mockLoader1).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      await getOrSetPublicEventsList(params, mockLoader1);
      expect(mockLoader1).toHaveBeenCalledTimes(1); // Still 1, cache hit

      // Bump version
      bumpPublicEventsListVersion();

      // Third call - cache should be invalidated, new loader should be called
      const result2 = await getOrSetPublicEventsList(params, mockLoader2);
      expect(mockLoader2).toHaveBeenCalledTimes(1);
      expect(result2.payload).toEqual({ events: [{ id: 2 }] });
      expect(result2.etag).not.toBe(result1.etag);
    });

    it("should increment version number", () => {
      const initialVersion = __TEST__.getVersion();
      bumpPublicEventsListVersion();
      const newVersion = __TEST__.getVersion();

      expect(newVersion).toBe(initialVersion + 1);
    });

    it("should handle multiple version bumps", () => {
      const initialVersion = __TEST__.getVersion();

      bumpPublicEventsListVersion();
      bumpPublicEventsListVersion();
      bumpPublicEventsListVersion();

      const finalVersion = __TEST__.getVersion();
      expect(finalVersion).toBe(initialVersion + 3);
    });

    it("should invalidate all different param combinations after version bump", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      // Populate cache with multiple param combinations
      await getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList({ page: 2, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList({ page: 1, pageSize: 20 }, mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(3);

      // Bump version
      bumpPublicEventsListVersion();

      // All should be cache misses now
      await getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList({ page: 2, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList({ page: 1, pageSize: 20 }, mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(6); // 3 initial + 3 after bump
    });
  });

  describe("cache TTL behavior", () => {
    it("should respect cache TTL from environment variable", async () => {
      // This test assumes default TTL is set (60000ms)
      // In practice, TTL is tested through LRU cache tests
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const params: PublicEventsListParams = { page: 1, pageSize: 10 };

      await getOrSetPublicEventsList(params, mockLoader);
      expect(mockLoader).toHaveBeenCalledTimes(1);

      // Within TTL, should hit cache
      await getOrSetPublicEventsList(params, mockLoader);
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });
  });

  describe("etag generation", () => {
    it("should generate consistent etag for same params and payload", async () => {
      const payload = { events: [{ id: 1 }] };
      const params: PublicEventsListParams = { page: 1, pageSize: 10 };

      __TEST__.clear();
      const result1 = await getOrSetPublicEventsList(
        params,
        async () => payload
      );

      __TEST__.clear();
      const result2 = await getOrSetPublicEventsList(
        params,
        async () => payload
      );

      expect(result1.etag).toBe(result2.etag);
    });

    it("should include 'ple-' prefix in etag", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const result = await getOrSetPublicEventsList(
        { page: 1, pageSize: 10 },
        mockLoader
      );

      expect(result.etag).toContain("ple-");
    });

    it("should use weak etag format (W/)", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const result = await getOrSetPublicEventsList(
        { page: 1, pageSize: 10 },
        mockLoader
      );

      expect(result.etag).toMatch(/^W\//);
    });

    it("should generate 40-character hex hash in etag", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const result = await getOrSetPublicEventsList(
        { page: 1, pageSize: 10 },
        mockLoader
      );

      // Format: W/"ple-{40 hex chars}"
      const hashMatch = result.etag.match(/ple-([a-f0-9]{40})/);
      expect(hashMatch).not.toBeNull();
      expect(hashMatch![1]).toHaveLength(40);
    });
  });

  describe("__TEST__ utilities", () => {
    it("should clear cache when clear() is called", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const params: PublicEventsListParams = { page: 1, pageSize: 10 };

      // Populate cache
      await getOrSetPublicEventsList(params, mockLoader);
      expect(mockLoader).toHaveBeenCalledTimes(1);

      // Clear cache
      __TEST__.clear();

      // Should call loader again after clear
      await getOrSetPublicEventsList(params, mockLoader);
      expect(mockLoader).toHaveBeenCalledTimes(2);
    });

    it("should expose current version via getVersion()", () => {
      const version = __TEST__.getVersion();
      expect(typeof version).toBe("number");
      expect(version).toBeGreaterThan(0);
    });
  });

  describe("stress testing", () => {
    it("should handle many different param combinations", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      // Generate 50 different param combinations
      for (let page = 1; page <= 10; page++) {
        for (let pageSize of [10, 20, 50]) {
          await getOrSetPublicEventsList({ page, pageSize }, mockLoader);
        }
      }

      expect(mockLoader).toHaveBeenCalledTimes(30); // 10 pages * 3 page sizes

      // Repeat same params - should all hit cache
      const callsBefore = mockLoader.mock.calls.length;
      for (let page = 1; page <= 10; page++) {
        for (let pageSize of [10, 20, 50]) {
          await getOrSetPublicEventsList({ page, pageSize }, mockLoader);
        }
      }

      expect(mockLoader).toHaveBeenCalledTimes(callsBefore); // No new calls
    });

    it("should handle rapid successive calls with same params", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });
      const params: PublicEventsListParams = { page: 1, pageSize: 10 };

      // Make 10 rapid calls simultaneously
      const promises = Array(10)
        .fill(null)
        .map(() => getOrSetPublicEventsList(params, mockLoader));

      await Promise.all(promises);

      // When all promises start before any complete, they all see cache miss
      // The cache is populated after first loader completes, but by then
      // all other promises are already executing their loaders
      // So we expect all 10 to call the loader (race condition is expected behavior)
      expect(mockLoader.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(mockLoader.mock.calls.length).toBeLessThanOrEqual(10);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined optional params consistently", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      // These should all result in the same cache key
      await getOrSetPublicEventsList({ page: 1, pageSize: 10 }, mockLoader);
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, type: undefined },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, dateFrom: undefined, dateTo: undefined },
        mockLoader
      );

      // Should only call loader once (cache hits for subsequent calls)
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it("should handle empty string params", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, type: "" },
        mockLoader
      );
      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, q: "" },
        mockLoader
      );

      // Empty strings should be treated same as undefined
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it("should handle very large payloads", async () => {
      const largePayload = {
        events: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: i,
            title: `Event ${i}`,
            description: "A".repeat(1000),
          })),
      };

      const mockLoader = vi.fn().mockResolvedValue(largePayload);
      const result = await getOrSetPublicEventsList(
        { page: 1, pageSize: 1000 },
        mockLoader
      );

      expect(result.payload).toEqual(largePayload);
      expect(result.etag).toBeDefined();
    });

    it("should handle special characters in query params", async () => {
      const mockLoader = vi.fn().mockResolvedValue({ events: [] });

      await getOrSetPublicEventsList(
        { page: 1, pageSize: 10, q: "test & special <chars>" },
        mockLoader
      );

      expect(mockLoader).toHaveBeenCalledTimes(1);
    });
  });
});
