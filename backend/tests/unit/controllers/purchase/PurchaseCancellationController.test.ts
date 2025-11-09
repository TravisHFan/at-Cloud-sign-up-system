import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseCancellationController from "../../../../src/controllers/purchase/PurchaseCancellationController";
import { Purchase, Program } from "../../../../src/models";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Purchase: {
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  Program: {
    findByIdAndUpdate: vi.fn(),
  },
}));

describe("PurchaseCancellationController", () => {
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
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("cancelPendingPurchase", () => {
    const userId = new mongoose.Types.ObjectId();
    const purchaseId = new mongoose.Types.ObjectId();
    const programId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: purchaseId.toString() };

      await PurchaseCancellationController.cancelPendingPurchase(
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
      };
      mockReq.params = { id: "invalid-id" };

      await PurchaseCancellationController.cancelPendingPurchase(
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
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockResolvedValue(null);

      await PurchaseCancellationController.cancelPendingPurchase(
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

    it("should return 403 if user is not purchase owner", async () => {
      const otherUserId = new mongoose.Types.ObjectId();

      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: otherUserId,
        status: "pending",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You can only cancel your own purchases.",
      });
    });

    it("should return 400 if purchase is already completed", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Cannot cancel a completed purchase. Only pending purchases can be cancelled.",
      });
    });

    it("should return 400 if purchase is failed", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        status: "failed",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Cannot cancel a failed purchase. Only pending purchases can be cancelled.",
      });
    });

    it("should return 400 if purchase is cancelled", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        status: "cancelled",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Cannot cancel a cancelled purchase. Only pending purchases can be cancelled.",
      });
    });

    it("should successfully cancel pending purchase without Class Rep", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId,
        status: "pending",
        isClassRep: false,
        orderNumber: "ORDER-001",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);
      vi.mocked(Purchase.findByIdAndDelete).mockResolvedValue(
        mockPurchase as any
      );

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findByIdAndDelete).toHaveBeenCalledWith(
        purchaseId.toString()
      );
      expect(Program.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Cancelled pending purchase ORDER-001"
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Pending purchase cancelled successfully.",
      });
    });

    it("should decrement classRepCount when cancelling Class Rep purchase", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId,
        status: "pending",
        isClassRep: true,
        orderNumber: "ORDER-002",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);
      vi.mocked(Purchase.findByIdAndDelete).mockResolvedValue(
        mockPurchase as any
      );
      vi.mocked(Program.findByIdAndUpdate).mockResolvedValue({} as any);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(Program.findByIdAndUpdate).toHaveBeenCalledWith(
        programId,
        { $inc: { classRepCount: -1 } },
        { runValidators: false }
      );
      expect(console.log).toHaveBeenCalledWith(
        `Decremented classRepCount for program ${programId}`
      );
      expect(Purchase.findByIdAndDelete).toHaveBeenCalledWith(
        purchaseId.toString()
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle userId as ObjectId instance", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: userId, // Direct ObjectId, not string
        status: "pending",
        isClassRep: false,
        orderNumber: "ORDER-003",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);
      vi.mocked(Purchase.findByIdAndDelete).mockResolvedValue(
        mockPurchase as any
      );

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findByIdAndDelete).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle database error on findById", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const dbError = new Error("Database connection failed");
      vi.mocked(Purchase.findById).mockRejectedValue(dbError);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error cancelling purchase:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to cancel purchase.",
      });
    });

    it("should handle database error on delete", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        status: "pending",
        isClassRep: false,
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);

      const deleteError = new Error("Delete operation failed");
      vi.mocked(Purchase.findByIdAndDelete).mockRejectedValue(deleteError);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error cancelling purchase:",
        deleteError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to cancel purchase.",
      });
    });

    it("should handle database error on classRepCount decrement", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        programId,
        status: "pending",
        isClassRep: true,
        orderNumber: "ORDER-004",
      };

      vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);

      const updateError = new Error("Update operation failed");
      vi.mocked(Program.findByIdAndUpdate).mockRejectedValue(updateError);

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error cancelling purchase:",
        updateError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to cancel purchase.",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockRejectedValue("Unexpected string error");

      await PurchaseCancellationController.cancelPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error cancelling purchase:",
        "Unexpected string error"
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to cancel purchase.",
      });
    });
  });
});
