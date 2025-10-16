import { Request, Response } from "express";
import Stripe from "stripe";
import { Purchase } from "../models";
import type { IUser } from "../models/User";
import type { IProgram } from "../models/Program";
import {
  constructWebhookEvent,
  getPaymentIntent,
} from "../services/stripeService";
import { EmailService } from "../services/infrastructure/emailService";
import { lockService } from "../services/LockService";

export class WebhookController {
  /**
   * Handle Stripe webhook events
   * POST /api/webhooks/stripe
   */
  static async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      res
        .status(400)
        .json({ success: false, message: "Missing stripe-signature header" });
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature and extract event
      event = constructWebhookEvent(req.body, signature);
      console.log("✅ Webhook signature verified, event type:", event.type);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      res.status(400).json({
        success: false,
        message: `Webhook Error: ${(err as Error).message}`,
      });
      return;
    }

    // Handle the event
    try {
      switch (event.type) {
        case "checkout.session.completed":
          console.log("Processing checkout.session.completed...");
          await WebhookController.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case "payment_intent.succeeded":
          console.log("Processing payment_intent.succeeded...");
          await WebhookController.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent
          );
          break;

        case "payment_intent.payment_failed":
          console.log("Processing payment_intent.payment_failed...");
          await WebhookController.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent
          );
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      console.log("✅ Webhook processed successfully");
      res.status(200).json({ success: true, received: true });
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      console.error("Error stack:", (error as Error).stack);
      res
        .status(500)
        .json({ success: false, message: "Webhook processing failed" });
    }
  }

  /**
   * Handle successful checkout session
   */
  private static async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    console.log("Checkout session completed:", session.id);

    // Lock ensures only one webhook processes this session
    const lockKey = `webhook:session:${session.id}`;

    await lockService.withLock(
      lockKey,
      async () => {
        // 1. Find purchase
        const purchase = await Purchase.findOne({
          stripeSessionId: session.id,
        });

        if (!purchase) {
          console.warn(
            "Purchase not found for session (possibly deleted or test):",
            session.id
          );
          return; // Exit gracefully - don't throw, return 200 to avoid Stripe retries
        }

        // 2. IDEMPOTENCY CHECK: Skip if already completed
        if (purchase.status === "completed") {
          console.log(
            "Purchase already completed (idempotent), skipping:",
            purchase.orderNumber
          );
          return; // Exit early, don't re-process
        }

        // 3. Fetch payment details from Stripe
        const paymentIntentId = session.payment_intent as string;
        let paymentMethod: {
          type: "card" | "other";
          cardBrand?: string;
          last4?: string;
          cardholderName?: string;
        } = { type: "card" };

        if (paymentIntentId) {
          try {
            const paymentIntent = await getPaymentIntent(paymentIntentId);

            if (paymentIntent.latest_charge) {
              const chargeId =
                typeof paymentIntent.latest_charge === "string"
                  ? paymentIntent.latest_charge
                  : paymentIntent.latest_charge.id;

              const { stripe } = await import("../services/stripeService");
              const charge = await stripe.charges.retrieve(chargeId);
              const paymentMethodDetails = charge.payment_method_details;

              if (paymentMethodDetails?.card) {
                paymentMethod = {
                  type: "card",
                  cardBrand: paymentMethodDetails.card.brand || undefined,
                  last4: paymentMethodDetails.card.last4 || undefined,
                  cardholderName: charge.billing_details?.name || undefined,
                };
              }
            }

            purchase.stripePaymentIntentId = paymentIntentId;
          } catch (error) {
            console.error("Error fetching payment intent:", error);
            // Continue anyway - payment succeeded even if details fetch failed
          }
        }

        // 4. Update billing info from session
        if (session.customer_details) {
          purchase.billingInfo = {
            fullName:
              session.customer_details.name || purchase.billingInfo.fullName,
            email: session.customer_details.email || purchase.billingInfo.email,
            address: session.customer_details.address?.line1 || undefined,
            city: session.customer_details.address?.city || undefined,
            state: session.customer_details.address?.state || undefined,
            zipCode: session.customer_details.address?.postal_code || undefined,
            country: session.customer_details.address?.country || undefined,
          };
        }

        // 5. Update payment method
        purchase.paymentMethod = paymentMethod;

        // 6. Mark purchase as completed (ATOMIC UPDATE)
        purchase.status = "completed";
        purchase.purchaseDate = new Date();

        // 7. Save all changes atomically
        await purchase.save();

        console.log("Purchase completed successfully:", purchase.orderNumber);

        // 8. Send confirmation email AFTER save (best effort)
        // Email failure doesn't affect purchase completion
        try {
          await purchase.populate([{ path: "userId" }, { path: "programId" }]);

          const user = purchase.userId as unknown as IUser;
          const program = purchase.programId as unknown as IProgram;

          if (user && program) {
            const frontendUrl =
              process.env.FRONTEND_URL || "http://localhost:5173";
            const receiptUrl = `${frontendUrl}/dashboard/purchase-receipt/${purchase._id}`;

            await EmailService.sendPurchaseConfirmationEmail({
              email: user.email,
              name: `${user.firstName} ${user.lastName}`,
              orderNumber: purchase.orderNumber,
              programTitle: program.title,
              programType: program.programType || "Program",
              purchaseDate: purchase.purchaseDate,
              fullPrice: purchase.fullPrice,
              finalPrice: purchase.finalPrice,
              classRepDiscount: purchase.classRepDiscount || 0,
              earlyBirdDiscount: purchase.earlyBirdDiscount || 0,
              isClassRep: purchase.isClassRep,
              isEarlyBird: purchase.isEarlyBird,
              receiptUrl,
            });

            console.log(`Purchase confirmation email sent to ${user.email}`);
          } else {
            console.warn(
              "Could not send confirmation email: user or program not found"
            );
          }
        } catch (emailError) {
          console.error(
            "Error sending purchase confirmation email:",
            emailError
          );
          // Don't throw - purchase is already completed successfully
        }
      },
      15000 // 15s timeout for Stripe API + email
    );
  }

  /**
   * Handle successful payment intent
   */
  private static async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    console.log("Payment intent succeeded:", paymentIntent.id);

    const purchase = await Purchase.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });
    if (!purchase) {
      console.log("No purchase found for payment intent:", paymentIntent.id);
      return;
    }

    // Update purchase status if not already completed
    if (purchase.status !== "completed") {
      purchase.status = "completed";
      purchase.purchaseDate = new Date();
      await purchase.save();
      console.log(
        "Purchase marked as completed via payment intent:",
        purchase.orderNumber
      );
    }
  }

  /**
   * Handle failed payment intent
   */
  private static async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    console.log("Payment intent failed:", paymentIntent.id);

    const purchase = await Purchase.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });
    if (!purchase) {
      console.log("No purchase found for payment intent:", paymentIntent.id);
      return;
    }

    // If this was a Class Rep purchase that's now failed, decrement the counter
    if (purchase.isClassRep && purchase.status === "pending") {
      const { Program } = await import("../models");
      await Program.findByIdAndUpdate(
        purchase.programId,
        { $inc: { classRepCount: -1 } },
        { runValidators: false } // Allow going below limit on decrement
      );
      console.log(
        `Decremented classRepCount for failed purchase: ${purchase.orderNumber}`
      );
    }

    // Mark purchase as failed
    purchase.status = "failed";
    await purchase.save();

    console.log("Purchase marked as failed:", purchase.orderNumber);

    // TODO: Send failure notification email to user
    // await sendPaymentFailureEmail(purchase);
  }
}
