/**
 * ShortLink Key Utilities Unit Tests
 *
 * Tests short link key generation functions:
 * - randomBase62: Generate random base62 strings
 * - generateUniqueShortKey: Generate unique short keys with collision handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ShortLink model
vi.mock("../../../src/models/ShortLink", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

import {
  randomBase62,
  generateUniqueShortKey,
} from "../../../src/utils/shortLinkKey";
import ShortLink from "../../../src/models/ShortLink";

describe("shortLinkKey", () => {
  describe("randomBase62", () => {
    it("should generate string of specified length", () => {
      const result = randomBase62(6);
      expect(result.length).toBe(6);
    });

    it("should only contain base62 characters", () => {
      const base62Regex = /^[0-9A-Za-z]+$/;
      const result = randomBase62(10);
      expect(result).toMatch(base62Regex);
    });

    it("should generate different strings on each call", () => {
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        results.add(randomBase62(8));
      }
      // All 100 should be unique (with overwhelming probability)
      expect(results.size).toBe(100);
    });

    it("should generate various lengths correctly", () => {
      expect(randomBase62(1).length).toBe(1);
      expect(randomBase62(4).length).toBe(4);
      expect(randomBase62(8).length).toBe(8);
      expect(randomBase62(16).length).toBe(16);
    });
  });

  describe("generateUniqueShortKey", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should generate unique key when no collision", async () => {
      vi.mocked(ShortLink.findOne).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as ReturnType<typeof ShortLink.findOne>);

      const key = await generateUniqueShortKey();

      expect(key.length).toBeGreaterThanOrEqual(6);
      expect(key.length).toBeLessThanOrEqual(8);
      expect(ShortLink.findOne).toHaveBeenCalled();
    });

    it("should retry on collision and succeed", async () => {
      // First call: collision, second call: no collision
      const selectLeanMock = vi.fn();
      selectLeanMock
        .mockResolvedValueOnce({ _id: "existing" }) // collision
        .mockResolvedValueOnce(null); // success

      vi.mocked(ShortLink.findOne).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: selectLeanMock,
        }),
      } as unknown as ReturnType<typeof ShortLink.findOne>);

      const key = await generateUniqueShortKey();

      expect(key.length).toBeGreaterThanOrEqual(6);
      expect(selectLeanMock).toHaveBeenCalledTimes(2);
    });

    it("should throw after max collision retries", async () => {
      vi.mocked(ShortLink.findOne).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: "always-exists" }),
        }),
      } as unknown as ReturnType<typeof ShortLink.findOne>);

      await expect(
        generateUniqueShortKey({ maxCollisionRetries: 3 })
      ).rejects.toThrow(
        "Failed to generate unique short link key after retries"
      );
    });

    it("should respect custom length bounds", async () => {
      vi.mocked(ShortLink.findOne).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as ReturnType<typeof ShortLink.findOne>);

      const key = await generateUniqueShortKey({
        minLength: 10,
        maxLength: 10,
      });

      expect(key.length).toBe(10);
    });

    it("should throw for invalid length bounds (minLength < 4)", async () => {
      await expect(
        generateUniqueShortKey({ minLength: 3, maxLength: 6 })
      ).rejects.toThrow("Invalid key length bounds");
    });

    it("should throw for invalid length bounds (maxLength < minLength)", async () => {
      await expect(
        generateUniqueShortKey({ minLength: 8, maxLength: 6 })
      ).rejects.toThrow("Invalid key length bounds");
    });
  });
});
