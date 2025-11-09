import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchasePendingController from "../../../../src/controllers/purchase/PurchasePendingController";
import Purchase from "../../../../src/models/Purchase";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");

describe("PurchasePendingController", () => {
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
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getMyPendingPurchases", () => {
    const userId = new mongoose.Types.ObjectId();
    const programId1 = new mongoose.Types.ObjectId();
    const programId2 = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should delete expired pending purchases older than 24 hours", async () => {
      mockReq.user = {
        _id: userId,
      };

      const deleteManyMock = vi.fn().mockResolvedValue({ deletedCount: 3 });
      vi.mocked(Purchase.deleteMany).mockImplementation(deleteManyMock);

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      expect(deleteManyMock).toHaveBeenCalledWith({
        userId: userId,
        status: "pending",
        createdAt: { $lt: expect.any(Date) },
      });

      // Verify the date is approximately 24 hours ago (within 1 second tolerance)
      const callArgs = deleteManyMock.mock.calls[0][0];
      const timeDiff = Math.abs(
        callArgs.createdAt.$lt.getTime() - twentyFourHoursAgo.getTime()
      );
      expect(timeDiff).toBeLessThan(1000);

      expect(console.log).toHaveBeenCalledWith(
        `Auto-cleaned 3 expired pending purchases for user ${userId}`
      );
    });

    it("should not log if no expired purchases were deleted", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("Auto-cleaned")
      );
    });

    it("should return empty array when user has no pending purchases", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it("should return pending purchases without redundancy", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      const mockPendingPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: {
            _id: programId1,
            title: "Program A",
            programType: "Workshop",
          },
          status: "pending",
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: {
            _id: programId2,
            title: "Program B",
            programType: "Webinar",
          },
          status: "pending",
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(mockPendingPurchases),
        }),
      } as any);

      // Mock findOne to return null (no completed purchases)
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPendingPurchases,
      });
    });

    it("should detect and remove redundant pending purchases", async () => {
      mockReq.user = {
        _id: userId,
      };

      const redundantPurchaseId = new mongoose.Types.ObjectId();

      vi.mocked(Purchase.deleteMany).mockImplementation(((query: any) => {
        // First call: expired cleanup
        if (query.status === "pending" && query.createdAt) {
          return Promise.resolve({ deletedCount: 0 } as any);
        }
        // Second call: redundant cleanup
        if (query._id) {
          return Promise.resolve({ deletedCount: 1 } as any);
        }
        return Promise.resolve({ deletedCount: 0 } as any);
      }) as any);

      const mockPendingPurchases = [
        {
          _id: redundantPurchaseId,
          userId,
          programId: {
            _id: programId1,
            title: "Program A",
            programType: "Workshop",
          },
          status: "pending",
          createdAt: new Date(),
        },
      ];

      const mockUpdatedPurchases: any[] = [];

      let findCallCount = 0;
      vi.mocked(Purchase.find).mockImplementation(() => {
        findCallCount++;
        const result =
          findCallCount === 1 ? mockPendingPurchases : mockUpdatedPurchases;
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(result),
          }),
        } as any;
      });

      // Mock findOne to indicate program already completed
      vi.mocked(Purchase.findOne).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "completed",
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [redundantPurchaseId.toString()] },
      });

      expect(console.log).toHaveBeenCalledWith(
        `Auto-cleaned 1 redundant pending purchases (already purchased programs) for user ${userId}`
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedPurchases,
      });
    });

    it("should check each pending purchase for completed duplicates", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      const mockPendingPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: {
            _id: programId1,
            title: "Program A",
            programType: "Workshop",
          },
          status: "pending",
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          programId: {
            _id: programId2,
            title: "Program B",
            programType: "Webinar",
          },
          status: "pending",
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(mockPendingPurchases),
        }),
      } as any);

      const findOneMock = vi.fn().mockResolvedValue(null);
      vi.mocked(Purchase.findOne).mockImplementation(findOneMock);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(findOneMock).toHaveBeenCalledTimes(2);
      expect(findOneMock).toHaveBeenCalledWith({
        userId: userId,
        programId: programId1,
        status: "completed",
      });
      expect(findOneMock).toHaveBeenCalledWith({
        userId: userId,
        programId: programId2,
        status: "completed",
      });
    });

    it("should filter by user's pending purchases only", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      const findMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(Purchase.find).mockImplementation(findMock);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(findMock).toHaveBeenCalledWith({
        userId: userId,
        status: "pending",
      });
    });

    it("should populate programId with title and programType", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      const populateMock = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      vi.mocked(Purchase.find).mockReturnValue({
        populate: populateMock,
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(populateMock).toHaveBeenCalledWith(
        "programId",
        "title programType"
      );
    });

    it("should sort by createdAt descending", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      const sortMock = vi.fn().mockResolvedValue([]);

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: sortMock,
        }),
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it("should re-fetch after redundant cleanup", async () => {
      mockReq.user = {
        _id: userId,
      };

      const redundantId = new mongoose.Types.ObjectId();

      vi.mocked(Purchase.deleteMany).mockImplementation(((query: any) => {
        if (query._id) {
          return Promise.resolve({ deletedCount: 1 } as any);
        }
        return Promise.resolve({ deletedCount: 0 } as any);
      }) as any);

      const mockInitialPurchases = [
        {
          _id: redundantId,
          userId,
          programId: {
            _id: programId1,
            title: "Program A",
            programType: "Workshop",
          },
          status: "pending",
        },
      ];

      const mockUpdatedPurchases: any[] = [];

      let callCount = 0;
      const findMock = vi.fn().mockImplementation(() => {
        callCount++;
        const result =
          callCount === 1 ? mockInitialPurchases : mockUpdatedPurchases;
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(result),
          }),
        };
      });

      vi.mocked(Purchase.find).mockImplementation(findMock);
      vi.mocked(Purchase.findOne).mockResolvedValue({
        status: "completed",
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      // Should be called twice: once initially, once after redundant cleanup
      expect(findMock).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedPurchases,
      });
    });

    it("should handle database error on expired cleanup", async () => {
      mockReq.user = {
        _id: userId,
      };

      const dbError = new Error("Database connection failed");
      vi.mocked(Purchase.deleteMany).mockRejectedValue(dbError);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching pending purchases:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch pending purchases.",
      });
    });

    it("should handle database error on fetch", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockResolvedValue({
        deletedCount: 0,
      } as any);

      const fetchError = new Error("Fetch failed");
      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockRejectedValue(fetchError),
        }),
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching pending purchases:",
        fetchError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch pending purchases.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
      };

      vi.mocked(Purchase.deleteMany).mockRejectedValue(
        "Unexpected string error"
      );

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching pending purchases:",
        "Unexpected string error"
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch pending purchases.",
      });
    });

    it("should handle multiple redundant purchases", async () => {
      mockReq.user = {
        _id: userId,
      };

      const redundantId1 = new mongoose.Types.ObjectId();
      const redundantId2 = new mongoose.Types.ObjectId();

      vi.mocked(Purchase.deleteMany).mockImplementation(((query: any) => {
        if (query._id) {
          return Promise.resolve({ deletedCount: 2 } as any);
        }
        return Promise.resolve({ deletedCount: 0 } as any);
      }) as any);

      const mockPendingPurchases = [
        {
          _id: redundantId1,
          userId,
          programId: {
            _id: programId1,
            title: "Program A",
            programType: "Workshop",
          },
          status: "pending",
        },
        {
          _id: redundantId2,
          userId,
          programId: {
            _id: programId2,
            title: "Program B",
            programType: "Webinar",
          },
          status: "pending",
        },
      ];

      let findCallCount = 0;
      vi.mocked(Purchase.find).mockImplementation(() => {
        findCallCount++;
        const result = findCallCount === 1 ? mockPendingPurchases : [];
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(result),
          }),
        } as any;
      });

      // Both programs already completed
      vi.mocked(Purchase.findOne).mockResolvedValue({
        status: "completed",
      } as any);

      await PurchasePendingController.getMyPendingPurchases(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [redundantId1.toString(), redundantId2.toString()] },
      });

      expect(console.log).toHaveBeenCalledWith(
        `Auto-cleaned 2 redundant pending purchases (already purchased programs) for user ${userId}`
      );
    });
  });
});
