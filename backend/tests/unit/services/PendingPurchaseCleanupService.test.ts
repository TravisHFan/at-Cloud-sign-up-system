import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PendingPurchaseCleanupService } from "../../../src/services/PendingPurchaseCleanupService";
import Purchase from "../../../src/models/Purchase";

// Mock the Purchase model
vi.mock("../../../src/models/Purchase", () => ({
  default: {
    deleteMany: vi.fn(),
  },
}));

describe("PendingPurchaseCleanupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("retention constants", () => {
    it("should have a pending retention period of 15 days", () => {
      expect(PendingPurchaseCleanupService.PENDING_RETENTION_DAYS).toBe(15);
    });

    it("should have a refunded retention period of 30 days", () => {
      expect(PendingPurchaseCleanupService.REFUNDED_RETENTION_DAYS).toBe(30);
    });
  });

  describe("deleteOldPendingPurchases", () => {
    it("should delete pending purchases older than 15 days by default", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      mockDeleteMany.mockResolvedValue({ deletedCount: 5 } as never);

      const result =
        await PendingPurchaseCleanupService.deleteOldPendingPurchases();

      expect(result).toBe(5);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);

      // Verify the query structure
      const query = mockDeleteMany.mock.calls[0][0] as {
        status: string;
        createdAt: { $lt: Date };
      };
      expect(query.status).toBe("pending");
      expect(query.createdAt.$lt).toBeInstanceOf(Date);

      // Verify the cutoff date is approximately 15 days ago
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const queryCutoff = query.createdAt.$lt;
      const timeDiff = Math.abs(
        queryCutoff.getTime() - fifteenDaysAgo.getTime()
      );
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it("should accept custom retention days", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      mockDeleteMany.mockResolvedValue({ deletedCount: 3 } as never);

      const result =
        await PendingPurchaseCleanupService.deleteOldPendingPurchases(7);

      expect(result).toBe(3);

      // Verify the cutoff date is approximately 7 days ago
      const query = mockDeleteMany.mock.calls[0][0] as {
        createdAt: { $lt: Date };
      };
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const queryCutoff = query.createdAt.$lt;
      const timeDiff = Math.abs(queryCutoff.getTime() - sevenDaysAgo.getTime());
      expect(timeDiff).toBeLessThan(1000);
    });

    it("should return 0 when deletedCount is undefined", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      mockDeleteMany.mockResolvedValue({} as never);

      const result =
        await PendingPurchaseCleanupService.deleteOldPendingPurchases();

      expect(result).toBe(0);
    });
  });

  describe("deleteOldRefundedPurchases", () => {
    it("should delete refunded purchases older than 30 days by default", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      mockDeleteMany.mockResolvedValue({ deletedCount: 2 } as never);

      const result =
        await PendingPurchaseCleanupService.deleteOldRefundedPurchases();

      expect(result).toBe(2);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);

      const query = mockDeleteMany.mock.calls[0][0] as {
        status: string;
        createdAt: { $lt: Date };
      };
      expect(query.status).toBe("refunded");
      expect(query.createdAt.$lt).toBeInstanceOf(Date);

      // Verify the cutoff date is approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const queryCutoff = query.createdAt.$lt;
      const timeDiff = Math.abs(
        queryCutoff.getTime() - thirtyDaysAgo.getTime()
      );
      expect(timeDiff).toBeLessThan(1000);
    });

    it("should accept custom retention days for refunded", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      mockDeleteMany.mockResolvedValue({ deletedCount: 1 } as never);

      const result =
        await PendingPurchaseCleanupService.deleteOldRefundedPurchases(14);

      expect(result).toBe(1);

      const query = mockDeleteMany.mock.calls[0][0] as {
        createdAt: { $lt: Date };
      };
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const queryCutoff = query.createdAt.$lt;
      const timeDiff = Math.abs(
        queryCutoff.getTime() - fourteenDaysAgo.getTime()
      );
      expect(timeDiff).toBeLessThan(1000);
    });

    it("should return 0 when deletedCount is undefined for refunded", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      mockDeleteMany.mockResolvedValue({} as never);

      const result =
        await PendingPurchaseCleanupService.deleteOldRefundedPurchases();

      expect(result).toBe(0);
    });
  });

  describe("runCleanup", () => {
    it("should return cleanup stats for both pending and refunded", async () => {
      const mockDeleteMany = vi.mocked(Purchase.deleteMany);
      // First call (pending), second call (refunded)
      mockDeleteMany
        .mockResolvedValueOnce({ deletedCount: 10 } as never)
        .mockResolvedValueOnce({ deletedCount: 5 } as never);

      const result = await PendingPurchaseCleanupService.runCleanup();

      expect(result).toEqual({ pendingDeleted: 10, refundedDeleted: 5 });
      expect(mockDeleteMany).toHaveBeenCalledTimes(2);
    });
  });
});
