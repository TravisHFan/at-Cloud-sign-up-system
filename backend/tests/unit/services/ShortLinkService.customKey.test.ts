// ShortLinkService.customKey.test.ts - Additional coverage for custom key validation
import { describe, it, expect, vi, beforeEach } from "vitest";
import ShortLinkService from "../../../src/services/ShortLinkService";
import ShortLink from "../../../src/models/ShortLink";
import Event from "../../../src/models/Event";
import { Types } from "mongoose";

vi.mock("../../../src/models/ShortLink", () => {
  const store: { findOneValue?: any } = {};

  function makeFindOne() {
    const thenable: any = {
      select: vi.fn(() => Promise.resolve(store.findOneValue || null)),
      then: (resolve: any) => resolve(store.findOneValue || null),
    };
    return thenable;
  }

  const api: any = {
    _store: store,
    findOne: vi.fn(() => makeFindOne()),
    create: vi.fn(),
    getActiveByKey: vi.fn(),
    updateMany: vi.fn(),
  };
  return { __esModule: true, default: api };
});

vi.mock("../../../src/models/Event", () => ({
  __esModule: true,
  default: { findById: vi.fn() },
}));

vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));

describe("ShortLinkService - Custom Key Validation", () => {
  const userId = new Types.ObjectId().toString();
  const eventId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
    (ShortLink as any)._store.findOneValue = undefined;
    (ShortLinkService as any).__clearCacheForTests?.();
  });

  function mockEvent(overrides: Record<string, any> = {}) {
    return {
      _id: new Types.ObjectId(eventId),
      publish: true,
      publicSlug: "my-event",
      roles: [{ openToPublic: true }],
      endDate: "2099-12-31",
      endTime: "23:59",
      ...overrides,
    };
  }

  describe("getOrCreateForEvent with customKey", () => {
    beforeEach(() => {
      (Event.findById as any).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockEvent()),
      });
    });

    it("rejects custom key with invalid pattern (too short)", async () => {
      // No existing link for this event
      (ShortLink as any)._store.findOneValue = null;

      await expect(
        ShortLinkService.getOrCreateForEvent(eventId, userId, "ab") // too short (< 3 chars)
      ).rejects.toThrow(/Custom key invalid/i);
    });

    it("rejects custom key with invalid pattern (special characters)", async () => {
      (ShortLink as any)._store.findOneValue = null;

      await expect(
        ShortLinkService.getOrCreateForEvent(eventId, userId, "my@key!")
      ).rejects.toThrow(/Custom key invalid/i);
    });

    it("rejects custom key with invalid pattern (too long)", async () => {
      (ShortLink as any)._store.findOneValue = null;
      const longKey = "a".repeat(20); // exceeds 16-char limit

      await expect(
        ShortLinkService.getOrCreateForEvent(eventId, userId, longKey)
      ).rejects.toThrow(/Custom key invalid/i);
    });

    it("rejects reserved custom key", async () => {
      (ShortLink as any)._store.findOneValue = null;

      // "metrics" is a reserved key by default
      await expect(
        ShortLinkService.getOrCreateForEvent(eventId, userId, "metrics")
      ).rejects.toThrow(/Custom key reserved/i);
    });

    it("rejects reserved custom key case-insensitively", async () => {
      (ShortLink as any)._store.findOneValue = null;

      await expect(
        ShortLinkService.getOrCreateForEvent(eventId, userId, "HEALTH")
      ).rejects.toThrow(/Custom key reserved/i);
    });

    it("rejects custom key that is already taken", async () => {
      // First call returns null (no existing link for this event)
      // Second call (collision check) returns an existing link
      let callCount = 0;
      (ShortLink.findOne as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - check for existing link for this event
          return {
            select: vi.fn(() => Promise.resolve(null)),
            then: (resolve: any) => resolve(null),
          };
        } else {
          // Second call - collision check for custom key
          return Promise.resolve({
            key: "my-custom-key",
            eventId: new Types.ObjectId(),
          });
        }
      });

      await expect(
        ShortLinkService.getOrCreateForEvent(eventId, userId, "my-custom-key")
      ).rejects.toThrow(/Custom key taken/i);
    });

    it("creates link with valid custom key", async () => {
      // No existing links
      (ShortLink.findOne as any).mockImplementation(() => ({
        select: vi.fn(() => Promise.resolve(null)),
        then: (resolve: any) => resolve(null),
      }));

      const createdDoc = {
        key: "my-custom-key",
        eventId,
        targetSlug: "my-event",
        expiresAt: new Date(Date.now() + 86400000),
        _id: new Types.ObjectId(),
      };
      (ShortLink.create as any).mockResolvedValue(createdDoc);

      const result = await ShortLinkService.getOrCreateForEvent(
        eventId,
        userId,
        "my-custom-key"
      );

      expect(result.created).toBe(true);
      expect(result.shortLink.key).toBe("my-custom-key");
    });

    it("normalizes custom key to lowercase", async () => {
      (ShortLink.findOne as any).mockImplementation(() => ({
        select: vi.fn(() => Promise.resolve(null)),
        then: (resolve: any) => resolve(null),
      }));

      const createdDoc = {
        key: "myuppercasekey",
        eventId,
        targetSlug: "my-event",
        expiresAt: new Date(Date.now() + 86400000),
        _id: new Types.ObjectId(),
      };
      (ShortLink.create as any).mockResolvedValue(createdDoc);

      const result = await ShortLinkService.getOrCreateForEvent(
        eventId,
        userId,
        "MyUpperCaseKey"
      );

      expect(result.created).toBe(true);
      // The key should be normalized to lowercase
      expect(result.shortLink.key).toBe("myuppercasekey");
    });
  });
});
