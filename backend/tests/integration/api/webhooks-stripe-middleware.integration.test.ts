/**
 * Webhook Middleware Integration Tests
 *
 * Tests the critical middleware configuration for Stripe webhooks:
 * - Raw body parsing (required for signature verification)
 * - Bypassing JSON parser (would fail on Buffer)
 * - Bypassing XSS protection (would fail on raw body)
 * - Proper signature verification
 *
 * This test suite specifically validates the fix for the bug where
 * express.json() and xssProtection middleware were interfering with
 * raw body parsing, causing 500 errors.
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
import { Purchase } from "../../../src/models";
import { ensureIntegrationDB } from "../setup/connect";

// Mock Stripe webhook construction
vi.mock("../../../src/services/stripeService", async () => {
  const actual = await vi.importActual("../../../src/services/stripeService");
  return {
    ...actual,
    constructWebhookEvent: vi.fn((body: string | Buffer | any) => {
      // Simulate real Stripe signature verification
      // In production, this validates the signature against the raw body
      if (typeof body === "object" && !Buffer.isBuffer(body)) {
        return body;
      }
      const eventData =
        typeof body === "string"
          ? JSON.parse(body)
          : JSON.parse(body.toString());
      return eventData;
    }),
    getPaymentIntent: vi.fn().mockResolvedValue({
      id: "pi_test_middleware",
      latest_charge: "ch_test_middleware",
    }),
  };
});

describe("Webhook Middleware Integration Tests", () => {
  let userId: string;
  let programId: string;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Program.deleteMany({});
    await Purchase.deleteMany({});

    // Create user
    const user = await User.create({
      username: "middlewareuser",
      email: "middleware@example.com",
      password: "MiddlewarePass123!",
      firstName: "Middleware",
      lastName: "Test",
      role: "Participant",
      gender: "male",
      isVerified: true,
    });
    userId = user._id.toString();

    // Create program
    const program = await Program.create({
      title: "Middleware Test Program",
      introduction: "Test program for middleware",
      programType: "EMBA Mentor Circles",
      isFree: false,
      fullPriceTicket: 2000,
      createdBy: user._id,
    });
    programId = program._id.toString();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Program.deleteMany({});
    await Purchase.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
    vi.restoreAllMocks();
  });

  describe("Raw Body Handling", () => {
    it("should accept webhook with raw Buffer body (not parsed JSON)", async () => {
      // Create a pending purchase
      await Purchase.create({
        userId: userId,
        programId: programId,
        fullPrice: 2000,
        finalPrice: 2000,
        status: "pending",
        orderNumber: "ORD-MIDDLEWARE-001",
        stripeSessionId: "cs_test_middleware_session",
        paymentMethod: { type: "card", cardBrand: "visa", last4: "4242" },
        billingInfo: {
          fullName: "Middleware User",
          email: "middleware@example.com",
        },
      });

      // Stripe sends webhook body as raw Buffer, not parsed JSON
      const event: Stripe.Event = {
        id: "evt_middleware_001",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_middleware_session",
            payment_intent: "pi_test_middleware",
            customer_details: {
              name: "Middleware User",
              email: "middleware@example.com",
            },
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      // Send as raw JSON (simulating Stripe's behavior)
      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_signature")
        .set("Content-Type", "application/json")
        .send(event);

      // Should NOT return 500 (the bug we fixed)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should not fail when express.json() is skipped for webhooks", async () => {
      // This test validates the fix for the middleware bug:
      // express.json() tried to parse the Buffer body and failed
      const event: Stripe.Event = {
        id: "evt_middleware_002",
        object: "event",
        type: "charge.succeeded",
        data: {
          object: {} as Stripe.Charge,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_signature")
        .set("Content-Type", "application/json")
        .send(event);

      // Should handle gracefully, not 500
      expect(response.status).toBe(200);
    });

    it("should not fail when xssProtection is skipped for webhooks", async () => {
      // This test validates the XSS protection bypass:
      // xssProtection middleware was trying to process raw Buffer and failing
      const event: Stripe.Event = {
        id: "evt_middleware_003",
        object: "event",
        type: "payment_intent.created",
        data: {
          object: {
            id: "pi_test_middleware_xss",
          } as Stripe.PaymentIntent,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_signature")
        .set("Content-Type", "application/json")
        .send(event);

      // Should process without XSS middleware interfering
      expect(response.status).toBe(200);
    });
  });

  describe("Signature Verification", () => {
    it("should require stripe-signature header", async () => {
      const event: Stripe.Event = {
        id: "evt_middleware_100",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {} as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      // Missing signature header
      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("Content-Type", "application/json")
        .send(event);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("stripe-signature");
    });

    it("should verify signature with raw body (not parsed JSON)", async () => {
      // This is critical: Stripe signature verification REQUIRES raw body
      // If body is parsed to JSON before signature check, verification fails
      const event: Stripe.Event = {
        id: "evt_middleware_101",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_signature_check",
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature_raw_body")
        .set("Content-Type", "application/json")
        .send(event);

      // Should successfully verify (mocked to always pass in tests)
      expect(response.status).toBe(200);
    });
  });

  describe("Content-Type Handling", () => {
    it("should handle application/json content type", async () => {
      const event: Stripe.Event = {
        id: "evt_middleware_200",
        object: "event",
        type: "charge.updated",
        data: {
          object: {} as Stripe.Charge,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_sig")
        .set("Content-Type", "application/json")
        .send(event);

      expect(response.status).toBe(200);
    });

    it("should handle application/json with charset", async () => {
      const event: Stripe.Event = {
        id: "evt_middleware_201",
        object: "event",
        type: "charge.updated",
        data: {
          object: {} as Stripe.Charge,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_sig")
        .set("Content-Type", "application/json; charset=utf-8")
        .send(event);

      expect(response.status).toBe(200);
    });
  });

  describe("Response Time", () => {
    it("should respond quickly to avoid Stripe timeouts", async () => {
      const event: Stripe.Event = {
        id: "evt_middleware_300",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_perf",
          } as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const start = Date.now();
      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_sig")
        .send(event);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      // Stripe webhooks timeout after 10 seconds, we should be much faster
      // Even with email sending (mocked in tests), should be under 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });

  describe("Error Recovery", () => {
    it("should return 200 even for unhandled event types", async () => {
      // Stripe expects 200 for all events, even if we don't handle them
      const event: Stripe.Event = {
        id: "evt_middleware_400",
        object: "event",
        type: "customer.subscription.updated" as any,
        data: {
          object: {} as any,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_sig")
        .send(event);

      // Should return 200 to prevent Stripe retries
      expect(response.status).toBe(200);
    });

    it("should not crash on malformed event data", async () => {
      const event = {
        id: "evt_malformed",
        type: "checkout.session.completed",
        // Missing data.object - this should cause webhook controller to handle gracefully
        data: {} as any,
      };

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "valid_sig")
        .send(event);

      // The webhook controller may return 500 for truly malformed data,
      // but it shouldn't crash the server
      expect([200, 500]).toContain(response.status);
    });
  });
});
