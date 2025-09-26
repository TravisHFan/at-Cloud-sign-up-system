import { describe, it, expect, vi } from "vitest";
import * as keyUtil from "../../../src/utils/shortLinkKey";
import ShortLink from "../../../src/models/ShortLink";

vi.mock("../../../src/models/ShortLink", () => {
  const store: { value?: any } = {};
  return {
    __esModule: true,
    default: {
      _store: store,
      findOne: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockImplementation(() => Promise.resolve(store.value)),
      })),
    },
  };
});

describe("shortLinkKey util", () => {
  it("generates base62 keys within default length bounds", async () => {
    (ShortLink as any)._store.value = null;
    const key = await keyUtil.generateUniqueShortKey();
    expect(key).toMatch(/^[0-9A-Za-z]{6,8}$/);
  });

  it("honors custom min/max length", async () => {
    (ShortLink as any)._store.value = null;
    const key = await keyUtil.generateUniqueShortKey({
      minLength: 9,
      maxLength: 10,
    });
    expect(key.length === 9 || key.length === 10).toBe(true);
  });

  it("retries on collision until a unique key is found", async () => {
    // Simulate two collisions then success (exists, exists, null)
    const firstDoc = { key: "DUP" };
    const sequence = [firstDoc, firstDoc, null];
    let idx = 0;
    (ShortLink as any).findOne = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockImplementation(() => Promise.resolve(sequence[idx++])),
    }));
    const key = await keyUtil.generateUniqueShortKey({
      minLength: 6,
      maxLength: 6,
    });
    expect(keyUtil.isBase62(key)).toBe(true);
    expect(key.length).toBe(6);
    expect((ShortLink.findOne as any).mock.calls.length).toBe(3);
  });

  it("throws after exceeding retry limit", async () => {
    // Always return an existing doc so collisions never resolve
    (ShortLink as any).findOne = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "existing" }),
    }));
    await expect(
      keyUtil.generateUniqueShortKey({
        minLength: 6,
        maxLength: 6,
        maxCollisionRetries: 2,
      })
    ).rejects.toThrow(/Failed to generate unique short link key/);
    expect((ShortLink.findOne as any).mock.calls.length).toBeGreaterThan(2);
  });

  it("validates base62 strings", () => {
    expect(keyUtil.isBase62("abcDEF123")).toBe(true);
    expect(keyUtil.isBase62("abc-123")).toBe(false);
  });
});
