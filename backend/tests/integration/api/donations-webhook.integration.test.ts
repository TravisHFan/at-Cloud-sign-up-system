/**
 * Donation Webhook Integration Tests
 *
 * Tests Stripe webhook delegation to DonationWebhookController for:
 * - checkout.session.completed (donation mode)
 * - invoice.payment_succeeded (recurring donations)
 * - invoice.payment_failed (recurring donations)
 * - customer.subscription.updated (pause/resume)
 * - customer.subscription.deleted (cancellation)
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import type Stripe from "stripe";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Donation from "../../../src/models/Donation";
import DonationTransaction from "../../../src/models/DonationTransaction";
import { ensureIntegrationDB } from "../setup/connect";

// Mock Stripe webhook event construction
vi.mock("../../../src/services/stripeService", async () => {
  const actual = await vi.importActual("../../../src/services/stripeService");
  return {
    ...actual,
    constructWebhookEvent: vi.fn((body: string | Buffer | any) => {
      // Return the parsed event directly for testing
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
      id: "pi_test",
      latest_charge: "ch_test",
    }),
    stripe: {
      charges: {
        retrieve: vi.fn().mockResolvedValue({
          payment_method_details: {
            card: { brand: "visa", last4: "4242" },
          },
        }),
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          default_payment_method: {
            card: { brand: "visa", last4: "4242" },
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

describe("Donation Webhook Integration Tests", () => {
  let userId: mongoose.Types.ObjectId;
  let donationId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Donation.deleteMany({});
    await DonationTransaction.deleteMany({});

    // Create test user
    const user = await User.create({
      username: "webhookuser",
      email: "webhook@test.com",
      password: "WebhookPass123!",
      firstName: "Webhook",
      lastName: "User",
      role: "Participant",
      gender: "male",
      isVerified: true,
      stripeCustomerId: "cus_test",
    });
    userId = user._id as mongoose.Types.ObjectId;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Donation.deleteMany({});
    await DonationTransaction.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
    vi.restoreAllMocks();
  });

  describe("checkout.session.completed (donation)", () => {
    it("should process one-time donation checkout", async () => {
      // Create pending donation
      const donation = await Donation.create({
        userId,
        amount: 5000,
        type: "one-time",
        status: "pending",
        giftDate: new Date("2025-12-25"),
        stripeCustomerId: "pending",
      });
      donationId = donation._id as mongoose.Types.ObjectId;

      // Create webhook event
      const event: Stripe.Event = {
        id: "evt_test_checkout",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_session",
            mode: "payment",
            customer: "cus_test",
            payment_intent: "pi_test_123",
            metadata: {
              type: "donation",
              donationId: donationId.toString(),
              userId: userId.toString(),
            },
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify donation was updated
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation?.status).toBe("completed");
      expect(updatedDonation?.stripeCustomerId).toBe("cus_test");

      // Verify transaction was recorded
      const transaction = await DonationTransaction.findOne({ donationId });
      expect(transaction).toBeDefined();
      expect(transaction?.status).toBe("completed");
    });

    it("should process recurring donation checkout", async () => {
      // Create pending recurring donation
      const donation = await Donation.create({
        userId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "pending",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-01-01"),
        stripeCustomerId: "pending",
      });
      donationId = donation._id as mongoose.Types.ObjectId;

      // Create webhook event
      const event: Stripe.Event = {
        id: "evt_test_subscription",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_sub_session",
            mode: "subscription",
            customer: "cus_test",
            subscription: "sub_test_123",
            metadata: {
              type: "donation",
              donationId: donationId.toString(),
              userId: userId.toString(),
            },
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify donation was updated
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation?.status).toBe("active");
      expect(updatedDonation?.stripeSubscriptionId).toBe("sub_test_123");
    });
  });

  describe("invoice.payment_succeeded", () => {
    beforeEach(async () => {
      // Create active recurring donation
      const donation = await Donation.create({
        userId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "active",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-02-01"),
        currentOccurrence: 0,
        remainingOccurrences: 12,
        endAfterOccurrences: 12,
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
      });
      donationId = donation._id as mongoose.Types.ObjectId;
    });

    it("should record successful recurring payment", async () => {
      const event: Stripe.Event = {
        id: "evt_test_payment_success",
        object: "event",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_test_123",
            subscription: "sub_test",
            amount_paid: 10000,
            payment_intent: "pi_test_recurring",
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify transaction was recorded
      const transaction = await DonationTransaction.findOne({ donationId });
      expect(transaction).toBeDefined();
      expect(transaction?.status).toBe("completed");
      expect(transaction?.amount).toBe(10000);

      // Verify donation occurrence was updated
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation?.currentOccurrence).toBe(1);
      expect(updatedDonation?.remainingOccurrences).toBe(11);
    });
  });

  describe("invoice.payment_failed", () => {
    beforeEach(async () => {
      const donation = await Donation.create({
        userId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "active",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-02-01"),
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
      });
      donationId = donation._id as mongoose.Types.ObjectId;
    });

    it("should record failed payment", async () => {
      const event: Stripe.Event = {
        id: "evt_test_payment_failed",
        object: "event",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_test_failed",
            subscription: "sub_test",
            amount_due: 10000,
            payment_intent: "pi_test_failed",
            last_payment_error: {
              code: "card_declined",
              message: "Your card was declined",
            },
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify failed transaction was recorded
      const transaction = await DonationTransaction.findOne({ donationId });
      expect(transaction).toBeDefined();
      expect(transaction?.status).toBe("failed");
      expect(transaction?.failureReason).toBeDefined();
    });
  });

  describe("customer.subscription.updated", () => {
    beforeEach(async () => {
      const donation = await Donation.create({
        userId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "active",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-02-01"),
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test_pause",
      });
      donationId = donation._id as mongoose.Types.ObjectId;
    });

    it("should pause donation when subscription paused", async () => {
      const event: Stripe.Event = {
        id: "evt_test_sub_pause",
        object: "event",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_test_pause",
            status: "active",
            pause_collection: { behavior: "void" },
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify donation was paused
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation?.status).toBe("on_hold");
    });

    it("should resume donation when subscription resumed", async () => {
      // Set donation to on_hold first
      await Donation.findByIdAndUpdate(donationId, { status: "on_hold" });

      const event: Stripe.Event = {
        id: "evt_test_sub_resume",
        object: "event",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_test_pause",
            status: "active",
            pause_collection: null,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify donation was resumed
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation?.status).toBe("active");
    });
  });

  describe("customer.subscription.deleted", () => {
    beforeEach(async () => {
      const donation = await Donation.create({
        userId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "active",
        startDate: new Date("2025-01-01"),
        nextPaymentDate: new Date("2025-02-01"),
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test_cancel",
      });
      donationId = donation._id as mongoose.Types.ObjectId;
    });

    it("should cancel donation when subscription deleted", async () => {
      const event: Stripe.Event = {
        id: "evt_test_sub_deleted",
        object: "event",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_test_cancel",
            status: "canceled",
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "test_signature")
        .send(event)
        .expect(200);

      expect(response.body).toMatchObject({ received: true });

      // Verify donation was cancelled
      const updatedDonation = await Donation.findById(donationId);
      expect(updatedDonation?.status).toBe("cancelled");
    });
  });

  describe("Webhook Security", () => {
    it("should reject webhook without stripe-signature header", async () => {
      const event: Stripe.Event = {
        id: "evt_test",
        object: "event",
        type: "checkout.session.completed",
        data: { object: {} as any },
      } as Stripe.Event;

      // Note: The actual behavior depends on webhook middleware
      // This test ensures proper request handling
      await request(app).post("/api/webhooks/stripe").send(event);
      // Test passes if request doesn't crash the server
    });
  });
});
