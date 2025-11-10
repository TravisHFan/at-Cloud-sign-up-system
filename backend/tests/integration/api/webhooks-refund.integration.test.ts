/**
 * Refund Webhook Integration Tests
 *
 * Tests charge.refund.updated webhook event processing including:
 * - Refund succeeded (happy path)
 * - Refund failed (error handling)
 * - Refund canceled (rare edge case)
 * - Refund pending (no action)
 * - Promo code recovery on successful refund
 * - Email notifications for all scenarios
 * - Admin system messages
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import Stripe from "stripe";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Program from "../../../src/models/Program";
import { Purchase, PromoCode } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";
import { PurchaseEmailService } from "../../../src/services/email/domains/PurchaseEmailService";
import { TrioNotificationService } from "../../../src/services/notifications/TrioNotificationService";

// Mock Stripe webhook construction
vi.mock("../../../src/services/stripeService", async () => {
  const actual = await vi.importActual("../../../src/services/stripeService");
  return {
    ...actual,
    constructWebhookEvent: vi.fn(
      (body: string | Buffer | any, signature: string) => {
        if (typeof body === "object" && !Buffer.isBuffer(body)) {
          return body;
        }
        const eventData =
          typeof body === "string"
            ? JSON.parse(body)
            : JSON.parse(body.toString());
        return eventData;
      }
    ),
  };
});

// Spy on email service methods
const emailCompletedSpy = vi.spyOn(
  PurchaseEmailService,
  "sendRefundCompletedEmail"
);
const emailFailedSpy = vi.spyOn(PurchaseEmailService, "sendRefundFailedEmail");
const emailAdminSpy = vi.spyOn(
  PurchaseEmailService,
  "sendAdminRefundNotification"
);

// Spy on notification service
const trioNotificationSpy = vi.spyOn(TrioNotificationService, "createTrio");

describe("Refund Webhook Integration Tests", () => {
  let regularUser: any;
  let adminUser: any;
  let program: any;
  let completedPurchase: any;
  let promoCode: any;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
    await Program.deleteMany({});
    await Purchase.deleteMany({});
    await PromoCode.deleteMany({});

    // Clear all spies
    emailCompletedSpy.mockClear();
    emailFailedSpy.mockClear();
    emailAdminSpy.mockClear();
    trioNotificationSpy.mockClear();

    // Mock email services to always succeed
    emailCompletedSpy.mockResolvedValue(true);
    emailFailedSpy.mockResolvedValue(true);
    emailAdminSpy.mockResolvedValue(true);
    trioNotificationSpy.mockResolvedValue(undefined as any);

    // Create regular user
    regularUser = await User.create({
      username: "refunduser",
      firstName: "Refund",
      lastName: "User",
      email: "refund@test.com",
      password: "Password123",
      role: "Participant",
    });

    // Create admin user
    adminUser = await User.create({
      username: "adminuser",
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
      password: "Password123",
      role: "Super Admin",
    });

    // Create program
    program = await Program.create({
      title: "Refund Test Program",
      description: "Test program for refunds",
      programType: "EMBA Mentor Circles",
      fullPriceTicket: 10000, // $100.00 in cents
      createdBy: regularUser._id,
      hostedBy: "@Cloud Marketplace Ministry",
    });

    // Create a promo code
    promoCode = await PromoCode.create({
      code: "TEST5050", // Must be exactly 8 characters
      type: "staff_access",
      discountPercent: 50,
      ownerId: regularUser._id,
      isActive: true,
      isUsed: true,
      usedAt: new Date(),
      usedForProgramId: program._id,
      createdBy: adminUser._id,
    });

    // Create completed purchase with promo code
    completedPurchase = await Purchase.create({
      userId: regularUser._id,
      programId: program._id,
      fullPrice: 10000,
      finalPrice: 5000, // Used 50% promo code
      isClassRep: false,
      isEarlyBird: false,
      promoCode: "TEST5050",
      promoDiscountPercent: 50,
      status: "refund_processing",
      orderNumber: "ORD-REFUND-001",
      stripeSessionId: "cs_test_refund_session",
      stripePaymentIntentId: "pi_test_refund_123",
      stripeRefundId: "re_test_refund_456",
      refundInitiatedAt: new Date(),
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
        cardholderName: "Refund User",
      },
      billingInfo: {
        fullName: "Refund User",
        email: "refund@test.com",
        address: "123 Test St",
        city: "Test City",
        state: "CA",
        zipCode: "12345",
        country: "US",
      },
      purchaseDate: new Date(),
    });
  });

  afterEach(async () => {
    // Cleanup after each test
    await User.deleteMany({});
    await Program.deleteMany({});
    await Purchase.deleteMany({});
    await PromoCode.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("POST /api/webhooks/stripe - charge.refund.updated: succeeded", () => {
    it("should update purchase status to refunded and set refundedAt", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_succeeded_001",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "succeeded",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
              userId: regularUser._id.toString(),
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);

      // Verify purchase updated
      const updatedPurchase = await Purchase.findById(completedPurchase._id);
      expect(updatedPurchase?.status).toBe("refunded");
      expect(updatedPurchase?.refundedAt).toBeDefined();
      expect(updatedPurchase?.refundedAt).toBeInstanceOf(Date);
    });

    it("should recover the promo code when refund succeeds", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_succeeded_002",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "succeeded",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      // Verify promo code is used before refund
      const promoBeforeRefund = await PromoCode.findOne({
        code: "TEST5050",
      });
      expect(promoBeforeRefund?.isUsed).toBe(true);
      expect(promoBeforeRefund?.isActive).toBe(true);

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      // Verify promo code recovered
      const promoAfterRefund = await PromoCode.findOne({ code: "TEST5050" });
      expect(promoAfterRefund?.isUsed).toBe(false);
      expect(promoAfterRefund?.isActive).toBe(true);
      expect(promoAfterRefund?.usedAt).toBeUndefined();
      expect(promoAfterRefund?.usedForProgramId).toBeUndefined();
    });

    it("should send refund completed email to user", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_succeeded_003",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "succeeded",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(emailCompletedSpy).toHaveBeenCalledOnce();
      expect(emailCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: "refund@test.com",
          userName: "Refund User",
          orderNumber: "ORD-REFUND-001",
          programTitle: "Refund Test Program",
          refundAmount: 5000,
        })
      );
    });

    it("should send admin refund notification and system message", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_succeeded_004",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "succeeded",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      // Verify admin email sent
      expect(emailAdminSpy).toHaveBeenCalledOnce();
      expect(emailAdminSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: "Refund User",
          userEmail: "refund@test.com",
          orderNumber: "ORD-REFUND-001",
        })
      );

      // Verify system message sent to admins
      expect(trioNotificationSpy).toHaveBeenCalled();
      const trioCall = trioNotificationSpy.mock.calls[0][0];
      expect(trioCall.systemMessage.title).toBe("Refund Completed");
      expect(trioCall.recipients).toContain(adminUser._id.toString());
    });
  });

  describe("POST /api/webhooks/stripe - charge.refund.updated: failed", () => {
    it("should update purchase status to refund_failed", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_failed_001",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "failed",
            amount: 5000,
            failure_reason: "insufficient_funds",
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);

      const updatedPurchase = await Purchase.findById(completedPurchase._id);
      expect(updatedPurchase?.status).toBe("refund_failed");
      expect(updatedPurchase?.refundFailureReason).toBe("insufficient_funds");
    });

    it("should send refund failed email to user", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_failed_002",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "failed",
            amount: 5000,
            failure_reason: "card_declined",
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(emailFailedSpy).toHaveBeenCalledOnce();
      expect(emailFailedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: "refund@test.com",
          userName: "Refund User",
          orderNumber: "ORD-REFUND-001",
          failureReason: "card_declined",
        })
      );
    });

    it("should NOT recover promo code when refund fails", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_failed_003",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "failed",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      // Promo code should remain used
      const promoAfterFailed = await PromoCode.findOne({ code: "TEST5050" });
      expect(promoAfterFailed?.isUsed).toBe(true);
    });
  });

  describe("POST /api/webhooks/stripe - charge.refund.updated: canceled (RARE EDGE CASE)", () => {
    it("should revert purchase status to completed when refund is canceled", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_canceled_001",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "canceled",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);

      // Verify purchase reverted to completed
      const updatedPurchase = await Purchase.findById(completedPurchase._id);
      expect(updatedPurchase?.status).toBe("completed");
      expect(updatedPurchase?.refundFailureReason).toBe(
        "Refund was canceled by payment processor"
      );
      expect(updatedPurchase?.refundedAt).toBeUndefined();
    });

    it("should send cancellation notification to user", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_canceled_002",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "canceled",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(emailFailedSpy).toHaveBeenCalledOnce();
      expect(emailFailedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: "refund@test.com",
          userName: "Refund User",
          orderNumber: "ORD-REFUND-001",
          failureReason: expect.stringContaining("canceled"),
        })
      );
    });

    it("should send high-priority alert to admins for canceled refund", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_canceled_003",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "canceled",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      // Verify high-priority system message sent
      expect(trioNotificationSpy).toHaveBeenCalled();
      const trioCall = trioNotificationSpy.mock.calls[0][0];
      expect(trioCall.systemMessage.title).toContain("Refund Canceled");
      expect(trioCall.systemMessage.title).toContain("⚠️");
      expect(trioCall.systemMessage.priority).toBe("high");
      expect(trioCall.systemMessage.type).toBe("alert");
      expect(trioCall.recipients).toContain(adminUser._id.toString());
    });

    it("should NOT recover promo code when refund is canceled", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_canceled_004",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "canceled",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      // Promo code should remain used (purchase reverted to completed)
      const promoAfterCanceled = await PromoCode.findOne({
        code: "TEST5050",
      });
      expect(promoAfterCanceled?.isUsed).toBe(true);
    });

    it("should include refund ID in admin alert metadata", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_canceled_005",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "canceled",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      const trioCall = trioNotificationSpy.mock.calls[0][0];
      expect(trioCall.systemMessage.metadata.refundId).toBe(
        "re_test_refund_456"
      );
      expect(trioCall.systemMessage.metadata.orderNumber).toBe(
        "ORD-REFUND-001"
      );
    });
  });

  describe("POST /api/webhooks/stripe - charge.refund.updated: pending", () => {
    it("should not change purchase status when refund is pending", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_pending_001",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "pending",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);

      // Status should remain refund_processing
      const updatedPurchase = await Purchase.findById(completedPurchase._id);
      expect(updatedPurchase?.status).toBe("refund_processing");
    });

    it("should not send any emails when refund is pending", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_pending_002",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_456",
            status: "pending",
            amount: 5000,
            metadata: {
              purchaseId: completedPurchase._id.toString(),
              orderNumber: "ORD-REFUND-001",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(emailCompletedSpy).not.toHaveBeenCalled();
      expect(emailFailedSpy).not.toHaveBeenCalled();
      expect(emailAdminSpy).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing purchaseId in refund metadata gracefully", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_no_metadata",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_999",
            status: "succeeded",
            amount: 5000,
            metadata: {}, // No purchaseId
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);
      expect(emailCompletedSpy).not.toHaveBeenCalled();
    });

    it("should handle non-existent purchase gracefully", async () => {
      const refundEvent: Stripe.Event = {
        id: "evt_refund_nonexistent",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_refund_999",
            status: "succeeded",
            amount: 5000,
            metadata: {
              purchaseId: new mongoose.Types.ObjectId().toString(),
              orderNumber: "ORD-NONEXISTENT",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);
      expect(emailCompletedSpy).not.toHaveBeenCalled();
    });

    it("should handle purchase without promo code gracefully", async () => {
      // Create purchase without promo code
      const noPromoCodePurchase = await Purchase.create({
        userId: regularUser._id,
        programId: program._id,
        fullPrice: 10000,
        finalPrice: 10000,
        isClassRep: false,
        isEarlyBird: false,
        status: "refund_processing",
        orderNumber: "ORD-NO-PROMO",
        stripeSessionId: "cs_test_no_promo",
        stripePaymentIntentId: "pi_test_no_promo",
        stripeRefundId: "re_test_no_promo",
        refundInitiatedAt: new Date(),
        paymentMethod: { type: "card" },
        billingInfo: {
          fullName: "No Promo User",
          email: "nopromo@test.com",
        },
        purchaseDate: new Date(),
      });

      const refundEvent: Stripe.Event = {
        id: "evt_refund_no_promo",
        object: "event",
        type: "charge.refund.updated",
        data: {
          object: {
            id: "re_test_no_promo",
            status: "succeeded",
            amount: 10000,
            metadata: {
              purchaseId: noPromoCodePurchase._id.toString(),
              orderNumber: "ORD-NO-PROMO",
            },
          } as unknown as Stripe.Refund,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(refundEvent);

      expect(response.status).toBe(200);

      // Purchase should still be updated to refunded
      const updated = await Purchase.findById(noPromoCodePurchase._id);
      expect(updated?.status).toBe("refunded");
    });
  });
});
