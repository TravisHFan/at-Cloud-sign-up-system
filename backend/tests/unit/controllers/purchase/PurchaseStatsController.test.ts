import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseStatsController from "../../../../src/controllers/purchase/PurchaseStatsController";
import Purchase from "../../../../src/models/Purchase";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");

describe("PurchaseStatsController", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup response mocks
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      user: undefined,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console methods
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getPaymentStats", () => {
    const userId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 403 if user is not admin (Member)", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Only Super Admin and Administrator can access this.",
      });
    });

    it("should return 403 if user is Leader", async () => {
      mockReq.user = {
        _id: userId,
        role: "Leader",
      };

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should allow Super Admin to access stats", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockCompletedPurchases = [
        { finalPrice: 10000 },
        { finalPrice: 15000 },
      ];

      vi.mocked(Purchase.find).mockResolvedValue(mockCompletedPurchases as any);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 2 },
        { _id: "pending", count: 1 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(2);
      vi.mocked(Purchase.distinct).mockResolvedValue([userId] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should allow Administrator to access stats", async () => {
      mockReq.user = {
        _id: userId,
        role: "Administrator",
      };

      const mockCompletedPurchases = [{ finalPrice: 10000 }];

      vi.mocked(Purchase.find).mockResolvedValue(mockCompletedPurchases as any);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 1 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(1);
      vi.mocked(Purchase.distinct).mockResolvedValue([userId] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should calculate total revenue from completed purchases", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockCompletedPurchases = [
        { finalPrice: 10000 }, // $100.00
        { finalPrice: 15000 }, // $150.00
        { finalPrice: 5000 }, // $50.00
      ];

      vi.mocked(Purchase.find).mockResolvedValue(mockCompletedPurchases as any);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 3 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.totalRevenue).toBe(30000); // $300.00 in cents
    });

    it("should return status counts from aggregate", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockImplementation((async (
        pipeline: any
      ) => {
        // First call: status counts
        if (pipeline[0].$group && pipeline[0].$group._id === "$status") {
          return [
            { _id: "completed", count: 50 },
            { _id: "pending", count: 10 },
            { _id: "failed", count: 5 },
            { _id: "refunded", count: 2 },
          ];
        }
        // Second call: recent revenue
        return [{ _id: null, total: 5000 }];
      }) as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.totalPurchases).toBe(50);
      expect(response.data.stats.pendingPurchases).toBe(10);
      expect(response.data.stats.failedPurchases).toBe(5);
      expect(response.data.stats.refundedPurchases).toBe(2);
    });

    it("should handle missing status in aggregate", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 5 },
        // No pending, failed, or refunded
      ] as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.totalPurchases).toBe(5);
      expect(response.data.stats.pendingPurchases).toBe(0);
      expect(response.data.stats.failedPurchases).toBe(0);
      expect(response.data.stats.refundedPurchases).toBe(0);
    });

    it("should count recent purchases (last 30 days)", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 0 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockImplementation(((query?: any) => {
        if (query && query.purchaseDate) {
          return Promise.resolve(15); // Recent purchases
        }
        return Promise.resolve(0);
      }) as any);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.last30Days.purchases).toBe(15);
    });

    it("should calculate recent revenue (last 30 days)", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockImplementation((async (
        pipeline: any
      ) => {
        // First call: status counts
        if (pipeline[0].$group && pipeline[0].$group._id === "$status") {
          return [{ _id: "completed", count: 0 }];
        }
        // Second call: recent revenue
        if (pipeline[0].$match && pipeline[0].$match.purchaseDate) {
          return [{ _id: null, total: 8000 }];
        }
        return [];
      }) as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.last30Days.revenue).toBe(8000);
    });

    it("should handle empty recent revenue aggregate", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockImplementation((async (
        pipeline: any
      ) => {
        // First call: status counts
        if (pipeline[0].$group && pipeline[0].$group._id === "$status") {
          return [{ _id: "completed", count: 0 }];
        }
        // Second call: recent revenue (empty)
        return [];
      }) as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.last30Days.revenue).toBe(0);
    });

    it("should count unique buyers", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const uniqueUserIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 0 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(0);
      vi.mocked(Purchase.distinct).mockResolvedValue(uniqueUserIds as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.distinct).toHaveBeenCalledWith("userId", {
        status: "completed",
      });

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.uniqueBuyers).toBe(3);
    });

    it("should count Class Rep purchases", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 0 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockImplementation(((query?: any) => {
        if (query && query.isClassRep === true) {
          return Promise.resolve(12); // Class Rep purchases
        }
        if (query && query.promoCode) {
          return Promise.resolve(0);
        }
        return Promise.resolve(0);
      }) as any);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.classRepPurchases).toBe(12);
    });

    it("should count promo code usage", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([]);
      vi.mocked(Purchase.aggregate).mockResolvedValue([
        { _id: "completed", count: 0 },
      ] as any);
      vi.mocked(Purchase.countDocuments).mockImplementation(((query?: any) => {
        if (query && query.promoCode) {
          return Promise.resolve(25); // Promo code usage
        }
        return Promise.resolve(0);
      }) as any);
      vi.mocked(Purchase.distinct).mockResolvedValue([] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.stats.promoCodeUsage).toBe(25);
    });

    it("should return complete stats structure", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockResolvedValue([
        { finalPrice: 10000 },
      ] as any);
      vi.mocked(Purchase.aggregate).mockImplementation((async (
        pipeline: any
      ) => {
        if (pipeline[0].$group && pipeline[0].$group._id === "$status") {
          return [{ _id: "completed", count: 10 }];
        }
        return [{ _id: null, total: 5000 }];
      }) as any);
      vi.mocked(Purchase.countDocuments).mockResolvedValue(5);
      vi.mocked(Purchase.distinct).mockResolvedValue([userId] as any);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response).toEqual({
        success: true,
        data: {
          stats: {
            totalRevenue: expect.any(Number),
            totalPurchases: expect.any(Number),
            pendingPurchases: expect.any(Number),
            failedPurchases: expect.any(Number),
            refundedPurchases: expect.any(Number),
            uniqueBuyers: expect.any(Number),
            classRepPurchases: expect.any(Number),
            promoCodeUsage: expect.any(Number),
            last30Days: {
              purchases: expect.any(Number),
              revenue: expect.any(Number),
            },
          },
        },
      });
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const dbError = new Error("Database connection failed");
      vi.mocked(Purchase.find).mockRejectedValue(dbError);

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching payment stats:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch payment statistics.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      vi.mocked(Purchase.find).mockRejectedValue("Unexpected string error");

      await PurchaseStatsController.getPaymentStats(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching payment stats:",
        "Unexpected string error"
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch payment statistics.",
      });
    });
  });
});
