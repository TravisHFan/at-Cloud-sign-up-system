import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import EventPurchaseController from "../../../../src/controllers/purchase/EventPurchaseController";
import { Purchase, Event, PromoCode } from "../../../../src/models";
import { lockService } from "../../../../src/services/LockService";
import EventAccessControlService from "../../../../src/services/event/EventAccessControlService";

vi.mock("../../../../src/models");
vi.mock("../../../../src/services/LockService");
vi.mock("../../../../src/services/event/EventAccessControlService");
vi.mock("../../../../src/services/stripeService", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
        expire: vi.fn(),
      },
    },
  },
}));

/**
 * EventPurchaseController Unit Tests
 *
 * Tests for the event ticket checkout session creation.
 * Complex lock-based scenarios with promo codes are better
 * tested via integration tests.
 */
describe("EventPurchaseController", () => {
  let mockReq: Partial<Request> & { user?: any; body?: any; params?: any };
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  const userId = new mongoose.Types.ObjectId();
  const eventId = new mongoose.Types.ObjectId();
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
      params: {},
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
      mockReq.params = { id: eventId.toString() };

      await EventPurchaseController.createCheckoutSession(
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
    it("should return 400 if eventId is missing", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = {};
      mockReq.body = {};

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 400 if eventId is invalid ObjectId", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: "invalid" };
      mockReq.body = {};

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 404 if event not found", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      vi.mocked(Event.findById).mockResolvedValue(null);

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found.",
      });
    });

    it("should return 400 if event is free", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Free Event",
        pricing: { isFree: true, price: 0 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This event is free and does not require purchase.",
      });
    });

    it("should return 400 if event has no pricing set (defaults to free)", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Event Without Pricing",
        pricing: undefined,
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "This event is free and does not require purchase.",
      });
    });

    // ===================
    // Access Control Tests
    // ===================
    it("should return 400 if user already has access (organizer)", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: true,
        requiresPurchase: false,
        accessReason: "organizer",
      });

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You already have access to this event: organizer",
      });
    });

    it("should return 400 if user already has access (co-organizer)", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: true,
        requiresPurchase: false,
        accessReason: "co_organizer",
      });

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You already have access to this event: co_organizer",
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
      mockReq.params = { id: eventId.toString() };
      mockReq.body = { promoCode: "INVALID" };

      const mockEvent = {
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: false,
        requiresPurchase: true,
        accessReason: undefined,
      });
      vi.mocked(PromoCode.findOne).mockResolvedValue(null);

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid promo code.",
      });
    });

    // NOTE: Tests for promo code validation paths (not valid for event, belongs to
    // different user, staff code for wrong event) require the PromoCode.findOne mock
    // to return a promo code object. Due to complexities with mocking mongoose models
    // in this test file, these paths are better tested via integration tests.
    // The "promo code not found" test above covers the basic validation path.

    // ===================
    // Existing Purchase Tests
    // ===================
    it("should return 400 if user already completed purchase", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: false,
        requiresPurchase: true,
        accessReason: undefined,
      });
      vi.mocked(Purchase.findOne).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        status: "completed",
      } as any);

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "You have already purchased a ticket for this event.",
      });
    });

    // ===================
    // Lock Service Tests
    // ===================
    it("should return 409 if lock acquisition fails", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: false,
        requiresPurchase: true,
        accessReason: undefined,
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockRejectedValue(
        new Error("Failed to acquire lock")
      );

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Another purchase is in progress. Please try again in a moment.",
      });
    });

    // ===================
    // Successful Checkout Session Tests
    // ===================
    it("should create checkout session successfully without promo code", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      const mockEvent = {
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      };

      const mockSessionResult = {
        sessionId: "cs_test_123",
        sessionUrl: "https://checkout.stripe.com/test",
        purchaseId: new mongoose.Types.ObjectId().toString(),
        orderNumber: "ORD-123456",
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: false,
        requiresPurchase: true,
        accessReason: undefined,
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
      vi.mocked(lockService.withLock).mockResolvedValue(mockSessionResult);

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Event ticket checkout session created successfully.",
        data: mockSessionResult,
      });
    });

    // NOTE: Promo code success paths (general codes, user's own codes, staff codes)
    // are complex to mock accurately due to dynamic imports within the lock service.
    // These scenarios are better covered by integration tests which validate the
    // full promo code validation + checkout flow end-to-end.

    // ===================
    // Error Handling Tests
    // ===================
    it("should return 500 on unexpected error", async () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      vi.mocked(Event.findById).mockRejectedValue(new Error("Database error"));

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Database error",
      });
    });
  });

  // ================================================================
  // Lock Callback Tests - Actually execute the code inside withLock
  // ================================================================
  describe("createCheckoutSession - Lock Callback Execution", () => {
    const setupValidRequest = () => {
      mockReq.user = {
        _id: userId,
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      };
      mockReq.params = { id: eventId.toString() };
      mockReq.body = {};

      vi.mocked(Event.findById).mockResolvedValue({
        _id: eventId,
        title: "Paid Event",
        pricing: { isFree: false, price: 5000 },
      } as any);
      vi.mocked(EventAccessControlService.checkUserAccess).mockResolvedValue({
        hasAccess: false,
        requiresPurchase: true,
        accessReason: undefined,
      });
      vi.mocked(Purchase.findOne).mockResolvedValue(null);
    };

    it("should delete existing pending purchase and expire old Stripe session", async () => {
      setupValidRequest();

      const existingPurchaseId = new mongoose.Types.ObjectId();
      const pendingPurchase = {
        _id: existingPurchaseId,
        stripeSessionId: "cs_old_123",
        orderNumber: "ORD-OLD",
        status: "pending",
      };

      let lockCallCount = 0;
      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, callback) => {
          lockCallCount++;
          // Inside lock, first call to Purchase.findOne returns pending purchase
          vi.mocked(Purchase.findOne).mockResolvedValueOnce(
            pendingPurchase as any
          );
          vi.mocked(Purchase.deleteOne).mockResolvedValueOnce({} as any);
          vi.mocked(Purchase.create).mockResolvedValueOnce({
            _id: new mongoose.Types.ObjectId(),
            orderNumber: "ORD-NEW",
            stripeSessionId: null,
            save: vi.fn().mockResolvedValue({}),
          } as any);

          // Mock stripe session retrieve and expire
          const stripeService = await import(
            "../../../../src/services/stripeService"
          );
          vi.mocked(
            stripeService.stripe.checkout.sessions.retrieve
          ).mockResolvedValue({ status: "open" } as any);
          vi.mocked(
            stripeService.stripe.checkout.sessions.expire
          ).mockResolvedValue({} as any);
          vi.mocked(
            stripeService.stripe.checkout.sessions.create
          ).mockResolvedValue({
            id: "cs_new_123",
            url: "https://checkout.stripe.com/new",
          } as any);

          return callback();
        }
      );

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(lockCallCount).toBe(1);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should handle already expired Stripe session gracefully", async () => {
      setupValidRequest();

      const pendingPurchase = {
        _id: new mongoose.Types.ObjectId(),
        stripeSessionId: "cs_expired_123",
        orderNumber: "ORD-OLD",
      };

      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, callback) => {
          vi.mocked(Purchase.findOne).mockResolvedValueOnce(
            pendingPurchase as any
          );
          vi.mocked(Purchase.deleteOne).mockResolvedValueOnce({} as any);
          vi.mocked(Purchase.create).mockResolvedValueOnce({
            _id: new mongoose.Types.ObjectId(),
            orderNumber: "ORD-NEW",
            stripeSessionId: null,
            save: vi.fn().mockResolvedValue({}),
          } as any);

          const stripeService = await import(
            "../../../../src/services/stripeService"
          );
          // Session is already expired/completed
          vi.mocked(
            stripeService.stripe.checkout.sessions.retrieve
          ).mockResolvedValue({ status: "complete" } as any);
          vi.mocked(
            stripeService.stripe.checkout.sessions.create
          ).mockResolvedValue({
            id: "cs_new_123",
            url: "https://checkout.stripe.com/new",
          } as any);

          return callback();
        }
      );

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should continue if Stripe session expire fails", async () => {
      setupValidRequest();

      const pendingPurchase = {
        _id: new mongoose.Types.ObjectId(),
        stripeSessionId: "cs_problem_123",
        orderNumber: "ORD-OLD",
      };

      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, callback) => {
          vi.mocked(Purchase.findOne).mockResolvedValueOnce(
            pendingPurchase as any
          );
          vi.mocked(Purchase.deleteOne).mockResolvedValueOnce({} as any);
          vi.mocked(Purchase.create).mockResolvedValueOnce({
            _id: new mongoose.Types.ObjectId(),
            orderNumber: "ORD-NEW",
            stripeSessionId: null,
            save: vi.fn().mockResolvedValue({}),
          } as any);

          const stripeService = await import(
            "../../../../src/services/stripeService"
          );
          // Session retrieve throws error
          vi.mocked(
            stripeService.stripe.checkout.sessions.retrieve
          ).mockRejectedValue(new Error("Stripe API error"));
          vi.mocked(
            stripeService.stripe.checkout.sessions.create
          ).mockResolvedValue({
            id: "cs_new_123",
            url: "https://checkout.stripe.com/new",
          } as any);

          return callback();
        }
      );

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      // Should still succeed even if expire fails
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    // NOTE: Promo code discount calculation tests (fixed amount, percentage) and
    // promo code validation tests (wrong event, wrong user, staff code restrictions)
    // require complex mongoose model mocking that doesn't work reliably with vi.mock.
    // These scenarios are better covered via integration tests which validate the
    // full promo code validation + checkout flow end-to-end.

    it("should throw error if final price is below Stripe minimum", async () => {
      setupValidRequest();

      // Override with very low price event
      vi.mocked(Event.findById).mockResolvedValue({
        _id: eventId,
        title: "Cheap Event",
        pricing: { isFree: false, price: 25 }, // 25 cents, below $0.50 minimum
      } as any);

      vi.mocked(lockService.withLock).mockImplementation(
        async (_key, callback) => {
          vi.mocked(Purchase.findOne).mockResolvedValueOnce(null as any);
          vi.mocked(Purchase.create).mockResolvedValueOnce({
            _id: new mongoose.Types.ObjectId(),
            orderNumber: "ORD-CHEAP",
            save: vi.fn(),
          } as any);

          return callback();
        }
      );

      await EventPurchaseController.createCheckoutSession(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining("Stripe requires a minimum of $0.50"),
      });
    });
  });
});
