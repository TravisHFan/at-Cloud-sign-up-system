import { describe, it, expect, vi, beforeEach } from "vitest";
import ShortLinkService from "../../../src/services/ShortLinkService";
import ShortLink from "../../../src/models/ShortLink";
import Event from "../../../src/models/Event";
import * as keyUtil from "../../../src/utils/shortLinkKey";
import { Types } from "mongoose";

vi.mock("../../../src/models/ShortLink", () => {
  const store: { findOneValue?: any } = {};

  /**
   * Returns a thenable object so that `await ShortLink.findOne()` resolves to store.findOneValue,
   * while still allowing chaining: `ShortLink.findOne().select(...)`.
   */
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

describe("ShortLinkService", () => {
  const userId = new Types.ObjectId().toString();
  const eventId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
    // reset store between tests to avoid bleed-over
    (ShortLink as any)._store.findOneValue = undefined;
    // clear in-process LRU cache inside ShortLinkService to prevent previous test priming
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

  it("returns existing active short link idempotently", async () => {
    (Event.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEvent()),
    });
    const existing = {
      key: "abc123",
      _id: new Types.ObjectId(),
      eventId,
      targetSlug: "my-event",
      expiresAt: new Date(Date.now() + 3600_000),
      save: vi.fn().mockResolvedValue(undefined), // Mock save method for auto-correction path
    };
    (ShortLink as any)._store.findOneValue = existing; // set mock findOne return value

    const result = await ShortLinkService.getOrCreateForEvent(eventId, userId);
    expect(result.created).toBe(false);
    expect(result.shortLink.key).toBe(existing.key);
    expect(result.shortLink.eventId).toBe(existing.eventId);
  });

  it("creates a new short link when none exists", async () => {
    (Event.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEvent()),
    });
    (ShortLink as any)._store.findOneValue = null; // no existing link
    const keySpy = vi
      .spyOn(keyUtil, "generateUniqueShortKey")
      .mockResolvedValue("NEWKEY");
    const createdDoc = {
      key: "NEWKEY",
      eventId,
      targetSlug: "my-event",
      expiresAt: new Date(),
      _id: new Types.ObjectId(),
    };
    (ShortLink.create as any).mockResolvedValue(createdDoc);

    const result = await ShortLinkService.getOrCreateForEvent(eventId, userId);
    expect(result.created).toBe(true);
    expect(result.shortLink.key).toBe(createdDoc.key);
    expect(result.shortLink.targetSlug).toBe(createdDoc.targetSlug);
    expect(keySpy).toHaveBeenCalled();
  });

  it("rejects if event not published", async () => {
    (Event.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEvent({ publish: false })),
    });
    await expect(
      ShortLinkService.getOrCreateForEvent(eventId, userId)
    ).rejects.toThrow(/not published/i);
  });

  it("rejects if event has no public roles", async () => {
    (Event.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue(mockEvent({ roles: [] })),
    });
    await expect(
      ShortLinkService.getOrCreateForEvent(eventId, userId)
    ).rejects.toThrow(/no public roles/i);
  });

  it("resolveKey returns active when key found & valid", async () => {
    (ShortLink.getActiveByKey as any).mockResolvedValue({
      targetSlug: "my-event",
      eventId: new Types.ObjectId(eventId),
    });
    const result = await ShortLinkService.resolveKey("abc");
    expect(result.status).toBe("active");
    if (result.status === "active") {
      expect(result.slug).toBe("my-event");
    }
  });

  it("resolveKey returns expired when previously existed but invalid now", async () => {
    (ShortLink.getActiveByKey as any).mockResolvedValue(null);
    (ShortLink as any)._store.findOneValue = {
      key: "abc",
      isExpired: true,
    };
    const result = await ShortLinkService.resolveKey("abc");
    expect(result.status).toBe("expired");
  });

  it("resolveKey returns not_found when unknown", async () => {
    (ShortLink.getActiveByKey as any).mockResolvedValue(null);
    (ShortLink as any)._store.findOneValue = null; // ensure not found for 404 path
    const result = await ShortLinkService.resolveKey("zzz");
    expect(result.status).toBe("not_found");
  });

  it("expireAllForEvent executes updateMany", async () => {
    (ShortLink.updateMany as any).mockResolvedValue({ modifiedCount: 3 });
    const count = await ShortLinkService.expireAllForEvent(eventId);
    expect(count).toBe(3);
  });
});
