import Stripe from "stripe";
import mongoose from "mongoose";
import Donation from "../../models/Donation";
import DonationTransaction from "../../models/DonationTransaction";
import DonationService from "../../services/DonationService";
import { getPaymentIntent } from "../../services/stripeService";

/**
 * DonationWebhookController
 *
 * Handles all donation-related Stripe webhook events:
 * - checkout.session.completed (donation mode)
 * - invoice.payment_succeeded (recurring donations)
 * - invoice.payment_failed (recurring donations)
 * - customer.subscription.updated (pause/resume)
 * - customer.subscription.deleted (cancellation)
 *
 * Extracted from webhookController.ts for better organization
 */
export default class DonationWebhookController {
  /**
   * Handle donation checkout session completion
   * Processes both one-time and recurring donation checkouts
   */
  static async handleDonationCheckout(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const donationId = session.metadata?.donationId;
    const userId = session.metadata?.userId;

    if (!donationId || !userId) {
      console.error(
        "Missing donationId or userId in checkout session metadata"
      );
      return;
    }

    console.log(`Processing donation checkout for donation ${donationId}`);

    const donation = await Donation.findById(donationId);
    if (!donation) {
      console.error(`Donation ${donationId} not found`);
      return;
    }

    // Update Stripe customer ID
    if (session.customer) {
      donation.stripeCustomerId = session.customer as string;
    }

    // For subscription mode, get subscription ID
    if (session.mode === "subscription" && session.subscription) {
      donation.stripeSubscriptionId = session.subscription as string;
      donation.status = "active"; // Activate recurring donation after subscription created
      console.log(`Subscription created: ${donation.stripeSubscriptionId}`);

      // NOTE: Do NOT record the first transaction here!
      // Stripe will automatically send an invoice.payment_succeeded webhook for the first payment,
      // which will handle recording the transaction and sending the email.
      // Recording it here would create a duplicate transaction.

      // If there's an end date, schedule the subscription to cancel at that time
      if (donation.endDate) {
        try {
          const cancelAt = Math.floor(
            new Date(donation.endDate).getTime() / 1000
          );

          const { stripe } = await import("../../services/stripeService");
          await stripe.subscriptions.update(
            donation.stripeSubscriptionId as string,
            {
              cancel_at: cancelAt,
            }
          );
          console.log(
            `Subscription ${donation.stripeSubscriptionId} scheduled to cancel at ${donation.endDate}`
          );
        } catch (error) {
          console.error("Error scheduling subscription cancellation:", error);
        }
      }
    }

    // For payment mode (one-time), record the transaction immediately
    if (session.mode === "payment" && session.payment_intent) {
      const paymentIntentId = session.payment_intent as string;

      // Get payment method details
      let paymentMethod: { cardBrand?: string; last4?: string } = {};
      try {
        const paymentIntent = await getPaymentIntent(paymentIntentId);
        if (paymentIntent.latest_charge) {
          const chargeId =
            typeof paymentIntent.latest_charge === "string"
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge.id;

          const { stripe } = await import("../../services/stripeService");
          const charge = await stripe.charges.retrieve(chargeId);
          const paymentMethodDetails = charge.payment_method_details;

          if (paymentMethodDetails?.card) {
            paymentMethod = {
              cardBrand: paymentMethodDetails.card.brand || undefined,
              last4: paymentMethodDetails.card.last4 || undefined,
            };
          }
        }
      } catch (error) {
        console.error("Error fetching payment intent:", error);
      }

      // Record the transaction
      await DonationService.recordTransaction({
        donationId,
        userId,
        amount: donation.amount,
        type: donation.type,
        stripePaymentIntentId: paymentIntentId,
        paymentMethod,
      });

      donation.status = "completed"; // Complete one-time donation after payment
      console.log(`One-time donation transaction recorded for ${donationId}`);

      // Send donation receipt email
      try {
        const { DonationEmailService } = await import(
          "../../services/email/domains/DonationEmailService"
        );

        // Get user info for email
        const user = await import("../../models/User").then((m) =>
          m.default.findById(userId)
        );
        const userEmail = session.customer_details?.email || user?.email || "";
        const userName =
          session.customer_details?.name || user?.firstName || "Donor";

        await DonationEmailService.sendDonationReceipt({
          email: userEmail,
          name: userName,
          amount: donation.amount,
          type: "one-time",
          transactionDate: new Date(),
          paymentMethod,
        });
        console.log(`Donation receipt email sent to ${userEmail}`);
      } catch (error) {
        console.error("Error sending donation receipt email:", error);
        // Don't throw - email failure shouldn't stop donation processing
      }
    }

    await donation.save();
    console.log(`Donation ${donationId} updated with Stripe details`);
  }

  /**
   * Handle successful invoice payment (recurring donation)
   * Records transaction and updates last gift date
   */
  static async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice
  ): Promise<void> {
    // Get subscription ID from invoice
    const subscriptionId =
      typeof (invoice as unknown as { subscription?: string | { id?: string } })
        .subscription === "string"
        ? (invoice as unknown as { subscription: string }).subscription
        : (invoice as unknown as { subscription?: { id?: string } })
            .subscription?.id;

    if (!subscriptionId) {
      console.log("No subscription ID in invoice, skipping");
      return;
    }

    // Find donation by subscription ID
    const donation = await Donation.findOne({
      stripeSubscriptionId: subscriptionId,
    });
    if (!donation) {
      console.log(`No donation found for subscription ${subscriptionId}`);
      return;
    }

    console.log(`Recording payment for donation ${donation._id}`);

    // Get payment intent ID
    const paymentIntentId =
      typeof (
        invoice as unknown as {
          payment_intent?: string | { id?: string };
        }
      ).payment_intent === "string"
        ? (invoice as unknown as { payment_intent: string }).payment_intent
        : (invoice as unknown as { payment_intent?: { id?: string } })
            .payment_intent?.id || "";

    // Check if this transaction was already recorded (prevent duplicates)
    if (paymentIntentId) {
      const existingTransaction = await DonationTransaction.findOne({
        stripePaymentIntentId: paymentIntentId,
      });
      if (existingTransaction) {
        console.log(
          `Transaction already recorded for payment intent ${paymentIntentId}, skipping`
        );
        return;
      }
    }

    // Get payment method details
    let paymentMethod: { cardBrand?: string; last4?: string } = {};
    const invoiceCharge =
      typeof (invoice as unknown as { charge?: string | { id?: string } })
        .charge === "string"
        ? (invoice as unknown as { charge: string }).charge
        : (invoice as unknown as { charge?: { id?: string } }).charge?.id;

    if (invoiceCharge) {
      try {
        const chargeId = invoiceCharge;

        const { stripe } = await import("../../services/stripeService");
        const charge = await stripe.charges.retrieve(chargeId);
        const paymentMethodDetails = charge.payment_method_details;

        if (paymentMethodDetails?.card) {
          paymentMethod = {
            cardBrand: paymentMethodDetails.card.brand || undefined,
            last4: paymentMethodDetails.card.last4 || undefined,
          };
        }
      } catch (error) {
        console.error("Error fetching charge details:", error);
      }
    }

    // Record the transaction
    await DonationService.recordTransaction({
      donationId: (donation._id as mongoose.Types.ObjectId).toString(),
      userId: (donation.userId as mongoose.Types.ObjectId).toString(),
      amount: donation.amount,
      type: donation.type,
      stripePaymentIntentId:
        typeof (
          invoice as unknown as {
            payment_intent?: string | { id?: string };
          }
        ).payment_intent === "string"
          ? (invoice as unknown as { payment_intent: string }).payment_intent
          : (invoice as unknown as { payment_intent?: { id?: string } })
              .payment_intent?.id || "",
      paymentMethod,
    });

    // Determine if this is the first payment (subscription just created)
    const isFirstPayment = !donation.lastGiftDate;

    // Update last gift date
    donation.lastGiftDate = new Date();
    await donation.save();

    console.log(`Recurring donation payment recorded for ${donation._id}`);

    // Send donation receipt email for recurring payment
    try {
      const { DonationEmailService } = await import(
        "../../services/email/domains/DonationEmailService"
      );

      // Get user info for email
      const user = await import("../../models/User").then((m) =>
        m.default.findById(donation.userId)
      );

      // Try to get customer email from Stripe if not in our database
      let userEmail = user?.email || "";
      if (!userEmail && donation.stripeCustomerId) {
        try {
          const { stripe } = await import("../../services/stripeService");
          const customer = await stripe.customers.retrieve(
            donation.stripeCustomerId as string
          );
          if (
            customer &&
            !customer.deleted &&
            typeof customer.email === "string"
          ) {
            userEmail = customer.email;
          }
        } catch (error) {
          console.error("Error fetching customer email from Stripe:", error);
        }
      }

      const userName = user?.firstName || "Donor";

      if (userEmail) {
        await DonationEmailService.sendDonationReceipt({
          email: userEmail,
          name: userName,
          amount: donation.amount,
          type: "recurring",
          frequency: donation.frequency as
            | "weekly"
            | "biweekly"
            | "monthly"
            | "quarterly"
            | "annually",
          transactionDate: new Date(),
          paymentMethod,
          isFirstPayment, // Now correctly detects if this is the first payment
        });
        console.log(`Recurring donation receipt email sent to ${userEmail}`);
      } else {
        console.warn(
          `No email found for user ${donation.userId}, skipping receipt email`
        );
      }
    } catch (error) {
      console.error("Error sending recurring donation receipt email:", error);
      // Don't throw - email failure shouldn't stop donation processing
    }
  }

  /**
   * Handle failed invoice payment (recurring donation)
   * Marks donation as failed
   */
  static async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
    const subscriptionId =
      typeof (invoice as unknown as { subscription?: string | { id?: string } })
        .subscription === "string"
        ? (invoice as unknown as { subscription: string }).subscription
        : (invoice as unknown as { subscription?: { id?: string } })
            .subscription?.id;

    if (!subscriptionId) {
      console.log("No subscription ID in invoice, skipping");
      return;
    }

    // Find donation by subscription ID
    const donation = await Donation.findOne({
      stripeSubscriptionId: subscriptionId,
    });
    if (!donation) {
      console.log(`No donation found for subscription ${subscriptionId}`);
      return;
    }

    console.log(`Payment failed for donation ${donation._id}`);

    // Update donation status to failed
    donation.status = "failed";
    await donation.save();

    // Record the failed transaction
    const paymentIntentId =
      typeof (
        invoice as unknown as { payment_intent?: string | { id?: string } }
      ).payment_intent === "string"
        ? (invoice as unknown as { payment_intent: string }).payment_intent
        : (invoice as unknown as { payment_intent?: { id?: string } })
            .payment_intent?.id;

    // Only create transaction if payment intent exists
    if (!paymentIntentId) {
      console.log("No payment intent ID, skipping transaction record");
      return;
    }

    // Extract failure reason from invoice
    const lastPaymentError = (
      invoice as unknown as {
        last_payment_error?: { message?: string; code?: string };
      }
    ).last_payment_error;
    const failureReason = lastPaymentError
      ? `${lastPaymentError.code || "unknown"}: ${
          lastPaymentError.message || "Payment failed"
        }`
      : "Payment failed";

    await DonationTransaction.create({
      donationId: donation._id,
      userId: donation.userId,
      amount: donation.amount,
      type: donation.type,
      status: "failed",
      giftDate: new Date(),
      stripePaymentIntentId: paymentIntentId,
      failureReason,
    });

    // TODO: Send notification to user about failed payment
    console.log(`Donation ${donation._id} marked as failed`);
  }

  /**
   * Handle subscription updates (pause, resume, etc.)
   * Updates donation status based on subscription state
   */
  static async handleSubscriptionUpdated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const donation = await Donation.findOne({
      stripeSubscriptionId: subscription.id,
    });

    if (!donation) {
      console.log(`No donation found for subscription ${subscription.id}`);
      return;
    }

    console.log(`Subscription updated for donation ${donation._id}`);

    // Check if subscription is paused
    if (subscription.pause_collection) {
      if (donation.status !== "on_hold") {
        donation.status = "on_hold";
        console.log(`Donation ${donation._id} paused`);
      }
    } else if (subscription.status === "active") {
      if (donation.status === "on_hold") {
        donation.status = "active";
        console.log(`Donation ${donation._id} resumed`);
      }
    }

    // Update next payment date if available
    const currentPeriodEnd = (
      subscription as unknown as { current_period_end?: number }
    ).current_period_end;
    if (currentPeriodEnd) {
      donation.nextPaymentDate = new Date(currentPeriodEnd * 1000);
    }

    await donation.save();
  }

  /**
   * Handle subscription deletion/cancellation
   * Marks donation as cancelled
   */
  static async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const donation = await Donation.findOne({
      stripeSubscriptionId: subscription.id,
    });

    if (!donation) {
      console.log(`No donation found for subscription ${subscription.id}`);
      return;
    }

    console.log(`Subscription deleted for donation ${donation._id}`);

    // Mark donation as cancelled
    donation.status = "cancelled";
    await donation.save();

    console.log(`Donation ${donation._id} marked as cancelled`);
  }
}
