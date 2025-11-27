import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseHistoryController from "../../../../src/controllers/purchase/PurchaseHistoryController";
import Purchase from "../../../../src/models/Purchase";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");

/**
 * Helper to create mock chain for Purchase.find().populate().populate().sort()
 */
function mockPurchaseFindChain(purchases: any[]) {
  return {
    populate: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(purchases),
      }),
    }),
  } as any;
}

describe("PurchaseHistoryController", () => {
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

  describe("getMyPurchases", () => {
    const userId = new mongoose.Types.ObjectId();
    const programId1 = new mongoose.Types.ObjectId();
    const programId2 = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return empty array when user has no purchases", async () => {
      mockReq.user = {
        _id: userId,
      };

      const mockPurchases: any[] = [];

      vi.mocked(Purchase.find).mockReturnValue(
        mockPurchaseFindChain(mockPurchases)
      );

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.find).toHaveBeenCalledWith({
        userId: userId,
        status: {
          $in: ["completed", "refund_processing", "refund_failed", "refunded"],
        },
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it("should return user's completed purchases", async () => {
      mockReq.user = {
        _id: userId,
      };

      const purchaseDate1 = new Date("2024-01-15");
      const purchaseDate2 = new Date("2024-02-20");

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: {
            _id: programId2,
            title: "Program B",
            programType: "Webinar",
          },
          status: {
            $in: [
              "completed",
              "refund_processing",
              "refund_failed",
              "refunded",
            ],
          },
          purchaseDate: purchaseDate2,
          finalPrice: 150,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: {
            _id: programId1,
            title: "Program A",
            programType: "Workshop",
          },
          status: {
            $in: [
              "completed",
              "refund_processing",
              "refund_failed",
              "refunded",
            ],
          },
          purchaseDate: purchaseDate1,
          finalPrice: 100,
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue(
        mockPurchaseFindChain(mockPurchases)
      );

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchases,
      });
    });

    it("should filter by completed status only", async () => {
      mockReq.user = {
        _id: userId,
      };

      const findMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      vi.mocked(Purchase.find).mockImplementation(findMock);

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(findMock).toHaveBeenCalledWith({
        userId: userId,
        status: {
          $in: ["completed", "refund_processing", "refund_failed", "refunded"],
        },
      });
    });

    it("should populate programId with title and programType", async () => {
      mockReq.user = {
        _id: userId,
      };

      const populateMock2 = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });
      const populateMock = vi.fn().mockReturnValue({
        populate: populateMock2,
      });

      vi.mocked(Purchase.find).mockReturnValue({
        populate: populateMock,
      } as any);

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(populateMock).toHaveBeenCalledWith(
        "programId",
        "title programType"
      );
    });

    it("should sort by purchaseDate descending", async () => {
      mockReq.user = {
        _id: userId,
      };

      const sortMock = vi.fn().mockResolvedValue([]);

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: sortMock,
          }),
        }),
      } as any);

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(sortMock).toHaveBeenCalledWith({ purchaseDate: -1 });
    });

    it("should return purchases in correct order (newest first)", async () => {
      mockReq.user = {
        _id: userId,
      };

      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-12-01");

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          programId: {
            _id: programId2,
            title: "Newer Purchase",
            programType: "Webinar",
          },
          purchaseDate: newDate,
          status: {
            $in: [
              "completed",
              "refund_processing",
              "refund_failed",
              "refunded",
            ],
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          programId: {
            _id: programId1,
            title: "Older Purchase",
            programType: "Workshop",
          },
          purchaseDate: oldDate,
          status: {
            $in: [
              "completed",
              "refund_processing",
              "refund_failed",
              "refunded",
            ],
          },
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue(
        mockPurchaseFindChain(mockPurchases)
      );

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data[0].programId.title).toBe("Newer Purchase");
      expect(response.data[1].programId.title).toBe("Older Purchase");
    });

    it("should handle purchases with missing programId", async () => {
      mockReq.user = {
        _id: userId,
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: null,
          status: {
            $in: [
              "completed",
              "refund_processing",
              "refund_failed",
              "refunded",
            ],
          },
          purchaseDate: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue(
        mockPurchaseFindChain(mockPurchases)
      );

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchases,
      });
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
      };

      const dbError = new Error("Database connection failed");

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockRejectedValue(dbError),
          }),
        }),
      } as any);

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching purchases:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch purchase history.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockRejectedValue("Unexpected string error"),
          }),
        }),
      } as any);

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching purchases:",
        "Unexpected string error"
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch purchase history.",
      });
    });

    it("should handle userId as ObjectId instance", async () => {
      const objectIdUserId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: objectIdUserId,
      };

      const findMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      vi.mocked(Purchase.find).mockImplementation(findMock);

      await PurchaseHistoryController.getMyPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(findMock).toHaveBeenCalledWith({
        userId: objectIdUserId,
        status: {
          $in: ["completed", "refund_processing", "refund_failed", "refunded"],
        },
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
