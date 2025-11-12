import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Types } from "mongoose";
import type Stripe from "stripe";

// Mock models and services
const mockFindById = vi.fn();
const mockDonationFindOne = vi.fn();
const mockTransactionFindOne = vi.fn();
const mockSave = vi.fn();
const mockCreate = vi.fn();
const mockRecordTransaction = vi.fn();
const mockGetPaymentIntent = vi.fn();
const mockStripeRetrieve = vi.fn();
const mockStripeUpdate = vi.fn();

vi.mock("../../../src/models/Donation", () => ({
  default: {
    findById: (...args: any[]) => mockFindById(...args),
    findOne: (...args: any[]) => mockDonationFindOne(...args),
  },
}));

vi.mock("../../../src/models/DonationTransaction", () => ({
  default: {
    create: (...args: any[]) => mockCreate(...args),
    findOne: (...args: any[]) => mockTransactionFindOne(...args),
  },
}));

vi.mock("../../../src/services/DonationService", () => ({
  default: {
    recordTransaction: (...args: any[]) => mockRecordTransaction(...args),
  },
}));

vi.mock("../../../src/services/stripeService", () => ({
  getPaymentIntent: (...args: any[]) => mockGetPaymentIntent(...args),
  stripe: {
    subscriptions: {
      retrieve: (...args: any[]) => mockStripeRetrieve(...args),
      update: (...args: any[]) => mockStripeUpdate(...args),
    },
    charges: {
      retrieve: (...args: any[]) => mockStripeRetrieve(...args),
    },
  },
}));

import DonationWebhookController from "../../../src/controllers/donations/DonationWebhookController";

describe("DonationWebhookController", () => {
  const mockUserId = new Types.ObjectId();
  const mockDonationId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleDonationCheckout", () => {
    it("should process one-time donation checkout successfully", async () => {
      const mockSession = {
        id: "cs_test_123",
        mode: "payment",
        customer: "cus_test_123",
        payment_intent: "pi_test_123",
        metadata: {
          donationId: mockDonationId.toString(),
          userId: mockUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "one-time",
        status: "pending",
        stripeCustomerId: "pending",
        save: mockSave,
      };

      mockFindById.mockResolvedValue(mockDonation);
      mockGetPaymentIntent.mockResolvedValue({
        id: "pi_test_123",
        latest_charge: "ch_test_123",
      });
      mockStripeRetrieve.mockResolvedValue({
        payment_method_details: {
          card: {
            brand: "visa",
            last4: "4242",
          },
        },
      });
      mockRecordTransaction.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleDonationCheckout(mockSession);

      expect(mockFindById).toHaveBeenCalledWith(mockDonationId.toString());
      expect(mockDonation.stripeCustomerId).toBe("cus_test_123");
      expect(mockDonation.status).toBe("completed");
      expect(mockRecordTransaction).toHaveBeenCalledWith({
        donationId: mockDonationId.toString(),
        userId: mockUserId.toString(),
        amount: 5000,
        type: "one-time",
        stripePaymentIntentId: "pi_test_123",
        paymentMethod: {
          cardBrand: "visa",
          last4: "4242",
        },
      });
      expect(mockSave).toHaveBeenCalled();
    });

    it("should process recurring donation checkout successfully", async () => {
      const mockSession = {
        id: "cs_test_456",
        mode: "subscription",
        customer: "cus_test_456",
        subscription: "sub_test_456",
        metadata: {
          donationId: mockDonationId.toString(),
          userId: mockUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 10000,
        type: "recurring",
        frequency: "monthly",
        status: "pending",
        stripeCustomerId: "pending",
        stripeSubscriptionId: undefined,
        save: mockSave,
      };

      mockFindById.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleDonationCheckout(mockSession);

      expect(mockDonation.stripeCustomerId).toBe("cus_test_456");
      expect(mockDonation.stripeSubscriptionId).toBe("sub_test_456");
      expect(mockDonation.status).toBe("active");

      // CRITICAL: Verify no transaction recorded for subscription in checkout
      // Transaction will be recorded by invoice.payment_succeeded webhook
      expect(mockRecordTransaction).not.toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it("should schedule subscription cancellation if end date exists", async () => {
      const endDate = new Date("2025-12-31");
      const mockSession = {
        id: "cs_test_789",
        mode: "subscription",
        customer: "cus_test_789",
        subscription: "sub_test_789",
        metadata: {
          donationId: mockDonationId.toString(),
          userId: mockUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 10000,
        type: "recurring",
        status: "pending",
        endDate: endDate,
        save: mockSave,
      };

      mockFindById.mockResolvedValue(mockDonation);
      mockStripeRetrieve.mockResolvedValue({ default_payment_method: null });
      mockRecordTransaction.mockResolvedValue({});
      mockStripeUpdate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleDonationCheckout(mockSession);

      const expectedCancelAt = Math.floor(endDate.getTime() / 1000);
      expect(mockStripeUpdate).toHaveBeenCalledWith("sub_test_789", {
        cancel_at: expectedCancelAt,
      });
    });

    it("should return early if donation not found", async () => {
      const mockSession = {
        id: "cs_test_404",
        metadata: {
          donationId: "nonexistent",
          userId: mockUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      mockFindById.mockResolvedValue(null);

      await DonationWebhookController.handleDonationCheckout(mockSession);

      expect(mockSave).not.toHaveBeenCalled();
      expect(mockRecordTransaction).not.toHaveBeenCalled();
    });

    it("should return early if metadata is missing", async () => {
      const mockSession = {
        id: "cs_test_400",
        metadata: {},
      } as unknown as Stripe.Checkout.Session;

      await DonationWebhookController.handleDonationCheckout(mockSession);

      expect(mockFindById).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully when fetching payment method", async () => {
      const mockSession = {
        id: "cs_test_error",
        mode: "payment",
        customer: "cus_test_error",
        payment_intent: "pi_test_error",
        metadata: {
          donationId: mockDonationId.toString(),
          userId: mockUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "one-time",
        status: "pending",
        save: mockSave,
      };

      mockFindById.mockResolvedValue(mockDonation);
      mockGetPaymentIntent.mockRejectedValue(new Error("Stripe API error"));
      mockRecordTransaction.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      // Should not throw, just continue without payment method details
      await expect(
        DonationWebhookController.handleDonationCheckout(mockSession)
      ).resolves.not.toThrow();

      expect(mockRecordTransaction).toHaveBeenCalledWith({
        donationId: mockDonationId.toString(),
        userId: mockUserId.toString(),
        amount: 5000,
        type: "one-time",
        stripePaymentIntentId: "pi_test_error",
        paymentMethod: {},
      });
    });
  });

  describe("handleInvoicePaymentSucceeded", () => {
    it("should record transaction for successful recurring payment", async () => {
      const mockInvoice = {
        id: "in_test_123",
        subscription: "sub_test_123",
        amount_paid: 10000,
        payment_intent: "pi_test_recurring",
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 10000,
        type: "recurring",
        stripeSubscriptionId: "sub_test_123",
        save: mockSave,
      };

      // DonationTransaction.findOne (duplicate check) - return null
      mockTransactionFindOne.mockResolvedValue(null);
      // Donation.findOne (find donation by subscription) - return donation
      mockDonationFindOne.mockResolvedValue(mockDonation);

      mockGetPaymentIntent.mockResolvedValue({
        id: "pi_test_recurring",
        latest_charge: "ch_test_recurring",
      });
      mockStripeRetrieve.mockResolvedValue({
        payment_method_details: {
          card: { brand: "visa", last4: "4242" },
        },
      });
      mockRecordTransaction.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentSucceeded(
        mockInvoice
      );

      expect(mockTransactionFindOne).toHaveBeenCalled();
      expect(mockDonationFindOne).toHaveBeenCalled();
      expect(mockRecordTransaction).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it("should skip if no subscription ID in invoice", async () => {
      const mockInvoice = {
        id: "in_test_nosu",
        subscription: null,
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(
        mockInvoice
      );

      expect(mockDonationFindOne).not.toHaveBeenCalled();
    });

    it("should skip if donation not found", async () => {
      const mockInvoice = {
        id: "in_test_404",
        subscription: "sub_nonexistent",
        payment_intent: "pi_test",
      } as unknown as Stripe.Invoice;

      mockDonationFindOne.mockResolvedValue(null);

      await DonationWebhookController.handleInvoicePaymentSucceeded(
        mockInvoice
      );

      expect(mockRecordTransaction).not.toHaveBeenCalled();
    });
  });

  describe("handleInvoicePaymentFailed", () => {
    it("should mark donation as failed", async () => {
      const mockInvoice = {
        id: "in_test_fail",
        subscription: "sub_test_fail",
        amount_due: 10000,
        payment_intent: null,
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 10000,
        type: "recurring",
        stripeSubscriptionId: "sub_test_fail",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue({ ...mockDonation, status: "failed" });

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockDonation.status).toBe("failed");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should skip if donation not found", async () => {
      const mockInvoice = {
        id: "in_test_404",
        subscription: "sub_nonexistent",
      } as unknown as Stripe.Invoice;

      mockDonationFindOne.mockResolvedValue(null);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    it("should resume donation when subscription resumed", async () => {
      const mockSubscription = {
        id: "sub_test_resume",
        status: "active",
        pause_collection: null,
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "on_hold",
        stripeSubscriptionId: "sub_test_resume",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription
      );

      expect(mockDonation.status).toBe("active");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should pause donation when subscription paused", async () => {
      const mockSubscription = {
        id: "sub_test_pause",
        status: "active",
        pause_collection: { behavior: "void" },
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "active",
        stripeSubscriptionId: "sub_test_pause",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription
      );

      expect(mockDonation.status).toBe("on_hold");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should skip if donation not found", async () => {
      const mockSubscription = {
        id: "sub_nonexistent",
        status: "active",
      } as Stripe.Subscription;

      mockDonationFindOne.mockResolvedValue(null);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription
      );

      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionDeleted", () => {
    it("should cancel donation when subscription deleted", async () => {
      const mockSubscription = {
        id: "sub_test_delete",
        status: "canceled",
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "active",
        stripeSubscriptionId: "sub_test_delete",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionDeleted(
        mockSubscription
      );

      expect(mockDonation.status).toBe("cancelled");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should skip if donation not found", async () => {
      const mockSubscription = {
        id: "sub_nonexistent",
        status: "canceled",
      } as Stripe.Subscription;

      mockDonationFindOne.mockResolvedValue(null);

      await DonationWebhookController.handleSubscriptionDeleted(
        mockSubscription
      );

      expect(mockSave).not.toHaveBeenCalled();
    });
  });
});
