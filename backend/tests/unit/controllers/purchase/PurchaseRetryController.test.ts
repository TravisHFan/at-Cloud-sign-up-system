import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseRetryController from "../../../../src/controllers/purchase/PurchaseRetryController";
import Purchase from "../../../../src/models/Purchase";
import * as stripeService from "../../../../src/services/stripeService";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");
vi.mock("../../../../src/services/stripeService");

/**
 * Helper to create mock chain for Purchase.findById().populate().populate()
 */
function mockPurchaseFindByIdChain(purchase: any) {
  return {
    populate: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue(purchase),
    }),
  } as any;
}

describe("PurchaseRetryController", () => {
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

  describe("retryPendingPurchase", () => {
    const userId = new mongoose.Types.ObjectId();
    const purchaseId = new mongoose.Types.ObjectId();
    const programId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: purchaseId.toString() };

      await PurchaseRetryController.retryPendingPurchase(
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
        email: "user@example.com",
      };
      mockReq.params = { id: "invalid-id" };

      await PurchaseRetryController.retryPendingPurchase(
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
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(null)
      );

      await PurchaseRetryController.retryPendingPurchase(
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
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId: otherUserId,
        status: "pending",
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPurchase)
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You can only retry your own purchases.",
      });
    });

    it("should return 400 if purchase is already completed", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPurchase)
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Cannot retry a completed purchase.",
      });
    });

    it("should return 400 if purchase is failed", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPurchase = {
        _id: purchaseId,
        userId,
        status: "failed",
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPurchase)
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Cannot retry a failed purchase.",
      });
    });

    it("should return 400 if user already has completed purchase for program", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPendingPurchase = {
        _id: purchaseId,
        userId,
        programId,
        purchaseType: "program",
        eventId: null,
        status: "pending",
      };

      const mockCompletedPurchase = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        programId,
        purchaseType: "program",
        status: "completed",
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPendingPurchase)
      );

      vi.mocked(Purchase.findOne).mockResolvedValue(
        mockCompletedPurchase as any
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.findOne).toHaveBeenCalledWith({
        userId: userId,
        programId: programId,
        status: "completed",
      });
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "You have already purchased this program. Check your purchase history.",
      });
    });

    it("should successfully retry pending purchase", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPendingPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
        },
        purchaseType: "program",
        eventId: null,
        status: "pending",
        orderNumber: "ORDER-001",
        fullPrice: 100,
        classRepDiscount: 10,
        earlyBirdDiscount: 5,
        finalPrice: 85,
        isClassRep: true,
        isEarlyBird: true,
        stripeSessionId: "old_session_id",
        save: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPendingPurchase)
      );

      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const mockSession = {
        id: "cs_new_session_123",
        url: "https://checkout.stripe.com/new_session",
      };

      vi.mocked(stripeService.createCheckoutSession).mockResolvedValue(
        mockSession as any
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith({
        userId: userId.toString(),
        userEmail: "user@example.com",
        programId: programId.toString(),
        programTitle: "Test Program",
        fullPrice: 100,
        classRepDiscount: 10,
        earlyBirdDiscount: 5,
        finalPrice: 85,
        isClassRep: true,
        isEarlyBird: true,
      });

      expect(mockPendingPurchase.stripeSessionId).toBe("cs_new_session_123");
      expect(mockPendingPurchase.save).toHaveBeenCalled();

      expect(console.log).toHaveBeenCalledWith(
        "Created new checkout session for pending purchase ORDER-001"
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          sessionId: "cs_new_session_123",
          sessionUrl: "https://checkout.stripe.com/new_session",
        },
      });
    });

    it("should handle retry without discounts", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPendingPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
        },
        purchaseType: "program",
        eventId: null,
        status: "pending",
        orderNumber: "ORDER-002",
        fullPrice: 100,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 100,
        isClassRep: false,
        isEarlyBird: false,
        save: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPendingPurchase)
      );

      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const mockSession = {
        id: "cs_session_no_discount",
        url: "https://checkout.stripe.com/session",
      };

      vi.mocked(stripeService.createCheckoutSession).mockResolvedValue(
        mockSession as any
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith({
        userId: userId.toString(),
        userEmail: "user@example.com",
        programId: programId.toString(),
        programTitle: "Test Program",
        fullPrice: 100,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 100,
        isClassRep: false,
        isEarlyBird: false,
      });

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle userId as ObjectId instance", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPendingPurchase = {
        _id: purchaseId,
        userId: userId, // Direct ObjectId
        programId: {
          _id: programId,
          title: "Test Program",
        },
        purchaseType: "program",
        eventId: null,
        status: "pending",
        orderNumber: "ORDER-003",
        fullPrice: 100,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 100,
        isClassRep: false,
        isEarlyBird: false,
        save: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPendingPurchase)
      );

      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const mockSession = {
        id: "cs_session",
        url: "https://checkout.stripe.com/session",
      };

      vi.mocked(stripeService.createCheckoutSession).mockResolvedValue(
        mockSession as any
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle database error on findById", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const dbError = new Error("Database connection failed");

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockRejectedValue(dbError),
        }),
      } as any);

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error retrying purchase:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retry purchase.",
        error: "Database connection failed",
      });
    });

    it("should handle Stripe API error", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const mockPendingPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
        },
        purchaseType: "program",
        eventId: null,
        status: "pending",
        fullPrice: 100,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 100,
        isClassRep: false,
        isEarlyBird: false,
        save: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPendingPurchase)
      );

      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const stripeError = new Error("Stripe API error");
      vi.mocked(stripeService.createCheckoutSession).mockRejectedValue(
        stripeError
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error retrying purchase:",
        stripeError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retry purchase.",
        error: "Stripe API error",
      });
    });

    it("should handle save error after creating session", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      const saveError = new Error("Save failed");

      const mockPendingPurchase = {
        _id: purchaseId,
        userId,
        programId: {
          _id: programId,
          title: "Test Program",
        },
        purchaseType: "program",
        eventId: null,
        status: "pending",
        fullPrice: 100,
        classRepDiscount: 0,
        earlyBirdDiscount: 0,
        finalPrice: 100,
        isClassRep: false,
        isEarlyBird: false,
        save: vi.fn().mockRejectedValue(saveError),
      };

      vi.mocked(Purchase.findById).mockReturnValue(
        mockPurchaseFindByIdChain(mockPendingPurchase)
      );

      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const mockSession = {
        id: "cs_session",
        url: "https://checkout.stripe.com/session",
      };

      vi.mocked(stripeService.createCheckoutSession).mockResolvedValue(
        mockSession as any
      );

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error retrying purchase:",
        saveError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retry purchase.",
        error: "Save failed",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
        email: "user@example.com",
      };
      mockReq.params = { id: purchaseId.toString() };

      vi.mocked(Purchase.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockRejectedValue("Unexpected string error"),
        }),
      } as any);

      await PurchaseRetryController.retryPendingPurchase(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error retrying purchase:",
        "Unexpected string error"
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
