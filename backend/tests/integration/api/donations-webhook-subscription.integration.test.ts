/**
 * Integration tests for donation webhook subscription flow
 *
 * Tests the complete webhook sequence for recurring donations to ensure:
 * 1. No duplicate transactions on first payment
 * 2. Subsequent payments are recorded correctly
 * 3. The checkout.session.completed + invoice.payment_succeeded flow works properly
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import mongoose from "mongoose";
import { ensureIntegrationDB } from "../setup/connect";
import Donation from "../../../src/models/Donation";
import DonationTransaction from "../../../src/models/DonationTransaction";
import User from "../../../src/models/User";
import DonationWebhookController from "../../../src/controllers/donations/DonationWebhookController";

describe("Donation Webhook - Subscription Flow Integration", () => {
  let testUserId: mongoose.Types.ObjectId;
  let testDonationId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await ensureIntegrationDB();
  });

  beforeEach(async () => {
    // Create test user with proper schema requirements
    const testUser = await User.create({
      username: "subscriptiondonor",
      email: "subscription-donor@test.com",
      firstName: "Subscription",
      lastName: "Donor",
      password: "TestPass123!",
      role: "Participant",
      gender: "male",
      isVerified: true,
    });
    testUserId = testUser._id as mongoose.Types.ObjectId;

    // Create test recurring donation in pending state
    const testDonation = await Donation.create({
      userId: testUserId,
      amount: 5000, // $50.00 in cents (min is $1.00 = 100 cents)
      type: "recurring",
      frequency: "monthly",
      status: "pending",
      stripeCustomerId: "pending", // Required field, will be updated on checkout
      giftDate: new Date(),
      startDate: new Date(), // Required field for recurring donations
    });
    testDonationId = testDonation._id as mongoose.Types.ObjectId;
  });

  afterEach(async () => {
    await DonationTransaction.deleteMany({});
    await Donation.deleteMany({});
    await User.deleteMany({});
  });

  describe("First Subscription Payment - Double Charge Prevention", () => {
    it("should NOT create transaction in checkout.session.completed for subscription", async () => {
      // Simulate checkout.session.completed webhook for subscription
      const checkoutSession = {
        id: "cs_test_123",
        mode: "subscription",
        customer: "cus_test_123",
        subscription: "sub_test_123",
        payment_intent: "pi_test_first_payment",
        metadata: {
          donationId: testDonationId.toString(),
          userId: testUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      await DonationWebhookController.handleDonationCheckout(checkoutSession);

      // Verify donation was updated with subscription details
      const donation = await Donation.findById(testDonationId);
      expect(donation).toBeDefined();
      expect(donation?.stripeCustomerId).toBe("cus_test_123");
      expect(donation?.stripeSubscriptionId).toBe("sub_test_123");
      expect(donation?.status).toBe("active");

      // CRITICAL: No transaction should be created yet
      const transactions = await DonationTransaction.find({
        donationId: testDonationId,
      });
      expect(transactions).toHaveLength(0);
    });

    it("should create transaction ONLY in invoice.payment_succeeded for first payment", async () => {
      // First: Process checkout (should not create transaction)
      const checkoutSession = {
        id: "cs_test_123",
        mode: "subscription",
        customer: "cus_test_123",
        subscription: "sub_test_123",
        payment_intent: "pi_test_first_payment",
        metadata: {
          donationId: testDonationId.toString(),
          userId: testUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      await DonationWebhookController.handleDonationCheckout(checkoutSession);

      // Update donation with subscription ID for invoice webhook
      await Donation.findByIdAndUpdate(testDonationId, {
        stripeSubscriptionId: "sub_test_123",
      });

      // Second: Stripe sends invoice.payment_succeeded (should create transaction)
      const invoice = {
        id: "in_test_123",
        subscription: "sub_test_123",
        payment_intent: "pi_test_first_payment",
        amount_paid: 5000, // $50.00 in cents
        customer: "cus_test_123",
        billing_reason: "subscription_create", // First invoice
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      // Verify ONLY ONE transaction was created (by invoice webhook)
      const transactions = await DonationTransaction.find({
        donationId: testDonationId,
      });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].stripePaymentIntentId).toBe(
        "pi_test_first_payment"
      );
      expect(transactions[0].amount).toBe(5000); // Amount in cents
      expect(transactions[0].type).toBe("recurring");
      expect(transactions[0].status).toBe("completed");

      // Verify donation lastGiftDate was set
      const donation = await Donation.findById(testDonationId);
      expect(donation?.lastGiftDate).toBeDefined();
    });

    it("should handle complete subscription flow without duplicates", async () => {
      // Step 1: User completes checkout
      const checkoutSession = {
        id: "cs_test_complete_flow",
        mode: "subscription",
        customer: "cus_complete_test",
        subscription: "sub_complete_test",
        payment_intent: "pi_complete_first",
        metadata: {
          donationId: testDonationId.toString(),
          userId: testUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      await DonationWebhookController.handleDonationCheckout(checkoutSession);

      // Step 2: Stripe immediately fires invoice.payment_succeeded
      await Donation.findByIdAndUpdate(testDonationId, {
        stripeSubscriptionId: "sub_complete_test",
      });

      const firstInvoice = {
        id: "in_complete_first",
        subscription: "sub_complete_test",
        payment_intent: "pi_complete_first",
        amount_paid: 5000,
        customer: "cus_complete_test",
        billing_reason: "subscription_create",
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(
        firstInvoice
      );

      // Step 3: One month later, next payment
      const secondInvoice = {
        id: "in_complete_second",
        subscription: "sub_complete_test",
        payment_intent: "pi_complete_second",
        amount_paid: 5000,
        customer: "cus_complete_test",
        billing_reason: "subscription_cycle",
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(
        secondInvoice
      );

      // Verify exactly 2 transactions (first payment + second payment)
      const transactions = await DonationTransaction.find({
        donationId: testDonationId,
      }).sort({ createdAt: 1 });

      expect(transactions).toHaveLength(2);

      // First transaction
      expect(transactions[0].stripePaymentIntentId).toBe("pi_complete_first");
      expect(transactions[0].amount).toBe(5000); // Amount in cents

      // Second transaction
      expect(transactions[1].stripePaymentIntentId).toBe("pi_complete_second");
      expect(transactions[1].amount).toBe(5000); // Amount in cents      // Verify donation updated correctly
      const donation = await Donation.findById(testDonationId);
      expect(donation?.lastGiftDate).toBeDefined();
      expect(donation?.status).toBe("active");
    });
  });

  describe("One-Time Donation - Still Works Correctly", () => {
    it("should create transaction in checkout.session.completed for one-time payment", async () => {
      // Create a one-time donation (not subscription)
      const oneTimeDonation = await Donation.create({
        userId: testUserId,
        amount: 10000, // $100.00
        type: "one-time",
        status: "pending",
        stripeCustomerId: "pending",
        giftDate: new Date(),
        startDate: new Date(),
      });
      const oneTimeDonationId = oneTimeDonation._id as mongoose.Types.ObjectId;

      // One-time donations use payment mode, not subscription mode
      const checkoutSession = {
        id: "cs_test_onetime",
        mode: "payment", // Note: payment mode, not subscription
        customer: "cus_onetime_test",
        payment_intent: "pi_onetime_test",
        metadata: {
          donationId: oneTimeDonationId.toString(),
          userId: testUserId.toString(),
        },
      } as unknown as Stripe.Checkout.Session;

      await DonationWebhookController.handleDonationCheckout(checkoutSession);

      // Verify transaction WAS created for one-time donation
      const transactions = await DonationTransaction.find({
        donationId: oneTimeDonationId,
      });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].stripePaymentIntentId).toBe("pi_onetime_test");
      expect(transactions[0].type).toBe("one-time");
      expect(transactions[0].status).toBe("completed");

      // Verify donation status updated to completed
      const donation = await Donation.findById(oneTimeDonationId);
      expect(donation?.status).toBe("completed");
    });
  });

  describe("Subsequent Subscription Payments", () => {
    it("should create transaction for each subsequent invoice payment", async () => {
      // Setup: donation with active subscription
      await Donation.findByIdAndUpdate(testDonationId, {
        stripeSubscriptionId: "sub_subsequent_test",
        status: "active",
      });

      // First subsequent payment
      const invoice1 = {
        id: "in_subsequent_1",
        subscription: "sub_subsequent_test",
        payment_intent: "pi_subsequent_1",
        amount_paid: 5000,
        customer: "cus_subsequent_test",
        billing_reason: "subscription_cycle",
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice1);

      // Second subsequent payment
      const invoice2 = {
        id: "in_subsequent_2",
        subscription: "sub_subsequent_test",
        payment_intent: "pi_subsequent_2",
        amount_paid: 5000,
        customer: "cus_subsequent_test",
        billing_reason: "subscription_cycle",
      } as unknown as Stripe.Invoice;

      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice2);

      // Verify two transactions created
      const transactions = await DonationTransaction.find({
        donationId: testDonationId,
      }).sort({ createdAt: 1 });

      expect(transactions).toHaveLength(2);
      expect(transactions[0].stripePaymentIntentId).toBe("pi_subsequent_1");
      expect(transactions[1].stripePaymentIntentId).toBe("pi_subsequent_2");

      // Both should be recurring transactions
      expect(transactions[0].type).toBe("recurring");
      expect(transactions[1].type).toBe("recurring");
    });
  });

  describe("Duplicate Prevention - Invoice Webhook", () => {
    it("should prevent duplicate transactions if webhook fires twice", async () => {
      await Donation.findByIdAndUpdate(testDonationId, {
        stripeSubscriptionId: "sub_duplicate_test",
        status: "active",
      });

      const invoice = {
        id: "in_duplicate_test",
        subscription: "sub_duplicate_test",
        payment_intent: "pi_duplicate_test",
        amount_paid: 5000,
        customer: "cus_duplicate_test",
        billing_reason: "subscription_cycle",
      } as unknown as Stripe.Invoice;

      // Fire webhook twice (simulating Stripe retry)
      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);
      await DonationWebhookController.handleInvoicePaymentSucceeded(invoice);

      // Should only create ONE transaction
      const transactions = await DonationTransaction.find({
        donationId: testDonationId,
      });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].stripePaymentIntentId).toBe("pi_duplicate_test");
    });
  });
});
