import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import PurchaseCheckoutController from "../../../../src/controllers/purchase/PurchaseCheckoutController";
import { Purchase, Program, PromoCode, User } from "../../../../src/models";
import { createCheckoutSession as stripeCreateCheckoutSession } from "../../../../src/services/stripeService";
import { lockService } from "../../../../src/services/LockService";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";

vi.mock("../../../../src/models");
vi.mock("../../../../src/services/stripeService");
vi.mock("../../../../src/services/LockService");
vi.mock("../../../../src/services/notifications/TrioNotificationService");

/**
 * PurchaseCheckoutController Unit Tests
 *
 * NOTE: This test suite covers the critical paths and error handling.
 * The following complex scenarios involving lock+promo code interactions
 * are better suited for integration tests:
 *
 * 1. Free purchase (100% off) - immediate completion without Stripe
 * 2. Admin notifications for general staff codes
 * 3. Pending purchase replacement (delete old + create new atomically)
 * 4. Class Rep discount with atomic spot reservation
 * 5. Bundle promo code (fixed dollar discount) pricing
 * 6. Staff promo code (percentage discount) pricing
 *
 * These scenarios involve complex state management within the lock service
 * that is difficult to mock accurately. Integration tests provide better
 * coverage for these workflows.
 */
describe("PurchaseCheckoutController", () => {
  let mockReq: Partial<Request> & { user?: any; body?: any };
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  const userId = new mongoose.Types.ObjectId();
  const programId = new mongoose.Types.ObjectId();
  const promoCodeId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn(() => mockRes) as any;
    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as any;
    mockReq = {
      body: {},
      user: undefined,
    };
    vi.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    // ===================
    // Authentication Tests
    // ===================
    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.body = { programId: programId.toString() };

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    // ===================
    // Validation Tests
    // ===================
    it("should return 400 if programId is missing", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {};

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid program ID.",
      });
    });

    it("should return 400 if programId is invalid ObjectId", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = { programId: "invalid" };

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid program ID.",
      });
    });

    it("should return 404 if program not found", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = { programId: programId.toString() };

      vi.mocked(Program.findById).mockResolvedValue(null);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Program not found.",
      });
    });

    it("should return 400 if program is free", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = { programId: programId.toString() };

      const mockProgram = {
        _id: programId,
        title: "Free Program",
        isFree: true,
        fullPriceTicket: 0,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This program is free and does not require purchase.",
      });
    });

    // ===================
    // Promo Code Validation Tests
    // ===================
    it("should return 400 if promo code not found", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        promoCode: "INVALID",
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(PromoCode.findOne).mockResolvedValue(null);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid promo code.",
      });
    });

    it("should return 400 if promo code not valid for program", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        promoCode: "TESTCODE",
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      const mockPromoCode = {
        _id: promoCodeId,
        code: "TESTCODE",
        canBeUsedForProgram: vi
          .fn()
          .mockReturnValue({ valid: false, reason: "Not applicable" }),
        isGeneral: false,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(PromoCode.findOne).mockResolvedValue(mockPromoCode as any);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Not applicable",
      });
    });

    it("should return 400 if personal promo code doesn't belong to user", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        promoCode: "PERSONAL",
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      const mockPromoCode = {
        _id: promoCodeId,
        code: "PERSONAL",
        canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        isGeneral: false,
        ownerId: otherUserId,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(PromoCode.findOne).mockResolvedValue(mockPromoCode as any);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This promo code does not belong to you.",
      });
    });

    it("should return 400 if staff code not valid for program", async () => {
      const otherProgramId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        promoCode: "STAFF10",
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      const mockPromoCode = {
        _id: promoCodeId,
        code: "STAFF10",
        type: "staff_access",
        canBeUsedForProgram: vi.fn().mockReturnValue({ valid: true }),
        isGeneral: true,
        allowedProgramIds: [otherProgramId],
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(PromoCode.findOne).mockResolvedValue(mockPromoCode as any);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This staff code is not valid for this program.",
      });
    });

    // ===================
    // Duplicate Purchase Check
    // ===================
    it("should return 400 if user already purchased program", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = { programId: programId.toString() };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      const mockExistingPurchase = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-001",
        status: "completed",
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(
        mockExistingPurchase as any
      );

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You have already purchased this program.",
      });
    });

    // ===================
    // Lock Service Tests
    // ===================
    it("should return 503 on lock timeout", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = { programId: programId.toString() };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null); // No existing purchase
      vi.mocked(lockService.withLock).mockRejectedValue(
        new Error("Lock timeout exceeded")
      );

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Purchase operation in progress, please wait and try again.",
      });
    });

    // ===================
    // Class Rep Spot Reservation Tests
    // ===================
    it("should return 400 if Class Rep slots full", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        isClassRep: true,
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
        classRepLimit: 5,
        classRepCount: 5,
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null); // No pending
      vi.mocked(Program.findOneAndUpdate).mockResolvedValue(null); // Failed to reserve

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Class Rep slots are full. Please proceed with standard pricing.",
      });
    });

    // ===================
    // Early Bird Expiration Tests
    // ===================
    it("should proceed without early bird discount if expired during checkout", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        isClassRep: false,
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
        earlyBirdDeadline: yesterday,
        earlyBirdDiscount: 1000,
      };

      const mockPurchase = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        programId,
        fullPrice: 10000,
        classRepDiscount: 0,
        earlyBirdDiscount: 0, // No early bird discount applied
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        status: "pending",
        orderNumber: "ORD-TEST-001",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(Purchase.create).mockResolvedValue(mockPurchase as any);
      vi.mocked(stripeCreateCheckoutSession).mockResolvedValue({
        id: "cs_test123",
        url: "https://checkout.stripe.com/test",
      } as any);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      // Should succeed with full price (no early bird discount)
      expect(statusMock).toHaveBeenCalledWith(200);
      const response = jsonMock.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.sessionUrl).toBe("https://checkout.stripe.com/test");

      // Verify purchase was created without early bird discount
      expect(Purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          earlyBirdDiscount: 0,
          isEarlyBird: false,
          finalPrice: 10000,
        })
      );
    });

    // ===================
    // Stripe Minimum Price Tests
    // ===================
    it("should return error if final price below Stripe minimum ($0.50)", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 40, // $0.40 - below minimum
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null); // No pending

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      const response = jsonMock.mock.calls[0][0];
      expect(response.message).toBe("Failed to create checkout session.");
      expect(response.error).toContain(
        "Stripe requires a minimum charge of $0.50"
      );
    });

    // ===================
    // Pricing Calculation Tests
    // ===================

    it("should calculate price with Early Bird discount (not Class Rep)", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
        isClassRep: false,
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
        earlyBirdDeadline: tomorrow,
        earlyBirdDiscount: 1500,
      };

      const mockPurchase = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-EB-001",
        status: "pending",
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockStripeSession = {
        id: "cs_session",
        url: "https://checkout.stripe.com",
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null); // No pending
      (Purchase as any).generateOrderNumber = vi
        .fn()
        .mockResolvedValue("ORD-EB-001");
      vi.mocked(Purchase.create).mockResolvedValue(mockPurchase as any);
      vi.mocked(stripeCreateCheckoutSession).mockResolvedValue(
        mockStripeSession as any
      );

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      // Verify Stripe called with Early Bird pricing (10000 - 1500 = 8500)
      expect(stripeCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          finalPrice: 8500,
          earlyBirdDiscount: 1500,
          isEarlyBird: true,
        })
      );
    });

    // ===================
    // Stripe Session Creation Tests
    // ===================
    it("should create Stripe session and return sessionId/url", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      const mockPurchase = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: "ORD-001",
        status: "pending",
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockStripeSession = {
        id: "cs_test_session",
        url: "https://checkout.stripe.com/session",
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null); // No pending
      (Purchase as any).generateOrderNumber = vi
        .fn()
        .mockResolvedValue("ORD-001");
      vi.mocked(Purchase.create).mockResolvedValue(mockPurchase as any);
      vi.mocked(stripeCreateCheckoutSession).mockResolvedValue(
        mockStripeSession as any
      );

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          sessionId: "cs_test_session",
          sessionUrl: "https://checkout.stripe.com/session",
          existing: false,
        },
      });
    });

    it("should cleanup purchase if Stripe session creation fails", async () => {
      const purchaseId = new mongoose.Types.ObjectId();
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
      };

      const mockProgram = {
        _id: programId,
        title: "Test Program",
        isFree: false,
        fullPriceTicket: 10000,
      };

      const mockPurchase = {
        _id: purchaseId,
        orderNumber: "ORD-FAIL-001",
        status: "pending",
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Program.findById).mockResolvedValue(mockProgram as any);
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockImplementation(async (key, fn) => {
        return fn();
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null); // No pending
      (Purchase as any).generateOrderNumber = vi
        .fn()
        .mockResolvedValue("ORD-FAIL-001");
      vi.mocked(Purchase.create).mockResolvedValue(mockPurchase as any);
      vi.mocked(stripeCreateCheckoutSession).mockRejectedValue(
        new Error("Stripe API error")
      );
      vi.mocked(Purchase.deleteOne).mockResolvedValue({
        deletedCount: 1,
      } as any);

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(Purchase.deleteOne).toHaveBeenCalledWith({ _id: purchaseId });
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    // ===================
    // Error Handling Tests
    // ===================
    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
      };

      vi.mocked(Program.findById).mockRejectedValue(
        new Error("Database connection error")
      );

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to create checkout session.",
        error: "Database connection error",
      });
    });

    it("should handle non-Error exceptions", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.body = {
        programId: programId.toString(),
      };

      vi.mocked(Program.findById).mockRejectedValue("String error");

      await PurchaseCheckoutController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to create checkout session.",
        error: undefined,
      });
    });
  });
});
