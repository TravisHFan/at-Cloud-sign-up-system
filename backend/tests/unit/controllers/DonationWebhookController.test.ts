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
    vi.resetModules();
    vi.clearAllMocks();
    // Reset all module-level mocks to their default implementations
    mockFindById.mockReset();
    mockDonationFindOne.mockReset();
    mockTransactionFindOne.mockReset();
    mockSave.mockReset();
    mockCreate.mockReset();
    mockRecordTransaction.mockReset();
    mockGetPaymentIntent.mockReset();
    mockStripeRetrieve.mockReset();
    mockStripeUpdate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
        mockSubscription,
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
        mockSubscription,
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
        mockSubscription,
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
        mockSubscription,
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
        mockSubscription,
      );

      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ADDITIONAL COVERAGE TESTS
  // =========================================================================

  describe("handleInvoicePaymentFailed - additional coverage", () => {
    it("should skip if no subscription ID in invoice", async () => {
      const mockInvoice = {
        id: "in_fail_no_sub",
        subscription: null,
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockDonationFindOne).not.toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it("should handle subscription as object in failed invoice", async () => {
      const mockInvoice = {
        id: "in_fail_sub_obj",
        subscription: { id: "sub_fail_obj" }, // object
        payment_intent: "pi_fail_obj",
        last_payment_error: {
          code: "card_declined",
          message: "Your card was declined.",
        },
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 10000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_obj",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockCreate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockDonationFindOne).toHaveBeenCalledWith({
        stripeSubscriptionId: "sub_fail_obj",
      });
      expect(mockDonation.status).toBe("failed");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          failureReason: "card_declined: Your card was declined.",
        }),
      );
    });

    it("should record failed transaction with payment intent", async () => {
      const mockInvoice = {
        id: "in_fail_with_pi",
        subscription: "sub_fail_with_pi",
        payment_intent: "pi_fail_record",
        last_payment_error: {
          code: "insufficient_funds",
          message: "Insufficient funds",
        },
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 15000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_with_pi",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockCreate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockCreate).toHaveBeenCalledWith({
        donationId: mockDonationId,
        userId: mockUserId,
        amount: 15000,
        type: "recurring",
        status: "failed",
        giftDate: expect.any(Date),
        stripePaymentIntentId: "pi_fail_record",
        failureReason: "insufficient_funds: Insufficient funds",
      });
    });

    it("should handle payment_intent as object in failed invoice", async () => {
      const mockInvoice = {
        id: "in_fail_pi_obj",
        subscription: "sub_fail_pi_obj",
        payment_intent: { id: "pi_fail_obj_id" }, // object
        last_payment_error: null,
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 8000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_pi_obj",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockCreate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripePaymentIntentId: "pi_fail_obj_id",
          failureReason: "Payment failed",
        }),
      );
    });

    it("should use default failure reason when error details missing", async () => {
      const mockInvoice = {
        id: "in_fail_no_error",
        subscription: "sub_fail_no_error",
        payment_intent: "pi_fail_no_error",
        // No last_payment_error
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 5000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_no_error",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockCreate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: "Payment failed",
        }),
      );
    });

    it("should handle failure with code but no message", async () => {
      const mockInvoice = {
        id: "in_fail_code_only",
        subscription: "sub_fail_code_only",
        payment_intent: "pi_fail_code_only",
        last_payment_error: {
          code: "expired_card",
          // No message
        },
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 12000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_code_only",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockCreate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: "expired_card: Payment failed",
        }),
      );
    });

    it("should handle failure with message but no code", async () => {
      const mockInvoice = {
        id: "in_fail_msg_only",
        subscription: "sub_fail_msg_only",
        payment_intent: "pi_fail_msg_only",
        last_payment_error: {
          // No code
          message: "Card processing error",
        },
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 9000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_msg_only",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockCreate.mockResolvedValue({});
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: "unknown: Card processing error",
        }),
      );
    });

    it("should not create transaction when payment_intent is missing", async () => {
      const mockInvoice = {
        id: "in_fail_no_pi",
        subscription: "sub_fail_no_pi",
        // No payment_intent
      } as unknown as Stripe.Invoice;

      const mockDonation = {
        _id: mockDonationId,
        userId: mockUserId,
        amount: 7000,
        type: "recurring",
        stripeSubscriptionId: "sub_fail_no_pi",
        status: "active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleInvoicePaymentFailed(mockInvoice);

      expect(mockDonation.status).toBe("failed");
      expect(mockSave).toHaveBeenCalled();
      // Should NOT create transaction without payment_intent
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionUpdated - additional coverage", () => {
    it("should update next payment date from current_period_end", async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
      const mockSubscription = {
        id: "sub_period_end",
        status: "active",
        pause_collection: null,
        current_period_end: periodEnd,
      } as unknown as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "active",
        stripeSubscriptionId: "sub_period_end",
        nextPaymentDate: undefined,
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription,
      );

      expect(mockDonation.nextPaymentDate).toEqual(new Date(periodEnd * 1000));
      expect(mockSave).toHaveBeenCalled();
    });

    it("should not change status when already on_hold and paused", async () => {
      const mockSubscription = {
        id: "sub_already_paused",
        status: "active",
        pause_collection: { behavior: "void" },
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "on_hold", // Already paused
        stripeSubscriptionId: "sub_already_paused",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription,
      );

      expect(mockDonation.status).toBe("on_hold"); // Unchanged
      expect(mockSave).toHaveBeenCalled();
    });

    it("should not change status when already active and not paused", async () => {
      const mockSubscription = {
        id: "sub_already_active",
        status: "active",
        pause_collection: null,
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "active", // Already active
        stripeSubscriptionId: "sub_already_active",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription,
      );

      expect(mockDonation.status).toBe("active"); // Unchanged
      expect(mockSave).toHaveBeenCalled();
    });

    it("should handle subscription with non-active status", async () => {
      const mockSubscription = {
        id: "sub_incomplete",
        status: "incomplete", // Not 'active'
        pause_collection: null,
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "on_hold",
        stripeSubscriptionId: "sub_incomplete",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription,
      );

      // Status should remain unchanged when subscription is not 'active'
      expect(mockDonation.status).toBe("on_hold");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should handle subscription update without current_period_end", async () => {
      const mockSubscription = {
        id: "sub_no_period",
        status: "active",
        pause_collection: null,
        // No current_period_end
      } as unknown as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "on_hold",
        stripeSubscriptionId: "sub_no_period",
        nextPaymentDate: new Date("2024-01-01"), // Existing date
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription,
      );

      // nextPaymentDate should remain unchanged
      expect(mockDonation.nextPaymentDate).toEqual(new Date("2024-01-01"));
    });

    it("should handle pause_collection with different behaviors", async () => {
      const mockSubscription = {
        id: "sub_pause_mark",
        status: "active",
        pause_collection: { behavior: "mark_uncollectible" },
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "active",
        stripeSubscriptionId: "sub_pause_mark",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionUpdated(
        mockSubscription,
      );

      expect(mockDonation.status).toBe("on_hold");
    });
  });

  describe("handleSubscriptionDeleted - additional coverage", () => {
    it("should cancel donation that was previously on_hold", async () => {
      const mockSubscription = {
        id: "sub_delete_on_hold",
        status: "canceled",
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "on_hold", // Was paused before deletion
        stripeSubscriptionId: "sub_delete_on_hold",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionDeleted(
        mockSubscription,
      );

      expect(mockDonation.status).toBe("cancelled");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should cancel donation that was in failed status", async () => {
      const mockSubscription = {
        id: "sub_delete_failed",
        status: "canceled",
      } as Stripe.Subscription;

      const mockDonation = {
        _id: mockDonationId,
        status: "failed", // Had failed payments
        stripeSubscriptionId: "sub_delete_failed",
        save: mockSave,
      };

      mockDonationFindOne.mockResolvedValue(mockDonation);
      mockSave.mockResolvedValue(mockDonation);

      await DonationWebhookController.handleSubscriptionDeleted(
        mockSubscription,
      );

      expect(mockDonation.status).toBe("cancelled");
    });
  });

});
