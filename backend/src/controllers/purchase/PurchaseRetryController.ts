import { Request, Response } from "express";
import mongoose from "mongoose";
import Purchase from "../../models/Purchase";
import type { IProgram } from "../../models/Program";
import { createCheckoutSession as stripeCreateCheckoutSession } from "../../services/stripeService";

/**
 * PurchaseRetryController
 * Handles retrying failed or pending purchases
 */
class PurchaseRetryController {
  /**
   * Retry a pending purchase - creates a new checkout session
   * POST /api/purchases/retry/:id
   * Validates that user hasn't already purchased the program
   */
  static async retryPendingPurchase(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      // Find the pending purchase
      const pendingPurchase = await Purchase.findById(id)
        .populate("programId")
        .populate("eventId");

      if (!pendingPurchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Verify ownership
      if (
        pendingPurchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You can only retry your own purchases.",
        });
        return;
      }

      // Verify it's still pending
      if (pendingPurchase.status !== "pending") {
        res.status(400).json({
          success: false,
          message: `Cannot retry a ${pendingPurchase.status} purchase.`,
        });
        return;
      }

      // CRITICAL: Check if user already has a completed purchase for this item
      let existingCompletedPurchase = null;
      if (pendingPurchase.purchaseType === "program") {
        existingCompletedPurchase = await Purchase.findOne({
          userId: req.user._id,
          programId: pendingPurchase.programId,
          status: "completed",
        });
      } else if (pendingPurchase.purchaseType === "event") {
        existingCompletedPurchase = await Purchase.findOne({
          userId: req.user._id,
          eventId: pendingPurchase.eventId,
          status: "completed",
        });
      }

      if (existingCompletedPurchase) {
        const itemType =
          pendingPurchase.purchaseType === "event" ? "event" : "program";
        res.status(400).json({
          success: false,
          message: `You have already purchased this ${itemType}. Check your purchase history.`,
        });
        return;
      }

      // Create new Stripe checkout session based on purchase type
      let session;

      if (pendingPurchase.purchaseType === "program") {
        const program = pendingPurchase.programId as unknown as IProgram;

        session = await stripeCreateCheckoutSession({
          userId: (req.user._id as mongoose.Types.ObjectId).toString(),
          userEmail: req.user.email,
          programId: (program._id as mongoose.Types.ObjectId).toString(),
          programTitle: program.title,
          fullPrice: pendingPurchase.fullPrice,
          classRepDiscount: pendingPurchase.classRepDiscount,
          earlyBirdDiscount: pendingPurchase.earlyBirdDiscount,
          finalPrice: pendingPurchase.finalPrice,
          isClassRep: pendingPurchase.isClassRep,
          isEarlyBird: pendingPurchase.isEarlyBird,
        });
      } else {
        // Event purchase retry
        const { default: Event } = await import("../../models/Event");
        const event = await Event.findById(pendingPurchase.eventId);

        if (!event) {
          res.status(404).json({
            success: false,
            message: "Event not found.",
          });
          return;
        }

        const { stripe } = await import("../../services/stripeService");

        session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: event.title,
                  description: `Event on ${new Date(
                    event.date
                  ).toLocaleDateString()}`,
                },
                unit_amount: Math.round(pendingPurchase.finalPrice),
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.FRONTEND_URL}/dashboard/events/${event._id}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/dashboard/purchase/cancel?event_id=${event._id}`,
          customer_email: req.user.email,
          metadata: {
            userId: (req.user._id as mongoose.Types.ObjectId).toString(),
            eventId: (event._id as mongoose.Types.ObjectId).toString(),
            purchaseId: pendingPurchase._id.toString(),
          },
        });
      }

      // Update the pending purchase with new session ID
      pendingPurchase.stripeSessionId = session.id;
      await pendingPurchase.save();

      console.log(
        `Created new checkout session for pending purchase ${pendingPurchase.orderNumber}`
      );

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
        },
      });
    } catch (error) {
      console.error("Error retrying purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retry purchase.",
        error: (error as Error).message,
      });
    }
  }
}

export default PurchaseRetryController;
