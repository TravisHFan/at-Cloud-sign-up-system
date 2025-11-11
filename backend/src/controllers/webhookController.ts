import { Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import { Purchase, SystemConfig, PromoCode, User, Program } from "../models";
import Donation from "../models/Donation";
import DonationTransaction from "../models/DonationTransaction";
import type { IUser } from "../models/User";
import type { IProgram } from "../models/Program";
import {
  constructWebhookEvent,
  getPaymentIntent,
} from "../services/stripeService";
import { EmailService } from "../services/infrastructure/EmailServiceFacade";
import { lockService } from "../services/LockService";
import { TrioNotificationService } from "../services/notifications/TrioNotificationService";
import DonationService from "../services/DonationService";

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

        case "charge.refund.updated":
          console.log("Processing charge.refund.updated...");
          await WebhookController.handleRefundUpdated(
            event.data.object as Stripe.Refund
          );
          break;

        // Donation-related events
        case "invoice.payment_succeeded":
          console.log("Processing invoice.payment_succeeded...");
          await WebhookController.handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice
          );
          break;

        case "invoice.payment_failed":
          console.log("Processing invoice.payment_failed...");
          await WebhookController.handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice
          );
          break;

        case "customer.subscription.updated":
          console.log("Processing customer.subscription.updated...");
          await WebhookController.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
          break;

        case "customer.subscription.deleted":
          console.log("Processing customer.subscription.deleted...");
          await WebhookController.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
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

    // Check if this is a donation checkout
    const isDonation =
      session.metadata?.type === "donation" || session.metadata?.donationId;

    if (isDonation) {
      await WebhookController.handleDonationCheckout(session);
      return;
    }

    // UNIFIED LOCK: Use purchaseId from metadata if available (new behavior)
    // Fall back to session ID for backward compatibility (old sessions)
    const purchaseId = session.metadata?.purchaseId;
    const lockKey = purchaseId
      ? `purchase:complete:${purchaseId}` // Unified lock (matches purchase creation)
      : `webhook:session:${session.id}`; // Legacy fallback

    if (purchaseId) {
      console.log(
        `Using unified lock with purchaseId: ${purchaseId} (eliminates race condition)`
      );
    } else {
      console.log(
        `Using legacy lock with sessionId: ${session.id} (backward compatibility)`
      );
    }

    await lockService.withLock(
      lockKey,
      async () => {
        // 1. Find purchase by ID (if available) or session ID (fallback)
        const purchase = purchaseId
          ? await Purchase.findById(purchaseId)
          : await Purchase.findOne({ stripeSessionId: session.id });

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

        // 8. Mark promo code as used if one was applied
        if (purchase.promoCode) {
          try {
            const promoCode = await PromoCode.findOne({
              code: purchase.promoCode,
            });

            if (promoCode) {
              // Skip if already used (for personal codes)
              if (!promoCode.isGeneral && promoCode.isUsed) {
                console.log(
                  `Promo code ${purchase.promoCode} already marked as used`
                );
              } else {
                // Get user info for general code tracking
                console.log(
                  `🔍 WEBHOOK DEBUG: Promo code "${purchase.promoCode}" being marked as used`
                );
                console.log(
                  `🔍 WEBHOOK DEBUG: isGeneral = ${promoCode.isGeneral}`
                );
                console.log(
                  `🔍 WEBHOOK DEBUG: Full promo code object:`,
                  JSON.stringify(promoCode, null, 2)
                );

                const user = await User.findById(purchase.userId).select(
                  "firstName lastName email"
                );
                const program = await Program.findById(
                  purchase.programId
                ).select("title");

                const userName = user
                  ? `${user.firstName} ${user.lastName}`
                  : "Unknown User";
                const userEmail = user?.email || "unknown@example.com";
                const programTitle = program?.title || "Unknown Program";

                await promoCode.markAsUsed(
                  purchase.programId,
                  purchase.userId as mongoose.Types.ObjectId,
                  userName,
                  userEmail,
                  programTitle
                );
                console.log(`Promo code ${purchase.promoCode} marked as used`);

                // Send notification to admins if it's a general staff code
                if (promoCode.isGeneral) {
                  console.log(
                    `✅ WEBHOOK DEBUG: This IS a general code, sending admin notifications...`
                  );
                  try {
                    // Find all administrators
                    const admins = await User.find({
                      role: { $in: ["Super Admin", "Administrator"] },
                    }).select("_id");

                    console.log(
                      `🔍 WEBHOOK DEBUG: Found ${admins.length} admin users`
                    );
                    const adminIds = admins.map((admin) =>
                      admin._id.toString()
                    );

                    if (adminIds.length > 0) {
                      console.log(
                        `📤 WEBHOOK DEBUG: Sending notification to ${adminIds.length} admins...`
                      );
                      await TrioNotificationService.createTrio({
                        systemMessage: {
                          title: "General Staff Code Used",
                          content: `${userName} (${userEmail}) used general staff code "${promoCode.code}" for program "${programTitle}".`,
                          type: "announcement",
                          priority: "medium",
                          hideCreator: true, // System-generated notification, no sender
                          metadata: {
                            promoCodeId: (
                              promoCode._id as mongoose.Types.ObjectId
                            ).toString(),
                            userId: purchase.userId.toString(),
                            programId: purchase.programId.toString(),
                          },
                        },
                        recipients: adminIds,
                      });
                      console.log(
                        `✅ WEBHOOK DEBUG: Admin notification sent for general code usage: ${promoCode.code}`
                      );
                    } else {
                      console.log(
                        `⚠️ WEBHOOK DEBUG: No admin users found to notify`
                      );
                    }
                  } catch (notifyError) {
                    console.error(
                      "Failed to notify admins of general code usage:",
                      notifyError
                    );
                    // Don't fail the purchase
                  }
                } else {
                  console.log(
                    `❌ WEBHOOK DEBUG: This is NOT a general code (isGeneral = ${promoCode.isGeneral}), skipping admin notification`
                  );
                }
              }
            }
          } catch (promoError) {
            // Log error but don't fail the purchase
            console.error("Error marking promo code as used:", promoError);
          }
        }

        // 9. Auto-generate bundle promo code if feature enabled
        try {
          const bundleConfig = await SystemConfig.getBundleDiscountConfig();

          if (bundleConfig.enabled && purchase.finalPrice > 0) {
            const { PromoCode } = await import("../models");

            // Generate unique code
            const generatedCode = await PromoCode.generateUniqueCode();

            // Calculate expiry date
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + bundleConfig.expiryDays);

            // Create bundle promo code
            const bundlePromoCode = await PromoCode.create({
              code: generatedCode,
              type: "bundle_discount",
              discountAmount: bundleConfig.discountAmount,
              ownerId: purchase.userId,
              excludedProgramId: purchase.programId, // Can't use on same program
              isActive: true,
              isUsed: false,
              expiresAt: expiresAt,
              createdBy: "system",
            });

            // Update purchase with bundle code info
            purchase.bundlePromoCode = bundlePromoCode.code;
            purchase.bundleDiscountAmount = bundleConfig.discountAmount;
            purchase.bundleExpiresAt = expiresAt;
            await purchase.save();
          }
        } catch (bundleError) {
          // Log error but don't fail the purchase
          console.error("Error generating bundle promo code:", bundleError);
        }

        // 10. Send confirmation email AFTER save (best effort)
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

  /**
   * Handle refund status updates from Stripe
   */
  private static async handleRefundUpdated(
    refund: Stripe.Refund
  ): Promise<void> {
    console.log("Refund updated:", refund.id, "Status:", refund.status);

    // Extract purchase info from refund metadata
    const purchaseId = refund.metadata?.purchaseId;
    const orderNumber = refund.metadata?.orderNumber;

    if (!purchaseId) {
      console.log(
        "No purchaseId in refund metadata, cannot process refund:",
        refund.id
      );
      return;
    }

    // Find the purchase
    const purchase = await Purchase.findById(purchaseId).populate(
      "programId",
      "title"
    );

    if (!purchase) {
      console.log("No purchase found for refund:", refund.id);
      return;
    }

    // Import PurchaseEmailService dynamically
    const { PurchaseEmailService } = await import(
      "../services/email/domains/PurchaseEmailService"
    );

    // Handle refund status
    switch (refund.status) {
      case "succeeded":
        console.log(
          `Refund succeeded for purchase ${orderNumber}, updating status to refunded`
        );

        // Update purchase status
        purchase.status = "refunded";
        purchase.refundedAt = new Date();
        await purchase.save();

        // Recover promo code if one was used
        if (purchase.promoCode) {
          try {
            const promoCode = await PromoCode.findOne({
              code: purchase.promoCode,
            });

            if (promoCode && promoCode.isUsed) {
              // Mark the promo code as not used and active again
              promoCode.isUsed = false;
              promoCode.isActive = true;
              promoCode.usedAt = undefined;
              promoCode.usedForProgramId = undefined;
              await promoCode.save();

              console.log(
                `✅ Recovered promo code ${purchase.promoCode} for refunded order ${orderNumber}`
              );
            }
          } catch (promoError) {
            console.error(
              `Failed to recover promo code ${purchase.promoCode}:`,
              promoError
            );
            // Don't fail the refund if promo code recovery fails
          }
        }

        // Send refund completed email to user
        try {
          await PurchaseEmailService.sendRefundCompletedEmail({
            userEmail: purchase.billingInfo.email,
            userName: purchase.billingInfo.fullName,
            orderNumber: purchase.orderNumber,
            programTitle:
              typeof purchase.programId === "object"
                ? purchase.programId.title
                : "Program",
            refundAmount: purchase.finalPrice,
            refundDate: new Date(),
          });
          console.log(`Sent refund completed email for order ${orderNumber}`);
        } catch (emailError) {
          console.error("Failed to send refund completed email:", emailError);
        }

        // Send admin notification
        try {
          const user = await User.findById(purchase.userId);
          if (user) {
            await PurchaseEmailService.sendAdminRefundNotification({
              userName: `${user.firstName} ${user.lastName}`,
              userEmail: user.email,
              orderNumber: purchase.orderNumber,
              programTitle:
                typeof purchase.programId === "object"
                  ? purchase.programId.title
                  : "Program",
              refundAmount: purchase.finalPrice,
              purchaseDate: purchase.purchaseDate,
              refundInitiatedAt: purchase.refundInitiatedAt || new Date(),
            });
            console.log(
              `Sent admin refund notification for order ${orderNumber}`
            );

            // Send system message to all admins
            const admins = await User.find({
              role: { $in: ["Super Admin", "Administrator"] },
            }).select("_id");

            if (admins.length > 0) {
              const adminIds = admins.map((admin) => admin._id.toString());
              const formatCurrency = (amount: number) =>
                `$${(amount / 100).toFixed(2)}`;

              await TrioNotificationService.createTrio({
                systemMessage: {
                  title: "Refund Completed",
                  content: `Refund completed for ${user.firstName} ${
                    user.lastName
                  } (${user.email}). Order ${purchase.orderNumber} - ${
                    typeof purchase.programId === "object"
                      ? purchase.programId.title
                      : "Program"
                  }. Amount: ${formatCurrency(purchase.finalPrice)}.`,
                  type: "announcement",
                  priority: "high",
                  hideCreator: true,
                  metadata: {
                    purchaseId: purchase._id.toString(),
                    userId: purchase.userId.toString(),
                    orderNumber: purchase.orderNumber,
                    refundAmount: purchase.finalPrice,
                  },
                },
                recipients: adminIds,
              });
              console.log(
                `Sent system message to ${adminIds.length} admins for refund ${orderNumber}`
              );
            }
          }
        } catch (emailError) {
          console.error(
            "Failed to send admin refund notification:",
            emailError
          );
        }

        console.log(
          `✅ Refund completed successfully for purchase ${orderNumber}`
        );
        break;

      case "failed":
        console.log(
          `Refund failed for purchase ${orderNumber}, updating status`
        );

        // Update purchase status
        purchase.status = "refund_failed";
        purchase.refundFailureReason = refund.failure_reason || "Refund failed";
        await purchase.save();

        // Send refund failed email to user
        try {
          await PurchaseEmailService.sendRefundFailedEmail({
            userEmail: purchase.billingInfo.email,
            userName: purchase.billingInfo.fullName,
            orderNumber: purchase.orderNumber,
            programTitle:
              typeof purchase.programId === "object"
                ? purchase.programId.title
                : "Program",
            failureReason: purchase.refundFailureReason || "Unknown error",
          });
          console.log(`Sent refund failed email for order ${orderNumber}`);
        } catch (emailError) {
          console.error("Failed to send refund failed email:", emailError);
        }

        console.log(
          `❌ Refund failed for purchase ${orderNumber}: ${refund.failure_reason}`
        );
        break;

      case "pending":
        console.log(
          `Refund is pending for purchase ${orderNumber}, no action needed`
        );
        break;

      case "canceled":
        console.log(
          `Refund was canceled for purchase ${orderNumber}, reverting to completed status`
        );

        // Revert to completed status if refund is canceled
        purchase.status = "completed";
        purchase.refundFailureReason =
          "Refund was canceled by payment processor";
        await purchase.save();

        // Notify user about cancellation
        try {
          await PurchaseEmailService.sendRefundFailedEmail({
            userEmail: purchase.billingInfo.email,
            userName: purchase.billingInfo.fullName,
            orderNumber: purchase.orderNumber,
            programTitle:
              typeof purchase.programId === "object"
                ? purchase.programId.title
                : "Program",
            failureReason:
              "The refund was canceled by the payment processor. This is rare and may indicate an issue with the original payment. Please contact support for assistance.",
          });
          console.log(
            `Sent refund cancellation notification for order ${orderNumber}`
          );
        } catch (emailError) {
          console.error("Failed to send refund canceled email:", emailError);
        }

        // Notify admins about the unusual cancellation
        try {
          const user = await User.findById(purchase.userId);
          if (user) {
            const admins = await User.find({
              role: { $in: ["Super Admin", "Administrator"] },
            }).select("_id");

            if (admins.length > 0) {
              const adminIds = admins.map((admin) => admin._id.toString());
              const formatCurrency = (amount: number) =>
                `$${(amount / 100).toFixed(2)}`;

              await TrioNotificationService.createTrio({
                systemMessage: {
                  title: "⚠️ Refund Canceled (Unusual)",
                  content: `Refund was CANCELED by payment processor for ${
                    user.firstName
                  } ${user.email}. Order ${purchase.orderNumber} - ${
                    typeof purchase.programId === "object"
                      ? purchase.programId.title
                      : "Program"
                  }. Amount: ${formatCurrency(
                    purchase.finalPrice
                  )}. This is unusual and may require investigation.`,
                  type: "alert",
                  priority: "high",
                  hideCreator: true,
                  metadata: {
                    purchaseId: purchase._id.toString(),
                    userId: purchase.userId.toString(),
                    orderNumber: purchase.orderNumber,
                    refundId: refund.id,
                  },
                },
                recipients: adminIds,
              });
              console.log(
                `Sent cancellation alert to ${adminIds.length} admins for order ${orderNumber}`
              );
            }
          }
        } catch (notifError) {
          console.error(
            "Failed to send admin notification for canceled refund:",
            notifError
          );
        }

        console.log(
          `⚠️ Refund canceled for purchase ${orderNumber}, reverted to completed status`
        );
        break;

      default:
        console.log(
          `Unhandled refund status: ${refund.status} for purchase ${orderNumber}`
        );
    }
  }

  /**
   * Handle donation checkout completion (one-time or recurring setup)
   */
  private static async handleDonationCheckout(
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
      donation.lastGiftDate = new Date(); // Set first gift date
      console.log(`Subscription created: ${donation.stripeSubscriptionId}`);

      // Get payment method details from the subscription
      let paymentMethod: { cardBrand?: string; last4?: string } = {};
      try {
        const { stripe } = await import("../services/stripeService");
        const subscription = await stripe.subscriptions.retrieve(
          donation.stripeSubscriptionId as string,
          { expand: ["default_payment_method"] }
        );

        const defaultPaymentMethod = subscription.default_payment_method;
        if (
          defaultPaymentMethod &&
          typeof defaultPaymentMethod === "object" &&
          "card" in defaultPaymentMethod
        ) {
          const card = (
            defaultPaymentMethod as {
              card?: { brand?: string; last4?: string };
            }
          ).card;
          if (card) {
            paymentMethod = {
              cardBrand: card.brand || undefined,
              last4: card.last4 || undefined,
            };
          }
        }
      } catch (error) {
        console.error("Error fetching subscription payment method:", error);
      }

      // Record the first transaction for the subscription
      // Note: For subscriptions created via checkout, we might not have a payment_intent yet
      // The payment_intent will come through invoice.payment_succeeded webhook
      // So we'll use an empty string as placeholder or skip recording here
      try {
        await DonationService.recordTransaction({
          donationId,
          userId,
          amount: donation.amount,
          type: donation.type,
          stripePaymentIntentId:
            (session.payment_intent as string) || `checkout_${session.id}`,
          paymentMethod,
        });
        console.log(
          `First transaction recorded for subscription donation ${donationId}`
        );
      } catch (error) {
        console.error("Error recording first transaction:", error);
        // Continue anyway - the invoice.payment_succeeded webhook will record it
      }

      // If there's an end date, schedule the subscription to cancel at that time
      if (donation.endDate) {
        try {
          const cancelAt = Math.floor(
            new Date(donation.endDate).getTime() / 1000
          );

          const { stripe } = await import("../services/stripeService");
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

          const { stripe } = await import("../services/stripeService");
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
    }

    await donation.save();
    console.log(`Donation ${donationId} updated with Stripe details`);
  }

  /**
   * Handle successful invoice payment (recurring donation)
   */
  private static async handleInvoicePaymentSucceeded(
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

        const { stripe } = await import("../services/stripeService");
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

    // Update last gift date
    donation.lastGiftDate = new Date();
    await donation.save();

    console.log(`Recurring donation payment recorded for ${donation._id}`);
  }

  /**
   * Handle failed invoice payment (recurring donation)
   */
  private static async handleInvoicePaymentFailed(
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

    // TODO: Send notification to user about failed payment
    console.log(`Donation ${donation._id} marked as failed`);
  }

  /**
   * Handle subscription updates (pause, resume, etc.)
   */
  private static async handleSubscriptionUpdated(
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
   */
  private static async handleSubscriptionDeleted(
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
