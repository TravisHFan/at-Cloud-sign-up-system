import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseRetrievalController from "../../../../src/controllers/purchase/PurchaseRetrievalController";
import Purchase from "../../../../src/models/Purchase";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");

describe("PurchaseRetrievalController", () => {
  let mockReq: Partial<Request> & { user?: any; params?: any };
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
      params: {},
      user: undefined,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console methods
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getPurchaseById", () => {
    const userId = new mongoose.Types.ObjectId();
    const purchaseId = new mongoose.Types.ObjectId();
    const programId = new mongoose.Types.ObjectId();
    const mentorId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: purchaseId.toString() };

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 400 for invalid purchase ID", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: "invalid-id" };

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid purchase ID.",
      });
    });

    it("should return 404 if purchase not found", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findById).toHaveBeenCalledWith(purchaseId.toString());
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Purchase not found.",
      });
    });

    it("should allow owner to view their purchase", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should return 403 if user is not owner, admin, or mentor", async () => {
      const otherUserId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: otherUserId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied.",
      });
    });

    it("should allow Super Admin to view any purchase", async () => {
      const adminId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: adminId,
        role: "Super Admin",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId, // Different from admin
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should allow Administrator to view any purchase", async () => {
      const adminId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: adminId,
        role: "Administrator",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId, // Different from admin
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should allow program mentor to view purchase", async () => {
      mockReq.user = {
        _id: mentorId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId, // Different from mentor
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [
            {
              userId: mentorId,
              name: "Mentor Name",
            },
          ],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should deny access if user is not in mentors array", async () => {
      const nonMentorId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: nonMentorId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId, // Different from non-mentor
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [
            {
              userId: mentorId, // Different mentor
              name: "Another Mentor",
            },
          ],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied.",
      });
    });

    it("should deny Leader role access if not owner or mentor", async () => {
      const leaderId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: leaderId,
        role: "Leader",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId, // Different from leader
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied.",
      });
    });

    it("should handle program with no mentors array", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: undefined, // No mentors array
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should handle program with empty mentors array", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should populate programId with correct fields", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const populateMock = vi.fn().mockResolvedValue({
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
      });

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: populateMock,
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(populateMock).toHaveBeenCalledWith(
        "programId",
        "title programType hostedBy mentors"
      );
    });

    it("should handle userId as ObjectId instance", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId, // Direct ObjectId, not string
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const dbError = new Error("Database connection failed");

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockRejectedValue(dbError),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching purchase:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch purchase.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockRejectedValue("Unexpected string error"),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching purchase:",
        "Unexpected string error"
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch purchase.",
      });
    });

    it("should correctly compare mentor userId with string conversion", async () => {
      mockReq.user = {
        _id: mentorId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          mentors: [
            {
              userId: new mongoose.Types.ObjectId(mentorId.toString()),
              name: "Mentor Name",
            },
          ],
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      } as any);

      await PurchaseRetrievalController.getPurchaseById(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });
  });
});
