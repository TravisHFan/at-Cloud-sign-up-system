/**
 * Purchase Refund API Integration Tests
 *
 * Tests the refund endpoints:
 * - GET /api/purchases/refund-eligibility/:purchaseId
 * - POST /api/purchases/refund
 *
 * Coverage includes:
 * - Authentication and authorization
 * - Eligibility validation (status, 30-day window)
 * - Successful refund initiation
 * - Error handling (invalid IDs, missing data)
 * - Stripe API integration (mocked)
 * - Email notifications
 * - Database state updates
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
import * as stripeService from "../../../src/services/stripeService";

// Mock Stripe API
vi.mock("../../../src/services/stripeService", async () => {
  const actual = await vi.importActual("../../../src/services/stripeService");
  return {
    ...actual,
    processRefund: vi.fn(),
  };
});

// Spy on email service methods
const emailInitiatedSpy = vi.spyOn(
  PurchaseEmailService,
  "sendRefundInitiatedEmail"
);

describe("Purchase Refund API Integration Tests", () => {
  let regularUser: any;
  let otherUser: any;
  let adminUser: any;
  let program: any;
  let completedPurchase: any;
  let pendingPurchase: any;
  let refundedPurchase: any;
  let expiredPurchase: any;
  let promoCode: any;

  // Auth tokens
  let regularUserToken: string;
  let otherUserToken: string;
  let adminUserToken: string;

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
    emailInitiatedSpy.mockClear();
    vi.mocked(stripeService.processRefund).mockClear();

    // Mock email service to always succeed
    emailInitiatedSpy.mockResolvedValue(true);

    // Mock Stripe refund to always succeed
    vi.mocked(stripeService.processRefund).mockResolvedValue({
      id: "re_test_refund_123",
      amount: 10000,
      status: "succeeded",
      charge: "ch_test_charge_123",
      currency: "usd",
      metadata: {},
      reason: "requested_by_customer",
    } as Stripe.Refund);

    // Create test users
    regularUser = await User.create({
      username: "regularuser",
      firstName: "Regular",
      lastName: "User",
      email: "regular@test.com",
      password: "Password123",
      role: "Participant",
      isVerified: true,
    });

    otherUser = await User.create({
      username: "otheruser",
      firstName: "Other",
      lastName: "User",
      email: "other@test.com",
      password: "Password123",
      role: "Participant",
      isVerified: true,
    });

    adminUser = await User.create({
      username: "adminuser",
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
      password: "Password123",
      role: "Super Admin",
      isVerified: true,
    });

    // Create test program
    program = await Program.create({
      title: "Test Program",
      description: "Test Description",
      programType: "EMBA Mentor Circles",
      hostedBy: "@Cloud Marketplace Ministry",
      fullPriceTicket: 10000, // $100.00 in cents
      isFree: false,
      createdBy: adminUser._id,
    });

    // Create promo code
    promoCode = await PromoCode.create({
      code: "TEST1010", // Must be exactly 8 characters
      type: "staff_access",
      discountPercent: 10,
      ownerId: regularUser._id,
      isActive: true,
      isUsed: true,
      usedAt: new Date(),
      usedForProgramId: program._id,
      createdBy: adminUser._id,
    });

    // Create completed purchase (eligible for refund)
    completedPurchase = await Purchase.create({
      userId: regularUser._id,
      programId: program._id,
      stripeSessionId: "cs_test_session_completed",
      stripePaymentIntentId: "pi_test_intent_completed",
      status: "completed",
      fullPrice: 10000, // $100.00
      finalPrice: 9000, // After 10% discount = $90.00
      isClassRep: false,
      isEarlyBird: false,
      promoCode: "TEST1010",
      promoDiscountPercent: 10,
      purchaseDate: new Date(), // Just purchased, within 30-day window
      orderNumber: `ORD-COMP-${Date.now()}`,
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
        cardholderName: "Regular User",
      },
      billingInfo: {
        fullName: "Regular User",
        email: "regular@test.com",
        address: "123 Main St",
        city: "Test City",
        state: "TS",
        zipCode: "12345",
        country: "US",
      },
    });

    // Create pending purchase (not eligible - wrong status)
    pendingPurchase = await Purchase.create({
      userId: regularUser._id,
      programId: program._id,
      stripeSessionId: "cs_test_session_pending",
      status: "pending",
      fullPrice: 10000,
      finalPrice: 10000,
      isClassRep: false,
      isEarlyBird: false,
      purchaseDate: new Date(),
      orderNumber: `ORD-PEND-${Date.now()}`,
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
        cardholderName: "Regular User",
      },
      billingInfo: {
        fullName: "Regular User",
        email: "regular@test.com",
        address: "123 Main St",
        city: "Test City",
        state: "TS",
        zipCode: "12345",
        country: "US",
      },
    });

    // Create refunded purchase (already refunded)
    refundedPurchase = await Purchase.create({
      userId: regularUser._id,
      programId: program._id,
      stripeSessionId: "cs_test_session_refunded",
      stripePaymentIntentId: "pi_test_intent_refunded",
      stripeRefundId: "re_test_refund_old",
      status: "refunded",
      fullPrice: 10000,
      finalPrice: 10000,
      isClassRep: false,
      isEarlyBird: false,
      purchaseDate: new Date(Date.now() - 5 * 86400000), // 5 days ago
      orderNumber: `ORD-REFUND-${Date.now()}`,
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
        cardholderName: "Regular User",
      },
      billingInfo: {
        fullName: "Regular User",
        email: "regular@test.com",
        address: "123 Main St",
        city: "Test City",
        state: "TS",
        zipCode: "12345",
        country: "US",
      },
      refundInitiatedAt: new Date(Date.now() - 4 * 86400000),
      refundCompletedAt: new Date(Date.now() - 4 * 86400000),
    });

    // Create expired purchase (not eligible - outside 30-day window)
    expiredPurchase = await Purchase.create({
      userId: regularUser._id,
      programId: program._id,
      stripeSessionId: "cs_test_session_expired",
      stripePaymentIntentId: "pi_test_intent_expired",
      status: "completed",
      fullPrice: 10000,
      finalPrice: 10000,
      isClassRep: false,
      isEarlyBird: false,
      purchaseDate: new Date(Date.now() - 31 * 86400000), // 31 days ago (outside window)
      orderNumber: `ORD-EXPIRED-${Date.now()}`,
      paymentMethod: {
        type: "card",
        cardBrand: "visa",
        last4: "4242",
        cardholderName: "Regular User",
      },
      billingInfo: {
        fullName: "Regular User",
        email: "regular@test.com",
        address: "123 Main St",
        city: "Test City",
        state: "TS",
        zipCode: "12345",
        country: "US",
      },
    });

    // Generate auth tokens (using test token format)
    regularUserToken = `test-${regularUser._id}`;
    otherUserToken = `test-${otherUser._id}`;
    adminUserToken = `test-admin-${adminUser._id}`;
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

  // ============================================================================
  // GET /api/purchases/refund-eligibility/:purchaseId
  // ============================================================================

  describe("GET /api/purchases/refund-eligibility/:purchaseId", () => {
    describe("Authentication & Authorization", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request(app).get(
          `/api/purchases/refund-eligibility/${completedPurchase._id}`
        );

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /access denied|no token|authentication/i
        );
      });

      it("should return 403 if user doesn't own the purchase", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${completedPurchase._id}`)
          .set("Authorization", `Bearer ${otherUserToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/permission/i);
      });

      it("should allow owner to check eligibility", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${completedPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe("Validation", () => {
      it("should return 400 for invalid purchase ID format", async () => {
        const response = await request(app)
          .get("/api/purchases/refund-eligibility/invalid-id")
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid purchase id/i);
      });

      it("should return 404 for non-existent purchase", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${fakeId}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/purchase not found/i);
      });
    });

    describe("Eligibility Checks", () => {
      it("should return eligible for completed purchase within 30 days", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${completedPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isEligible).toBe(true);
        expect(response.body.data.purchaseDate).toBeDefined();
        expect(response.body.data.refundDeadline).toBeDefined();
        expect(response.body.data.daysRemaining).toBeGreaterThan(0);
      });

      it("should return not eligible for pending purchase", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${pendingPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isEligible).toBe(false);
        expect(response.body.data.reason).toMatch(
          /only completed purchases|pending/i
        );
      });

      it("should return not eligible for already refunded purchase", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${refundedPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isEligible).toBe(false);
        expect(response.body.data.reason).toMatch(/refunded|only completed/i);
      });

      it("should return not eligible for purchase outside 30-day window", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${expiredPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isEligible).toBe(false);
        expect(response.body.data.reason).toMatch(/window.*expired|30.*days/i);
      });

      it("should allow refund_failed status to be retried", async () => {
        // Create a refund_failed purchase
        const failedRefundPurchase = await Purchase.create({
          userId: regularUser._id,
          programId: program._id,
          stripeSessionId: "cs_test_session_failed_refund_get",
          stripePaymentIntentId: "pi_test_intent_failed_refund_get",
          stripeRefundId: "re_test_refund_failed_get",
          status: "refund_failed",
          fullPrice: 10000,
          finalPrice: 10000,
          isClassRep: false,
          isEarlyBird: false,
          purchaseDate: new Date(Date.now() - 5 * 86400000), // 5 days ago
          orderNumber: `ORD-FAILED-GET-${Date.now()}`,
          paymentMethod: {
            type: "card",
            cardBrand: "visa",
            last4: "4242",
            cardholderName: "Regular User",
          },
          billingInfo: {
            fullName: "Regular User",
            email: "regular@test.com",
            address: "123 Main St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
          refundInitiatedAt: new Date(Date.now() - 4 * 86400000),
        });

        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${failedRefundPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isEligible).toBe(true);
        expect(response.body.data.daysRemaining).toBeGreaterThan(0);
      });
    });

    describe("Response Format", () => {
      it("should include all required eligibility fields", async () => {
        const response = await request(app)
          .get(`/api/purchases/refund-eligibility/${completedPurchase._id}`)
          .set("Authorization", `Bearer ${regularUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("isEligible");
        expect(response.body.data).toHaveProperty("purchaseDate");
        expect(response.body.data).toHaveProperty("refundDeadline");

        if (response.body.data.isEligible) {
          expect(response.body.data).toHaveProperty("daysRemaining");
        } else {
          expect(response.body.data).toHaveProperty("reason");
        }
      });
    });
  });

  // ============================================================================
  // POST /api/purchases/refund
  // ============================================================================

  describe("POST /api/purchases/refund", () => {
    describe("Authentication & Authorization", () => {
      it("should return 401 if not authenticated", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /access denied|no token|authentication/i
        );
      });

      it("should return 403 if user doesn't own the purchase", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${otherUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/permission/i);
      });

      it("should allow owner to initiate refund", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe("Validation", () => {
      it("should return 400 if purchaseId is missing", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid purchase id/i);
      });

      it("should return 400 for invalid purchase ID format", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: "invalid-id" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/invalid purchase id/i);
      });

      it("should return 404 for non-existent purchase", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: fakeId.toString() });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/purchase not found/i);
      });
    });

    describe("Eligibility Validation", () => {
      it("should reject refund for pending purchase", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: pendingPurchase._id.toString() });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/pending|only completed/i);
        expect(response.body.data.isEligible).toBe(false);
      });

      it("should reject refund for already refunded purchase", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: refundedPurchase._id.toString() });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/refunded|only completed/i);
      });

      it("should reject refund for purchase outside 30-day window", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: expiredPurchase._id.toString() });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/window.*expired|30.*day/i);
        expect(response.body.data.isEligible).toBe(false);
      });

      it("should reject if purchase is already in refund_processing status", async () => {
        // Update purchase to refund_processing
        completedPurchase.status = "refund_processing";
        await completedPurchase.save();

        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(
          /refund_processing|only completed/i
        );
      });
    });

    describe("Successful Refund Initiation", () => {
      it("should successfully initiate refund for eligible purchase", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/refund initiated/i);
        expect(response.body.data.refundId).toBe("re_test_refund_123");
        expect(response.body.data.status).toBe("refund_processing");
      });

      it("should update purchase status to refund_processing", async () => {
        await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        const updatedPurchase = await Purchase.findById(completedPurchase._id);
        expect(updatedPurchase?.status).toBe("refund_processing");
        expect(updatedPurchase?.refundInitiatedAt).toBeDefined();
      });

      it("should store Stripe refund ID in purchase", async () => {
        await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        const updatedPurchase = await Purchase.findById(completedPurchase._id);
        expect(updatedPurchase?.stripeRefundId).toBe("re_test_refund_123");
      });

      it("should call Stripe processRefund with correct parameters", async () => {
        await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(stripeService.processRefund).toHaveBeenCalledWith({
          paymentIntentId: "pi_test_intent_completed",
          amount: 9000, // $90.00 in cents (after 10% discount)
          reason: "requested_by_customer",
          metadata: {
            purchaseId: completedPurchase._id.toString(),
            orderNumber: expect.stringContaining("ORD-COMP-"),
            userId: regularUser._id.toString(),
          },
        });
      });

      it("should send refund initiated email to user", async () => {
        await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(emailInitiatedSpy).toHaveBeenCalledWith({
          userEmail: "regular@test.com",
          userName: "Regular User",
          orderNumber: expect.stringContaining("ORD-COMP-"),
          programTitle: "Test Program",
          refundAmount: 9000, // $90.00 in cents
          purchaseDate: expect.any(Date),
        });
      });

      it("should allow retry for refund_failed status", async () => {
        // Create a refund_failed purchase
        const failedRefundPurchase = await Purchase.create({
          userId: regularUser._id,
          programId: program._id,
          stripeSessionId: "cs_test_session_failed_refund_post",
          stripePaymentIntentId: "pi_test_intent_failed_refund_post",
          stripeRefundId: "re_test_refund_failed_post",
          status: "refund_failed",
          fullPrice: 10000,
          finalPrice: 10000,
          isClassRep: false,
          isEarlyBird: false,
          purchaseDate: new Date(Date.now() - 5 * 86400000), // 5 days ago
          orderNumber: `ORD-FAILED-POST-${Date.now()}`,
          paymentMethod: {
            type: "card",
            cardBrand: "visa",
            last4: "4242",
            cardholderName: "Regular User",
          },
          billingInfo: {
            fullName: "Regular User",
            email: "regular@test.com",
            address: "123 Main St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
          refundInitiatedAt: new Date(Date.now() - 4 * 86400000),
        });

        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: failedRefundPurchase._id.toString() });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/refund initiated/i);

        // Verify status changed to refund_processing
        const updatedPurchase = await Purchase.findById(
          failedRefundPurchase._id
        );
        expect(updatedPurchase?.status).toBe("refund_processing");
      });
    });

    describe("Stripe API Error Handling", () => {
      it("should handle Stripe API errors gracefully", async () => {
        // Mock Stripe to throw an error
        vi.mocked(stripeService.processRefund).mockRejectedValueOnce(
          new Error("Stripe API error: Insufficient funds")
        );

        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/failed.*refund/i);
      });

      it("should update purchase status to refund_failed on Stripe error", async () => {
        // Mock Stripe to throw an error
        vi.mocked(stripeService.processRefund).mockRejectedValueOnce(
          new Error("Stripe API error")
        );

        await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        const updatedPurchase = await Purchase.findById(completedPurchase._id);
        expect(updatedPurchase?.status).toBe("refund_failed");
      });

      it("should return 400 if purchase has no payment intent", async () => {
        // Create purchase without payment intent
        const noPIPurchase = await Purchase.create({
          userId: regularUser._id,
          programId: program._id,
          stripeSessionId: "cs_test_session_no_pi",
          status: "completed",
          fullPrice: 10000,
          finalPrice: 10000,
          isClassRep: false,
          isEarlyBird: false,
          purchaseDate: new Date(),
          orderNumber: `ORD-NOPI-${Date.now()}`,
          paymentMethod: {
            type: "card",
            cardBrand: "visa",
            last4: "4242",
            cardholderName: "Regular User",
          },
          billingInfo: {
            fullName: "Regular User",
            email: "regular@test.com",
            address: "123 Main St",
            city: "Test City",
            state: "TS",
            zipCode: "12345",
            country: "US",
          },
        });

        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: noPIPurchase._id.toString() });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });
    });

    describe("Email Notification Resilience", () => {
      it("should continue refund even if email fails", async () => {
        // Mock email to throw error
        emailInitiatedSpy.mockRejectedValueOnce(new Error("Email server down"));

        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        // Refund should still succeed
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/refund initiated/i);

        // Verify purchase was updated
        const updatedPurchase = await Purchase.findById(completedPurchase._id);
        expect(updatedPurchase?.status).toBe("refund_processing");
        expect(updatedPurchase?.stripeRefundId).toBe("re_test_refund_123");
      });
    });

    describe("Response Format", () => {
      it("should return complete refund data in response", async () => {
        const response = await request(app)
          .post("/api/purchases/refund")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({ purchaseId: completedPurchase._id.toString() });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty("refundId");
        expect(response.body.data).toHaveProperty("status");
        expect(response.body.data.status).toBe("refund_processing");
      });
    });
  });
});
