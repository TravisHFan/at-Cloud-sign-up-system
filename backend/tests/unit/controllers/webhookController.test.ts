import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { WebhookController } from "../../../src/controllers/webhookController";
import * as stripeService from "../../../src/services/stripeService";
import {
  Purchase,
  SystemConfig,
  PromoCode,
  User,
  Program,
} from "../../../src/models";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";
import { lockService } from "../../../src/services/LockService";
import { TrioNotificationService } from "../../../src/services/notifications/TrioNotificationService";
import Stripe from "stripe";
import mongoose from "mongoose";

// Mock all external dependencies
vi.mock("../../../src/services/stripeService");
vi.mock("../../../src/models", () => ({
  Purchase: {
    findById: vi.fn(),
    findOne: vi.fn(),
  },
  SystemConfig: {
    getBundleDiscountConfig: vi.fn(),
  },
  PromoCode: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    generateUniqueCode: vi.fn(),
    deleteOne: vi.fn(),
  },
  User: {
    find: vi.fn(),
    findById: vi.fn(),
  },
  Program: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock("../../../src/services/infrastructure/EmailServiceFacade");
vi.mock("../../../src/services/LockService");
vi.mock("../../../src/services/notifications/TrioNotificationService");
vi.mock("../../../src/services/email/domains/PurchaseEmailService", () => ({
  PurchaseEmailService: {
    sendRefundCompletedEmail: vi.fn().mockResolvedValue(undefined),
    sendRefundFailedEmail: vi.fn().mockResolvedValue(undefined),
    sendAdminRefundNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("WebhookController", () => {
  let mockReq: Partial<Request>;
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
      body: {},
      headers: {},
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console methods to reduce noise
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mock environment variables
    process.env.FRONTEND_URL = "http://localhost:5173";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleStripeWebhook", () => {
    describe("webhook signature verification", () => {
      it("should return 400 if stripe-signature header is missing", async () => {
        mockReq.headers = {};

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing stripe-signature header",
        });
      });

      it("should return 400 if webhook signature verification fails", async () => {
        mockReq.headers = { "stripe-signature": "invalid_signature" };
        mockReq.body = "raw_body";

        vi.mocked(stripeService.constructWebhookEvent).mockImplementation(
          () => {
            throw new Error("Invalid signature");
          }
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Webhook Error: Invalid signature",
        });
      });

      it("should verify webhook signature successfully", async () => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        const mockEvent = {
          type: "unhandled_event",
          data: { object: {} },
        } as unknown as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(stripeService.constructWebhookEvent).toHaveBeenCalledWith(
          "raw_body",
          "valid_signature"
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          received: true,
        });
      });
    });

    describe("event handling", () => {
      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";
      });

      it("should handle checkout.session.completed event", async () => {
        const mockSession = {
          id: "cs_test_123",
          metadata: { purchaseId: "purchase123" },
        } as unknown as Stripe.Checkout.Session;

        const mockEvent = {
          type: "checkout.session.completed",
          data: { object: mockSession },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(lockService.withLock).mockImplementation(async (_key, fn) =>
          fn()
        );

        const mockPurchase = {
          _id: "purchase123",
          status: "pending",
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockResolvedValue({
            userId: {
              email: "test@example.com",
              firstName: "Test",
              lastName: "User",
            },
            programId: {
              title: "Test Program",
              programType: "Workshop",
            },
          }),
        };

        vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase as any);
        vi.mocked(EmailService.sendPurchaseConfirmationEmail).mockResolvedValue(
          undefined as any
        );
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: false,
        } as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(lockService.withLock).toHaveBeenCalledWith(
          "purchase:complete:purchase123",
          expect.any(Function),
          15000
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          received: true,
        });
      });

      it("should handle payment_intent.succeeded event", async () => {
        const mockPaymentIntent = {
          id: "pi_test_123",
        } as Stripe.PaymentIntent;

        const mockEvent = {
          type: "payment_intent.succeeded",
          data: { object: mockPaymentIntent },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );

        const mockPurchase = {
          status: "pending",
          orderNumber: "ORDER-001",
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Purchase.findOne).mockResolvedValue(mockPurchase as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(Purchase.findOne).toHaveBeenCalledWith({
          stripePaymentIntentId: "pi_test_123",
        });
        expect(mockPurchase.status).toBe("completed");
        expect(mockPurchase.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle payment_intent.payment_failed event", async () => {
        const mockPaymentIntent = {
          id: "pi_test_123",
        } as Stripe.PaymentIntent;

        const mockEvent = {
          type: "payment_intent.payment_failed",
          data: { object: mockPaymentIntent },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );

        const mockPurchase = {
          status: "pending",
          orderNumber: "ORDER-001",
          isClassRep: false,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(Purchase.findOne).mockResolvedValue(mockPurchase as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(Purchase.findOne).toHaveBeenCalledWith({
          stripePaymentIntentId: "pi_test_123",
        });
        expect(mockPurchase.status).toBe("failed");
        expect(mockPurchase.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle unhandled event types gracefully", async () => {
        const mockEvent = {
          type: "customer.created",
          data: { object: {} },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          received: true,
        });
      });

      it("should return 500 if event processing fails", async () => {
        const mockEvent = {
          type: "checkout.session.completed",
          data: { object: {} as Stripe.Checkout.Session },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(lockService.withLock).mockRejectedValue(
          new Error("Lock failed")
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Webhook processing failed",
        });
      });
    });

    describe("checkout session completion", () => {
      let mockSession: Stripe.Checkout.Session;
      let mockPurchase: any;

      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        mockSession = {
          id: "cs_test_123",
          payment_intent: "pi_test_123",
          metadata: { purchaseId: "purchase123" },
          customer_details: {
            name: "John Doe",
            email: "john@example.com",
            address: {
              line1: "123 Main St",
              city: "New York",
              state: "NY",
              postal_code: "10001",
              country: "US",
            },
          },
        } as unknown as Stripe.Checkout.Session;

        mockPurchase = {
          _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
          status: "pending",
          orderNumber: "ORDER-001",
          userId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
          programId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439013"),
          purchaseType: "program",
          eventId: null,
          billingInfo: {
            fullName: "",
            email: "",
          },
          finalPrice: 100,
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockReturnThis(),
        } as any;

        // Make populate return the purchase with populated fields
        mockPurchase.userId = {
          _id: "507f1f77bcf86cd799439012",
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
        } as any;
        mockPurchase.programId = {
          _id: "507f1f77bcf86cd799439013",
          title: "Test Program",
          programType: "Workshop",
        } as any;

        const mockEvent = {
          type: "checkout.session.completed",
          data: { object: mockSession },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(lockService.withLock).mockImplementation(async (_key, fn) =>
          fn()
        );
        vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase);
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: false,
        } as any);
        vi.mocked(EmailService.sendPurchaseConfirmationEmail).mockResolvedValue(
          undefined as any
        );
      });

      it("should use unified lock with purchaseId from metadata", async () => {
        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(lockService.withLock).toHaveBeenCalledWith(
          "purchase:complete:purchase123",
          expect.any(Function),
          15000
        );
      });

      it("should fall back to session ID lock for backward compatibility", async () => {
        mockSession.metadata = {};
        mockPurchase = {
          ...mockPurchase,
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockResolvedValue(mockPurchase),
        };

        vi.mocked(Purchase.findById).mockResolvedValue(null);
        vi.mocked(Purchase.findOne).mockResolvedValue(mockPurchase);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(lockService.withLock).toHaveBeenCalledWith(
          "webhook:session:cs_test_123",
          expect.any(Function),
          15000
        );
      });

      it("should handle missing purchase gracefully", async () => {
        vi.mocked(Purchase.findById).mockResolvedValue(null);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          received: true,
        });
      });

      it("should skip processing if purchase already completed (idempotency)", async () => {
        mockPurchase.status = "completed";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.save).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should fetch and update payment method details", async () => {
        const mockPaymentIntent = {
          id: "pi_test_123",
          latest_charge: "ch_test_123",
        };

        const mockCharge = {
          payment_method_details: {
            card: {
              brand: "visa",
              last4: "4242",
            },
          },
          billing_details: {
            name: "John Doe",
          },
        };

        vi.mocked(stripeService.getPaymentIntent).mockResolvedValue(
          mockPaymentIntent as any
        );

        const mockStripe = {
          charges: {
            retrieve: vi.fn().mockResolvedValue(mockCharge),
          },
        };

        vi.doMock("../../../src/services/stripeService", () => ({
          ...stripeService,
          stripe: mockStripe,
        }));

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.save).toHaveBeenCalled();
        expect(mockPurchase.status).toBe("completed");
      });

      it("should update billing info from customer details", async () => {
        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.billingInfo.fullName).toBe("John Doe");
        expect(mockPurchase.billingInfo.email).toBe("john@example.com");
        expect(mockPurchase.billingInfo.address).toBe("123 Main St");
        expect(mockPurchase.billingInfo.city).toBe("New York");
        expect(mockPurchase.billingInfo.state).toBe("NY");
        expect(mockPurchase.billingInfo.zipCode).toBe("10001");
        expect(mockPurchase.billingInfo.country).toBe("US");
        expect(mockPurchase.save).toHaveBeenCalled();
      });

      it("should mark purchase as completed with purchase date", async () => {
        const beforeDate = new Date();

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        const afterDate = new Date();

        expect(mockPurchase.status).toBe("completed");
        expect(mockPurchase.purchaseDate).toBeDefined();
        expect(mockPurchase.purchaseDate.getTime()).toBeGreaterThanOrEqual(
          beforeDate.getTime()
        );
        expect(mockPurchase.purchaseDate.getTime()).toBeLessThanOrEqual(
          afterDate.getTime()
        );
        expect(mockPurchase.save).toHaveBeenCalled();
      });

      it("should continue if payment intent fetch fails", async () => {
        vi.mocked(stripeService.getPaymentIntent).mockRejectedValue(
          new Error("Stripe API error")
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.save).toHaveBeenCalled();
        expect(mockPurchase.status).toBe("completed");
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("promo code handling", () => {
      let mockSession: Stripe.Checkout.Session;
      let mockPurchase: any;
      let mockPromoCode: any;

      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        mockSession = {
          id: "cs_test_123",
          metadata: { purchaseId: "purchase123" },
          customer_details: { name: "Test User", email: "test@example.com" },
        } as unknown as Stripe.Checkout.Session;

        mockPurchase = {
          _id: "purchase123",
          status: "pending",
          purchaseType: "program",
          userId: new mongoose.Types.ObjectId(),
          programId: new mongoose.Types.ObjectId(),
          promoCode: "TESTCODE",
          finalPrice: 80,
          billingInfo: { fullName: "", email: "" },
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockResolvedValue({
            userId: {
              email: "test@example.com",
              firstName: "Test",
              lastName: "User",
            },
            programId: {
              title: "Test Program",
              programType: "Workshop",
            },
          }),
        };

        mockPromoCode = {
          _id: new mongoose.Types.ObjectId(),
          code: "TESTCODE",
          isGeneral: false,
          isUsed: false,
          markAsUsed: vi.fn().mockResolvedValue({}),
        };

        const mockEvent = {
          type: "checkout.session.completed",
          data: { object: mockSession },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(lockService.withLock).mockImplementation(async (_key, fn) =>
          fn()
        );
        vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase);
        vi.mocked(PromoCode.findOne).mockResolvedValue(mockPromoCode);
        vi.mocked(User.findById).mockReturnValue({
          select: vi.fn().mockResolvedValue({
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
          }),
        } as any);
        vi.mocked(Program.findById).mockReturnValue({
          select: vi.fn().mockResolvedValue({ title: "Test Program" }),
        } as any);
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: false,
        } as any);
        vi.mocked(EmailService.sendPurchaseConfirmationEmail).mockResolvedValue(
          undefined as any
        );
      });

      it("should mark personal promo code as used", async () => {
        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.findOne).toHaveBeenCalledWith({ code: "TESTCODE" });
        expect(mockPromoCode.markAsUsed).toHaveBeenCalledWith(
          mockPurchase.programId,
          mockPurchase.userId,
          "Test User",
          "test@example.com",
          "Test Program"
        );
      });

      it("should skip marking personal code if already used", async () => {
        mockPromoCode.isUsed = true;

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPromoCode.markAsUsed).not.toHaveBeenCalled();
      });

      it("should notify admins when general staff code is used", async () => {
        mockPromoCode.isGeneral = true;

        const mockAdmins = [
          { _id: new mongoose.Types.ObjectId() },
          { _id: new mongoose.Types.ObjectId() },
        ];

        vi.mocked(User.find).mockReturnValue({
          select: vi.fn().mockResolvedValue(mockAdmins),
        } as any);

        vi.mocked(TrioNotificationService.createTrio).mockResolvedValue(
          undefined as any
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(User.find).toHaveBeenCalledWith({
          role: { $in: ["Super Admin", "Administrator"] },
        });
        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith({
          systemMessage: expect.objectContaining({
            title: "General Staff Code Used",
            type: "announcement",
            priority: "medium",
            hideCreator: true,
          }),
          recipients: expect.arrayContaining([
            mockAdmins[0]._id.toString(),
            mockAdmins[1]._id.toString(),
          ]),
        });
      });

      it("should not notify admins for non-general codes", async () => {
        mockPromoCode.isGeneral = false;

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(TrioNotificationService.createTrio).not.toHaveBeenCalled();
      });

      it("should continue if promo code notification fails", async () => {
        mockPromoCode.isGeneral = true;
        vi.mocked(User.find).mockReturnValue({
          select: vi.fn().mockResolvedValue([{ _id: "admin1" }]),
        } as any);
        vi.mocked(TrioNotificationService.createTrio).mockRejectedValue(
          new Error("Notification failed")
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockPurchase.save).toHaveBeenCalled();
      });

      it("should continue if marking promo code fails", async () => {
        vi.mocked(PromoCode.findOne).mockRejectedValue(new Error("DB error"));

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockPurchase.save).toHaveBeenCalled();
      });
    });

    describe("bundle promo code generation", () => {
      let mockSession: Stripe.Checkout.Session;
      let mockPurchase: any;

      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        mockSession = {
          id: "cs_test_123",
          metadata: { purchaseId: "purchase123" },
          customer_details: { name: "Test User", email: "test@example.com" },
        } as unknown as Stripe.Checkout.Session;

        mockPurchase = {
          _id: "purchase123",
          status: "pending",
          purchaseType: "program",
          userId: new mongoose.Types.ObjectId(),
          programId: new mongoose.Types.ObjectId(),
          finalPrice: 100,
          billingInfo: { fullName: "", email: "" },
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockResolvedValue({
            userId: {
              email: "test@example.com",
              firstName: "Test",
              lastName: "User",
            },
            programId: {
              title: "Test Program",
              programType: "Workshop",
            },
          }),
        };

        const mockEvent = {
          type: "checkout.session.completed",
          data: { object: mockSession },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(lockService.withLock).mockImplementation(async (_key, fn) =>
          fn()
        );
        vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase);
        vi.mocked(EmailService.sendPurchaseConfirmationEmail).mockResolvedValue(
          undefined as any
        );
      });

      it("should generate bundle promo code when feature enabled", async () => {
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: true,
          discountAmount: 20,
          expiryDays: 30,
        } as any);

        vi.mocked(PromoCode.generateUniqueCode).mockResolvedValue("BUNDLE123");

        const mockBundleCode = {
          _id: "bundle_id",
          code: "BUNDLE123",
        };

        vi.mocked(PromoCode.create).mockResolvedValue(mockBundleCode as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.generateUniqueCode).toHaveBeenCalled();
        expect(PromoCode.create).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "BUNDLE123",
            type: "bundle_discount",
            discountAmount: 20,
            ownerId: mockPurchase.userId,
            excludedProgramId: mockPurchase.programId,
            isActive: true,
            isUsed: false,
            createdBy: "system",
          })
        );
        expect(mockPurchase.bundlePromoCode).toBe("BUNDLE123");
        expect(mockPurchase.bundleDiscountAmount).toBe(20);
      });

      it("should not generate bundle code when feature disabled", async () => {
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: false,
        } as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.generateUniqueCode).not.toHaveBeenCalled();
        expect(PromoCode.create).not.toHaveBeenCalled();
      });

      it("should not generate bundle code for free purchases", async () => {
        mockPurchase.finalPrice = 0;

        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: true,
          discountAmount: 20,
          expiryDays: 30,
        } as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.generateUniqueCode).not.toHaveBeenCalled();
      });

      it("should continue if bundle code generation fails", async () => {
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: true,
          discountAmount: 20,
          expiryDays: 30,
        } as any);

        vi.mocked(PromoCode.generateUniqueCode).mockRejectedValue(
          new Error("Generation failed")
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockPurchase.save).toHaveBeenCalled();
      });
    });

    describe("confirmation email", () => {
      let mockSession: Stripe.Checkout.Session;
      let mockPurchase: any;

      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        mockSession = {
          id: "cs_test_123",
          metadata: { purchaseId: "purchase123" },
          customer_details: { name: "Test User", email: "test@example.com" },
        } as unknown as Stripe.Checkout.Session;

        const userId = new mongoose.Types.ObjectId();
        const programId = new mongoose.Types.ObjectId();

        mockPurchase = {
          _id: "purchase123",
          status: "pending",
          purchaseType: "program",
          userId,
          programId,
          orderNumber: "ORDER-001",
          finalPrice: 100,
          fullPrice: 120,
          classRepDiscount: 10,
          earlyBirdDiscount: 10,
          isClassRep: true,
          isEarlyBird: true,
          billingInfo: { fullName: "", email: "" },
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockImplementation(function (this: any) {
            // Modify in-place to simulate Mongoose populate behavior
            this.userId = {
              email: "test@example.com",
              firstName: "Test",
              lastName: "User",
            };
            this.programId = {
              title: "Test Program",
              programType: "Workshop",
            };
            return Promise.resolve(this);
          }),
        };

        const mockEvent = {
          type: "checkout.session.completed",
          data: { object: mockSession },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(lockService.withLock).mockImplementation(async (_key, fn) =>
          fn()
        );
        vi.mocked(Purchase.findById).mockResolvedValue(mockPurchase);
        vi.mocked(SystemConfig.getBundleDiscountConfig).mockResolvedValue({
          enabled: false,
        } as any);
        vi.mocked(EmailService.sendPurchaseConfirmationEmail).mockResolvedValue(
          undefined as any
        );
      });

      it("should send purchase confirmation email", async () => {
        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(EmailService.sendPurchaseConfirmationEmail).toHaveBeenCalledWith(
          {
            email: "test@example.com",
            name: "Test User",
            orderNumber: "ORDER-001",
            programTitle: "Test Program",
            programType: "Workshop",
            purchaseDate: expect.any(Date),
            fullPrice: 120,
            finalPrice: 100,
            classRepDiscount: 10,
            earlyBirdDiscount: 10,
            isClassRep: true,
            isEarlyBird: true,
            receiptUrl: expect.stringContaining(
              "/dashboard/purchase-receipt/purchase123"
            ),
          }
        );
      });

      it("should continue if email sending fails", async () => {
        vi.mocked(EmailService.sendPurchaseConfirmationEmail).mockRejectedValue(
          new Error("Email failed")
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockPurchase.save).toHaveBeenCalled();
      });

      it("should skip email if user not found", async () => {
        mockPurchase.populate = vi
          .fn()
          .mockImplementation(function (this: any) {
            this.userId = null;
            this.programId = { title: "Test Program" };
            return Promise.resolve(this);
          });

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(
          EmailService.sendPurchaseConfirmationEmail
        ).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should skip email if program not found", async () => {
        mockPurchase.populate = vi
          .fn()
          .mockImplementation(function (this: any) {
            this.userId = {
              email: "test@example.com",
              firstName: "Test",
              lastName: "User",
            };
            this.programId = null;
            return Promise.resolve(this);
          });

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(
          EmailService.sendPurchaseConfirmationEmail
        ).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("payment_intent.payment_failed with Class Rep", () => {
      let mockPaymentIntent: Stripe.PaymentIntent;
      let mockPurchase: any;

      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        mockPaymentIntent = {
          id: "pi_test_123",
        } as Stripe.PaymentIntent;

        mockPurchase = {
          status: "pending",
          orderNumber: "ORDER-001",
          programId: new mongoose.Types.ObjectId(),
          isClassRep: true,
          save: vi.fn().mockResolvedValue({}),
        };

        const mockEvent = {
          type: "payment_intent.payment_failed",
          data: { object: mockPaymentIntent },
        } as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(Purchase.findOne).mockResolvedValue(mockPurchase);
      });

      it("should decrement classRepCount for failed Class Rep purchase", async () => {
        vi.mocked(Program.findByIdAndUpdate).mockResolvedValue({} as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(Program.findByIdAndUpdate).toHaveBeenCalledWith(
          mockPurchase.programId,
          { $inc: { classRepCount: -1 } },
          { runValidators: false }
        );
        expect(mockPurchase.status).toBe("failed");
        expect(mockPurchase.save).toHaveBeenCalled();
      });

      it("should not decrement for non-Class Rep purchase", async () => {
        mockPurchase.isClassRep = false;

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(Program.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(mockPurchase.status).toBe("failed");
      });

      it("should handle missing purchase gracefully", async () => {
        vi.mocked(Purchase.findOne).mockResolvedValue(null);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(Program.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("charge.refund.updated event handling", () => {
      let mockRefund: Stripe.Refund;
      let mockPurchase: any;

      beforeEach(() => {
        mockReq.headers = { "stripe-signature": "valid_signature" };
        mockReq.body = "raw_body";

        mockRefund = {
          id: "re_test_123",
          status: "succeeded",
          metadata: {
            purchaseId: "purchase123",
            orderNumber: "ORDER-001",
          },
        } as unknown as Stripe.Refund;

        mockPurchase = {
          _id: "purchase123",
          status: "completed",
          orderNumber: "ORDER-001",
          userId: new mongoose.Types.ObjectId(),
          programId: { title: "Test Program" },
          finalPrice: 10000,
          purchaseDate: new Date(),
          promoCode: null,
          bundlePromoCode: null,
          billingInfo: {
            fullName: "Test User",
            email: "test@example.com",
          },
          save: vi.fn().mockResolvedValue({}),
          populate: vi.fn().mockReturnThis(),
        };

        const mockEvent = {
          type: "charge.refund.updated",
          data: { object: mockRefund },
        } as unknown as Stripe.Event;

        vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(
          mockEvent
        );
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockPurchase),
        } as any);
        vi.mocked(User.findById).mockResolvedValue({
          _id: mockPurchase.userId,
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
        } as any);
        vi.mocked(User.find).mockReturnValue({
          select: vi
            .fn()
            .mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]),
        } as any);
        vi.mocked(TrioNotificationService.createTrio).mockResolvedValue(
          undefined
        );
      });

      it("should handle refund succeeded event", async () => {
        mockRefund.status = "succeeded";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.status).toBe("refunded");
        expect(mockPurchase.refundedAt).toBeDefined();
        expect(mockPurchase.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should recover promo code on successful refund", async () => {
        mockRefund.status = "succeeded";
        mockPurchase.promoCode = "PROMO123";

        const mockPromoCode = {
          code: "PROMO123",
          isUsed: true,
          isActive: false,
          save: vi.fn().mockResolvedValue({}),
        };

        vi.mocked(PromoCode.findOne).mockResolvedValue(mockPromoCode as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPromoCode.isUsed).toBe(false);
        expect(mockPromoCode.isActive).toBe(true);
        expect(mockPromoCode.save).toHaveBeenCalled();
      });

      it("should delete bundle promo code on successful refund", async () => {
        mockRefund.status = "succeeded";
        mockPurchase.bundlePromoCode = "BUNDLE123";

        const mockBundleCode = {
          code: "BUNDLE123",
          isUsed: false,
        };

        vi.mocked(PromoCode.findOne).mockResolvedValue(mockBundleCode as any);
        vi.mocked(PromoCode.deleteOne).mockResolvedValue({} as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(PromoCode.deleteOne).toHaveBeenCalledWith({
          code: "BUNDLE123",
        });
      });

      it("should handle refund failed event", async () => {
        mockRefund.status = "failed";
        mockRefund.failure_reason = "insufficient_funds";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.status).toBe("refund_failed");
        expect(mockPurchase.refundFailureReason).toBe("insufficient_funds");
        expect(mockPurchase.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle refund pending event", async () => {
        mockRefund.status = "pending";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        // Pending refunds don't change purchase status
        expect(mockPurchase.status).toBe("completed");
        expect(mockPurchase.save).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle refund canceled event", async () => {
        mockRefund.status = "canceled";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(mockPurchase.status).toBe("completed");
        expect(mockPurchase.refundFailureReason).toBe(
          "Refund was canceled by payment processor"
        );
        expect(mockPurchase.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle unknown refund status gracefully", async () => {
        mockRefund.status = "unknown_status" as any;

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        // Unknown status should not change purchase
        expect(mockPurchase.save).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle missing purchaseId in refund metadata", async () => {
        mockRefund.metadata = {};

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(Purchase.findById).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle missing purchase for refund", async () => {
        vi.mocked(Purchase.findById).mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        } as any);

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should send admin notification on successful refund", async () => {
        mockRefund.status = "succeeded";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            systemMessage: expect.objectContaining({
              title: "Refund Completed",
              priority: "high",
            }),
          })
        );
      });

      it("should continue if promo code recovery fails", async () => {
        mockRefund.status = "succeeded";
        mockPurchase.promoCode = "PROMO123";

        vi.mocked(PromoCode.findOne).mockRejectedValue(
          new Error("Database error")
        );

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        // Should still complete successfully
        expect(mockPurchase.status).toBe("refunded");
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should send cancellation alert to admins for canceled refund", async () => {
        mockRefund.status = "canceled";

        await WebhookController.handleStripeWebhook(
          mockReq as Request,
          mockRes as Response
        );

        expect(TrioNotificationService.createTrio).toHaveBeenCalledWith(
          expect.objectContaining({
            systemMessage: expect.objectContaining({
              title: "⚠️ Refund Canceled (Unusual)",
              type: "alert",
            }),
          })
        );
      });
    });
  });
});
