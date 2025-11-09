import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseReceiptController from "../../../../src/controllers/purchase/PurchaseReceiptController";
import Purchase from "../../../../src/models/Purchase";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");

describe("PurchaseReceiptController", () => {
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
      params: {},
      user: undefined,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("getPurchaseReceipt", () => {
    const userId = new mongoose.Types.ObjectId();
    const purchaseId = new mongoose.Types.ObjectId();
    const programId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: purchaseId.toString() };

      await PurchaseReceiptController.getPurchaseReceipt(
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
      mockReq.params = { id: "invalid_id" };

      await PurchaseReceiptController.getPurchaseReceipt(
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
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Purchase not found.",
      });
    });

    it("should return 403 if user is not owner and not admin", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: otherUserId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId,
        programId,
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied.",
      });
    });

    it("should return 400 if purchase status is not completed", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId,
        programId,
        status: "pending",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Receipt is only available for completed purchases.",
      });
    });

    it("should allow purchase owner to view their receipt", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId,
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
          hostedBy: "Test Org",
        },
        status: "completed",
        orderNumber: "ORDER-001",
        finalPrice: 100,
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should allow Super Admin to view any receipt", async () => {
      const adminId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: adminId,
        role: "Super Admin",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId, // Different from admin's ID
        programId: {
          _id: programId,
          title: "Test Program",
          programType: "Workshop",
        },
        status: "completed",
        orderNumber: "ORDER-002",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should allow Administrator to view any receipt", async () => {
      const adminId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: adminId,
        role: "Administrator",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId, // Different from admin's ID
        programId,
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle userId as populated object with _id", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: {
          _id: userId,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
        programId: {
          _id: programId,
          title: "Test Program",
        },
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockPurchase,
      });
    });

    it("should handle userId as ObjectId directly", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId, // Direct ObjectId
        programId,
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should populate programId and userId fields", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId,
        status: "completed",
      };

      const populateProgramMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPurchase),
      });

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: populateProgramMock,
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findById).toHaveBeenCalledWith(purchaseId.toString());
      expect(populateProgramMock).toHaveBeenCalledWith(
        "programId",
        "title programType hostedBy"
      );
      expect(populateProgramMock().populate).toHaveBeenCalledWith(
        "userId",
        "firstName lastName email"
      );
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const dbError = new Error("Database connection failed");

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockRejectedValue(dbError),
        }),
      } as any);

      // Mock console.error to avoid noise
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching receipt:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch receipt.",
      });

      consoleErrorSpy.mockRestore();
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockRejectedValue("Unexpected error"),
        }),
      } as any);

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch receipt.",
      });

      consoleErrorSpy.mockRestore();
    });

    it("should deny access to Leader role (not owner, not admin)", async () => {
      const leaderId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: leaderId,
        role: "Leader",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId, // Different from leader's ID
        programId,
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Access denied.",
      });
    });

    it("should return 400 for failed status", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId,
        programId,
        status: "failed",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Receipt is only available for completed purchases.",
      });
    });

    it("should return 400 for cancelled status", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId,
        programId,
        status: "cancelled",
      };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        }),
      } as any);

      await PurchaseReceiptController.getPurchaseReceipt(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Receipt is only available for completed purchases.",
      });
    });
  });
});
