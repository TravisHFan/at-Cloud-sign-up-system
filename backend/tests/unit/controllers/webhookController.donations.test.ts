/**
 * Tests for WebhookController - Donation-related webhook events
 * Covers: invoice.payment_succeeded, invoice.payment_failed,
 * customer.subscription.updated, customer.subscription.deleted
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import { WebhookController } from "../../../src/controllers/webhookController";
import * as stripeService from "../../../src/services/stripeService";
import Stripe from "stripe";

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

// Mock DonationWebhookController
vi.mock("../../../src/controllers/donations/DonationWebhookController", () => ({
  default: {
    handleInvoicePaymentSucceeded: vi.fn().mockResolvedValue(undefined),
    handleInvoicePaymentFailed: vi.fn().mockResolvedValue(undefined),
    handleSubscriptionUpdated: vi.fn().mockResolvedValue(undefined),
    handleSubscriptionDeleted: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("WebhookController - Donation Events", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: "raw_body",
      headers: { "stripe-signature": "valid_signature" },
    };

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    process.env.FRONTEND_URL = "http://localhost:5173";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createStripeEvent = (type: string, dataObject: unknown): Stripe.Event =>
    ({
      id: "evt_test123",
      object: "event",
      api_version: "2022-11-15",
      created: Date.now(),
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: type,
      data: {
        object: dataObject,
      },
    }) as unknown as Stripe.Event;

  describe("invoice.payment_succeeded", () => {
    it("should delegate to DonationWebhookController.handleInvoicePaymentSucceeded", async () => {
      const invoice = {
        id: "in_test123",
        customer: "cus_test123",
        subscription: "sub_test123",
        amount_paid: 5000,
        status: "paid",
      } as unknown as Stripe.Invoice;

      const event = createStripeEvent("invoice.payment_succeeded", invoice);

      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);

      await WebhookController.handleStripeWebhook(
        mockReq as Request,
        mockRes as Response,
      );

      const { default: DonationWebhookController } =
        await import("../../../src/controllers/donations/DonationWebhookController");

      expect(
        DonationWebhookController.handleInvoicePaymentSucceeded,
      ).toHaveBeenCalledWith(invoice);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("invoice.payment_failed", () => {
    it("should delegate to DonationWebhookController.handleInvoicePaymentFailed", async () => {
      const invoice = {
        id: "in_test456",
        customer: "cus_test456",
        subscription: "sub_test456",
        amount_due: 5000,
        status: "open",
      } as unknown as Stripe.Invoice;

      const event = createStripeEvent("invoice.payment_failed", invoice);

      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);

      await WebhookController.handleStripeWebhook(
        mockReq as Request,
        mockRes as Response,
      );

      const { default: DonationWebhookController } =
        await import("../../../src/controllers/donations/DonationWebhookController");

      expect(
        DonationWebhookController.handleInvoicePaymentFailed,
      ).toHaveBeenCalledWith(invoice);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("customer.subscription.updated", () => {
    it("should delegate to DonationWebhookController.handleSubscriptionUpdated", async () => {
      const subscription = {
        id: "sub_test789",
        customer: "cus_test789",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      } as unknown as Stripe.Subscription;

      const event = createStripeEvent(
        "customer.subscription.updated",
        subscription,
      );

      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);

      await WebhookController.handleStripeWebhook(
        mockReq as Request,
        mockRes as Response,
      );

      const { default: DonationWebhookController } =
        await import("../../../src/controllers/donations/DonationWebhookController");

      expect(
        DonationWebhookController.handleSubscriptionUpdated,
      ).toHaveBeenCalledWith(subscription);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("customer.subscription.deleted", () => {
    it("should delegate to DonationWebhookController.handleSubscriptionDeleted", async () => {
      const subscription: Partial<Stripe.Subscription> = {
        id: "sub_test_cancel",
        customer: "cus_test_cancel",
        status: "canceled",
      };

      const event = createStripeEvent(
        "customer.subscription.deleted",
        subscription,
      );

      vi.mocked(stripeService.constructWebhookEvent).mockReturnValue(event);

      await WebhookController.handleStripeWebhook(
        mockReq as Request,
        mockRes as Response,
      );

      const { default: DonationWebhookController } =
        await import("../../../src/controllers/donations/DonationWebhookController");

      expect(
        DonationWebhookController.handleSubscriptionDeleted,
      ).toHaveBeenCalledWith(subscription);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
