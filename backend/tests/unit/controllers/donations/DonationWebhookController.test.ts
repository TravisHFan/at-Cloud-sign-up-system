/**
 * Unit tests for DonationWebhookController
 *
 * Tests all Stripe webhook handlers for donations:
 * - handleDonationCheckout (checkout.session.completed)
 * - handleInvoicePaymentSucceeded (invoice.payment_succeeded)
 * - handleInvoicePaymentFailed (invoice.payment_failed)
 * - handleSubscriptionUpdated (customer.subscription.updated)
 * - handleSubscriptionDeleted (customer.subscription.deleted)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import Stripe from "stripe";
import DonationWebhookController from "../../../../src/controllers/donations/DonationWebhookController";

// Mock dependencies
vi.mock("../../../../src/models/Donation", () => ({
  default: {
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock("../../../../src/models/DonationTransaction", () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../../../src/services/DonationService", () => ({
  default: {
    recordTransaction: vi.fn(),
  },
}));

vi.mock("../../../../src/services/stripeService", () => ({
  getPaymentIntent: vi.fn(),
  stripe: {
    charges: {
      retrieve: vi.fn(),
    },
    customers: {
      retrieve: vi.fn(),
    },
    subscriptions: {
      update: vi.fn(),
    },
  },
}));

vi.mock("../../../../src/services/email/domains/DonationEmailService", () => ({
  DonationEmailService: {
    sendDonationReceipt: vi.fn(),
  },
}));

vi.mock("../../../../src/models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

import Donation from "../../../../src/models/Donation";
import DonationTransaction from "../../../../src/models/DonationTransaction";
import DonationService from "../../../../src/services/DonationService";
import {
  getPaymentIntent,
  stripe,
} from "../../../../src/services/stripeService";
import { DonationEmailService } from "../../../../src/services/email/domains/DonationEmailService";
import User from "../../../../src/models/User";

describe("DonationWebhookController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleDonationCheckout", () => {
    describe("metadata validation", () => {
      it("should return early if donationId is missing", async () => {
        const session = {
          metadata: { userId: "user-123" },
        } as unknown as Stripe.Checkout.Session;

        await DonationWebhookController.handleDonationCheckout(session);

        expect(Donation.findById).not.toHaveBeenCalled();
      });

      it("should return early if userId is missing", async () => {
        const session = {
          metadata: { donationId: "donation-123" },
        } as unknown as Stripe.Checkout.Session;

        await DonationWebhookController.handleDonationCheckout(session);

        expect(Donation.findById).not.toHaveBeenCalled();
      });

      it("should return early if donation is not found", async () => {
        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(null);

        await DonationWebhookController.handleDonationCheckout(session);

        expect(Donation.findById).toHaveBeenCalledWith("donation-123");
        expect(DonationService.recordTransaction).not.toHaveBeenCalled();
      });
    });

    describe("subscription mode (recurring donations)", () => {
      it("should update donation with subscription ID and set status to active", async () => {
        const mockDonation = {
          _id: "donation-123",
          amount: 5000,
          type: "recurring",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          status: "pending",
          endDate: null,
          save: vi.fn(),
        };

        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
          mode: "subscription",
          subscription: "sub_123",
          customer: "cus_123",
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(mockDonation as any);

        await DonationWebhookController.handleDonationCheckout(session);

        expect(mockDonation.stripeCustomerId).toBe("cus_123");
        expect(mockDonation.stripeSubscriptionId).toBe("sub_123");
        expect(mockDonation.status).toBe("active");
        expect(mockDonation.save).toHaveBeenCalled();
      });

      it("should schedule subscription cancellation if endDate is set", async () => {
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        const mockDonation = {
          _id: "donation-123",
          amount: 5000,
          type: "recurring",
          endDate,
          save: vi.fn(),
        };

        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
          mode: "subscription",
          subscription: "sub_123",
          customer: "cus_123",
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(mockDonation as any);
        vi.mocked(stripe.subscriptions.update).mockResolvedValue({} as any);

        await DonationWebhookController.handleDonationCheckout(session);

        expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
          cancel_at: Math.floor(endDate.getTime() / 1000),
        });
      });

      it("should handle subscription cancellation scheduling errors gracefully", async () => {
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const mockDonation = {
          _id: "donation-123",
          amount: 5000,
          type: "recurring",
          endDate,
          save: vi.fn(),
        };

        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
          mode: "subscription",
          subscription: "sub_123",
          customer: "cus_123",
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(mockDonation as any);
        vi.mocked(stripe.subscriptions.update).mockRejectedValue(
          new Error("Stripe error"),
        );

        // Should not throw
        await expect(
          DonationWebhookController.handleDonationCheckout(session),
        ).resolves.not.toThrow();

        expect(mockDonation.save).toHaveBeenCalled();
      });
    });

    describe("payment mode (one-time donations)", () => {
      it("should record transaction and send receipt email for one-time donation", async () => {
        const mockDonation = {
          _id: "donation-123",
          amount: 2500,
          type: "one-time",
          status: "pending",
          save: vi.fn(),
        };

        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
          mode: "payment",
          payment_intent: "pi_123",
          customer: "cus_123",
          customer_details: {
            email: "donor@example.com",
            name: "Test Donor",
          },
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(mockDonation as any);
        vi.mocked(getPaymentIntent).mockResolvedValue({
          latest_charge: "ch_123",
        } as any);
        vi.mocked(stripe.charges.retrieve).mockResolvedValue({
          payment_method_details: {
            card: { brand: "visa", last4: "4242" },
          },
        } as any);
        vi.mocked(DonationEmailService.sendDonationReceipt).mockResolvedValue(
          true,
        );

        await DonationWebhookController.handleDonationCheckout(session);

        expect(DonationService.recordTransaction).toHaveBeenCalledWith({
          donationId: "donation-123",
          userId: "user-123",
          amount: 2500,
          type: "one-time",
          stripePaymentIntentId: "pi_123",
          paymentMethod: { cardBrand: "visa", last4: "4242" },
        });

        expect(DonationEmailService.sendDonationReceipt).toHaveBeenCalledWith({
          email: "donor@example.com",
          name: "Test Donor",
          amount: 2500,
          type: "one-time",
          transactionDate: expect.any(Date),
          paymentMethod: { cardBrand: "visa", last4: "4242" },
        });

        expect(mockDonation.status).toBe("completed");
        expect(mockDonation.save).toHaveBeenCalled();
      });

      it("should handle payment intent fetch errors gracefully", async () => {
        const mockDonation = {
          _id: "donation-123",
          amount: 2500,
          type: "one-time",
          save: vi.fn(),
        };

        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
          mode: "payment",
          payment_intent: "pi_123",
          customer_details: { email: "donor@example.com", name: "Donor" },
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(mockDonation as any);
        vi.mocked(getPaymentIntent).mockRejectedValue(new Error("API error"));

        await expect(
          DonationWebhookController.handleDonationCheckout(session),
        ).resolves.not.toThrow();

        // Should still record transaction with empty payment method
        expect(DonationService.recordTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentMethod: {},
          }),
        );
      });

      it("should handle email sending errors gracefully", async () => {
        const mockDonation = {
          _id: "donation-123",
          amount: 2500,
          type: "one-time",
          save: vi.fn(),
        };

        const session = {
          metadata: { donationId: "donation-123", userId: "user-123" },
          mode: "payment",
          payment_intent: "pi_123",
          customer_details: { email: "donor@example.com", name: "Donor" },
        } as unknown as Stripe.Checkout.Session;

        vi.mocked(Donation.findById).mockResolvedValue(mockDonation as any);
        vi.mocked(getPaymentIntent).mockResolvedValue({} as any);
        vi.mocked(DonationEmailService.sendDonationReceipt).mockRejectedValue(
          new Error("Email error"),
        );

        // Should not throw
        await expect(
          DonationWebhookController.handleDonationCheckout(session),
        ).resolves.not.toThrow();

        expect(mockDonation.save).toHaveBeenCalled();
      });
    });
  });

  describe("handleInvoicePaymentSucceeded", () => {
    it("should return early if subscription ID is missing", async () => {
      const invoice = {} as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(Donation.findOne).not.toHaveBeenCalled();
    });

    it("should return early if donation is not found", async () => {
      const invoice = {
        subscription: "sub_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(null);

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(Donation.findOne).toHaveBeenCalledWith({
        stripeSubscriptionId: "sub_123",
      });
      expect(DonationService.recordTransaction).not.toHaveBeenCalled();
    });

    it("should skip duplicate transactions", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
      vi.mocked(DonationTransaction.findOne).mockResolvedValue({
        stripePaymentIntentId: "pi_123",
      } as any);

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(DonationService.recordTransaction).not.toHaveBeenCalled();
    });

    it("should record transaction and update lastGiftDate for recurring payment", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        frequency: "monthly",
        lastGiftDate: null,
        stripeCustomerId: "cus_123",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_123",
        charge: "ch_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
      vi.mocked(DonationTransaction.findOne).mockResolvedValue(null);
      vi.mocked(stripe.charges.retrieve).mockResolvedValue({
        payment_method_details: {
          card: { brand: "mastercard", last4: "5678" },
        },
      } as any);
      vi.mocked(User.findById).mockResolvedValue({
        email: "user@example.com",
        firstName: "Test",
      } as any);
      vi.mocked(DonationEmailService.sendDonationReceipt).mockResolvedValue(
        true,
      );

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(DonationService.recordTransaction).toHaveBeenCalledWith({
        donationId: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        stripePaymentIntentId: "pi_123",
        paymentMethod: { cardBrand: "mastercard", last4: "5678" },
      });

      expect(mockDonation.lastGiftDate).toBeInstanceOf(Date);
      expect(mockDonation.save).toHaveBeenCalled();
    });

    it("should send receipt email with isFirstPayment=true for first recurring payment", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        frequency: "monthly",
        lastGiftDate: null, // No previous payment
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
      vi.mocked(DonationTransaction.findOne).mockResolvedValue(null);
      vi.mocked(User.findById).mockResolvedValue({
        email: "user@example.com",
        firstName: "Test",
      } as any);
      vi.mocked(DonationEmailService.sendDonationReceipt).mockResolvedValue(
        true,
      );

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(DonationEmailService.sendDonationReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          isFirstPayment: true,
        }),
      );
    });

    it("should fetch email from Stripe if user email is not available", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        frequency: "monthly",
        stripeCustomerId: "cus_123",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
      vi.mocked(DonationTransaction.findOne).mockResolvedValue(null);
      vi.mocked(User.findById).mockResolvedValue({ firstName: "Test" } as any); // No email
      vi.mocked(stripe.customers.retrieve).mockResolvedValue({
        deleted: false,
        email: "stripe-customer@example.com",
      } as any);
      vi.mocked(DonationEmailService.sendDonationReceipt).mockResolvedValue(
        true,
      );

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(stripe.customers.retrieve).toHaveBeenCalledWith("cus_123");
      expect(DonationEmailService.sendDonationReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "stripe-customer@example.com",
        }),
      );
    });

    it("should skip email if no email is available", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        frequency: "monthly",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);
      vi.mocked(DonationTransaction.findOne).mockResolvedValue(null);
      vi.mocked(User.findById).mockResolvedValue({ firstName: "Test" } as any); // No email

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      expect(DonationEmailService.sendDonationReceipt).not.toHaveBeenCalled();
    });
  });

  describe("handleInvoicePaymentFailed", () => {
    it("should return early if subscription ID is missing", async () => {
      const invoice = {} as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentFailed(invoice);

      expect(Donation.findOne).not.toHaveBeenCalled();
    });

    it("should return early if donation is not found", async () => {
      const invoice = {
        subscription: "sub_123",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(null);

      await DonationWebhookController.handleInvoicePaymentFailed(invoice);

      expect(DonationTransaction.create).not.toHaveBeenCalled();
    });

    it("should update donation status to failed", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        status: "active",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_failed",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleInvoicePaymentFailed(invoice);

      expect(mockDonation.status).toBe("failed");
      expect(mockDonation.save).toHaveBeenCalled();
    });

    it("should record failed transaction with failure reason", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_failed",
        last_payment_error: {
          code: "card_declined",
          message: "Your card was declined",
        },
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleInvoicePaymentFailed(invoice);

      expect(DonationTransaction.create).toHaveBeenCalledWith({
        donationId: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        status: "failed",
        giftDate: expect.any(Date),
        stripePaymentIntentId: "pi_failed",
        failureReason: "card_declined: Your card was declined",
      });
    });

    it("should use default failure reason if error details not available", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        payment_intent: "pi_failed",
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleInvoicePaymentFailed(invoice);

      expect(DonationTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: "Payment failed",
        }),
      );
    });

    it("should skip transaction record if payment intent is missing", async () => {
      const mockDonation = {
        _id: "donation-123",
        userId: "user-123",
        amount: 5000,
        type: "recurring",
        status: "active",
        save: vi.fn(),
      };

      const invoice = {
        subscription: "sub_123",
        // No payment_intent
      } as unknown as Stripe.Invoice;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleInvoicePaymentFailed(invoice);

      expect(mockDonation.status).toBe("failed");
      expect(DonationTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    it("should return early if donation is not found", async () => {
      const subscription = {
        id: "sub_123",
      } as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(null);

      await DonationWebhookController.handleSubscriptionUpdated(subscription);

      expect(Donation.findOne).toHaveBeenCalledWith({
        stripeSubscriptionId: "sub_123",
      });
    });

    it("should set status to on_hold when subscription is paused", async () => {
      const mockDonation = {
        _id: "donation-123",
        status: "active",
        save: vi.fn(),
      };

      const subscription = {
        id: "sub_123",
        pause_collection: { behavior: "void" },
        status: "active",
      } as unknown as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleSubscriptionUpdated(subscription);

      expect(mockDonation.status).toBe("on_hold");
      expect(mockDonation.save).toHaveBeenCalled();
    });

    it("should set status to active when subscription is resumed", async () => {
      const mockDonation = {
        _id: "donation-123",
        status: "on_hold",
        save: vi.fn(),
      };

      const subscription = {
        id: "sub_123",
        pause_collection: null,
        status: "active",
      } as unknown as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleSubscriptionUpdated(subscription);

      expect(mockDonation.status).toBe("active");
      expect(mockDonation.save).toHaveBeenCalled();
    });

    it("should update nextPaymentDate from current_period_end", async () => {
      const mockDonation = {
        _id: "donation-123",
        status: "active",
        nextPaymentDate: null,
        save: vi.fn(),
      };

      const currentPeriodEnd =
        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

      const subscription = {
        id: "sub_123",
        status: "active",
        current_period_end: currentPeriodEnd,
      } as unknown as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleSubscriptionUpdated(subscription);

      expect(mockDonation.nextPaymentDate).toEqual(
        new Date(currentPeriodEnd * 1000),
      );
      expect(mockDonation.save).toHaveBeenCalled();
    });

    it("should not change status if already active and not paused", async () => {
      const mockDonation = {
        _id: "donation-123",
        status: "active",
        save: vi.fn(),
      };

      const subscription = {
        id: "sub_123",
        pause_collection: null,
        status: "active",
      } as unknown as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleSubscriptionUpdated(subscription);

      expect(mockDonation.status).toBe("active");
      expect(mockDonation.save).toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionDeleted", () => {
    it("should return early if donation is not found", async () => {
      const subscription = {
        id: "sub_123",
      } as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(null);

      await DonationWebhookController.handleSubscriptionDeleted(subscription);

      expect(Donation.findOne).toHaveBeenCalledWith({
        stripeSubscriptionId: "sub_123",
      });
    });

    it("should mark donation as cancelled", async () => {
      const mockDonation = {
        _id: "donation-123",
        status: "active",
        save: vi.fn(),
      };

      const subscription = {
        id: "sub_123",
      } as Stripe.Subscription;

      vi.mocked(Donation.findOne).mockResolvedValue(mockDonation as any);

      await DonationWebhookController.handleSubscriptionDeleted(subscription);

      expect(mockDonation.status).toBe("cancelled");
      expect(mockDonation.save).toHaveBeenCalled();
    });
  });
});
