/**
 * PromoCodeCleanupService Unit Tests
 *
 * Tests the promo code cleanup functionality:
 * - Delete old used codes (7+ days after use)
 * - Delete old expired codes (30+ days after expiration)
 * - Run all cleanup tasks together
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../../src/models", () => ({
  PromoCode: {
    deleteMany: vi.fn(),
  },
}));

import { PromoCodeCleanupService } from "../../../src/services/promoCodeCleanupService";
import { PromoCode } from "../../../src/models";

describe("PromoCodeCleanupService - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteOldUsedCodes", () => {
    it("should delete used promo codes older than 7 days", async () => {
      vi.mocked(PromoCode.deleteMany).mockResolvedValueOnce({
        deletedCount: 5,
        acknowledged: true,
      });

      const result = await PromoCodeCleanupService.deleteOldUsedCodes();

      expect(result).toBe(5);
      expect(PromoCode.deleteMany).toHaveBeenCalledWith({
        isUsed: true,
        usedAt: { $lt: expect.any(Date) },
      });

      // Verify the date is approximately 7 days ago
      const call = vi.mocked(PromoCode.deleteMany).mock.calls[0][0] as {
        usedAt: { $lt: Date };
      };
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const diff = Math.abs(call.usedAt.$lt.getTime() - sevenDaysAgo.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it("should return 0 if no codes were deleted", async () => {
      vi.mocked(PromoCode.deleteMany).mockResolvedValueOnce({
        deletedCount: 0,
        acknowledged: true,
      });

      const result = await PromoCodeCleanupService.deleteOldUsedCodes();

      expect(result).toBe(0);
    });

    it("should return 0 if deletedCount is undefined", async () => {
      vi.mocked(PromoCode.deleteMany).mockResolvedValueOnce({
        acknowledged: true,
      } as any);

      const result = await PromoCodeCleanupService.deleteOldUsedCodes();

      expect(result).toBe(0);
    });
  });

  describe("deleteOldExpiredCodes", () => {
    it("should delete expired promo codes older than 30 days", async () => {
      vi.mocked(PromoCode.deleteMany).mockResolvedValueOnce({
        deletedCount: 10,
        acknowledged: true,
      });

      const result = await PromoCodeCleanupService.deleteOldExpiredCodes();

      expect(result).toBe(10);
      expect(PromoCode.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $exists: true, $lt: expect.any(Date) },
        isUsed: false,
      });

      // Verify the date is approximately 30 days ago
      const call = vi.mocked(PromoCode.deleteMany).mock.calls[0][0] as {
        expiresAt: { $exists: boolean; $lt: Date };
      };
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const diff = Math.abs(
        call.expiresAt.$lt.getTime() - thirtyDaysAgo.getTime()
      );
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it("should return 0 if no codes were deleted", async () => {
      vi.mocked(PromoCode.deleteMany).mockResolvedValueOnce({
        deletedCount: 0,
        acknowledged: true,
      });

      const result = await PromoCodeCleanupService.deleteOldExpiredCodes();

      expect(result).toBe(0);
    });

    it("should return 0 if deletedCount is undefined", async () => {
      vi.mocked(PromoCode.deleteMany).mockResolvedValueOnce({
        acknowledged: true,
      } as any);

      const result = await PromoCodeCleanupService.deleteOldExpiredCodes();

      expect(result).toBe(0);
    });
  });

  describe("runCleanup", () => {
    it("should run both cleanup tasks and return combined results", async () => {
      vi.mocked(PromoCode.deleteMany)
        .mockResolvedValueOnce({
          deletedCount: 3,
          acknowledged: true,
        })
        .mockResolvedValueOnce({
          deletedCount: 7,
          acknowledged: true,
        });

      const result = await PromoCodeCleanupService.runCleanup();

      expect(result).toEqual({
        deletedUsed: 3,
        deletedExpired: 7,
      });
      expect(PromoCode.deleteMany).toHaveBeenCalledTimes(2);
    });

    it("should handle zero deletions in both tasks", async () => {
      vi.mocked(PromoCode.deleteMany)
        .mockResolvedValueOnce({
          deletedCount: 0,
          acknowledged: true,
        })
        .mockResolvedValueOnce({
          deletedCount: 0,
          acknowledged: true,
        });

      const result = await PromoCodeCleanupService.runCleanup();

      expect(result).toEqual({
        deletedUsed: 0,
        deletedExpired: 0,
      });
    });

    it("should handle mixed results (used deleted but no expired)", async () => {
      vi.mocked(PromoCode.deleteMany)
        .mockResolvedValueOnce({
          deletedCount: 15,
          acknowledged: true,
        })
        .mockResolvedValueOnce({
          deletedCount: 0,
          acknowledged: true,
        });

      const result = await PromoCodeCleanupService.runCleanup();

      expect(result).toEqual({
        deletedUsed: 15,
        deletedExpired: 0,
      });
    });
  });
});
