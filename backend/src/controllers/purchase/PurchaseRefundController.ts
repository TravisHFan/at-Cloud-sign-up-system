import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase } from "../../models";
import { processRefund } from "../../services/stripeService";
import { PurchaseEmailService } from "../../services/email/domains/PurchaseEmailService";

/**
 * PurchaseRefundController
 * Handles refund requests and eligibility checks for purchases
 */
class PurchaseRefundController {
  /**
   * Check refund eligibility for a purchase
   * GET /api/purchases/refund-eligibility/:purchaseId
   */
  static async checkRefundEligibility(
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

      const { purchaseId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(purchaseId).populate(
        "programId",
        "title"
      );

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Verify ownership
      if (
        purchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You don't have permission to refund this purchase.",
        });
        return;
      }

      // Check if purchase is eligible for refund
      const eligibility = this.calculateRefundEligibility(purchase);

      res.status(200).json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      console.error("Error checking refund eligibility:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check refund eligibility.",
      });
    }
  }

  /**
   * Initiate a refund for a completed purchase
   * POST /api/purchases/refund
   * Body: { purchaseId: string }
   */
  static async initiateRefund(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { purchaseId } = req.body;

      if (!purchaseId || !mongoose.Types.ObjectId.isValid(purchaseId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(purchaseId).populate(
        "programId",
        "title programType"
      );

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Verify ownership
      if (
        purchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You don't have permission to refund this purchase.",
        });
        return;
      }

      // Check eligibility
      const eligibility = this.calculateRefundEligibility(purchase);

      if (!eligibility.isEligible) {
        res.status(400).json({
          success: false,
          message: eligibility.reason || "Purchase is not eligible for refund.",
          data: eligibility,
        });
        return;
      }

      // Check if already refunding or refunded
      if (
        purchase.status === "refund_processing" ||
        purchase.status === "refunded"
      ) {
        res.status(400).json({
          success: false,
          message:
            "This purchase is already being refunded or has been refunded.",
        });
        return;
      }

      // Update purchase status to refund_processing
      purchase.status = "refund_processing";
      purchase.refundInitiatedAt = new Date();
      await purchase.save();

      // Send refund initiated email to user
      try {
        await PurchaseEmailService.sendRefundInitiatedEmail({
          userEmail: purchase.billingInfo.email,
          userName: purchase.billingInfo.fullName,
          orderNumber: purchase.orderNumber,
          programTitle:
            typeof purchase.programId === "object"
              ? purchase.programId.title
              : "Program",
          refundAmount: purchase.finalPrice,
          purchaseDate: purchase.purchaseDate,
        });
      } catch (emailError) {
        console.error("Failed to send refund initiated email:", emailError);
        // Continue with refund even if email fails
      }

      // Process refund with Stripe
      try {
        if (!purchase.stripePaymentIntentId) {
          throw new Error("No payment intent found for this purchase");
        }

        const refund = await processRefund({
          paymentIntentId: purchase.stripePaymentIntentId,
          amount: purchase.finalPrice,
          reason: "requested_by_customer",
          metadata: {
            purchaseId: purchase._id.toString(),
            orderNumber: purchase.orderNumber,
            userId: (req.user._id as mongoose.Types.ObjectId).toString(),
          },
        });

        // Update purchase with refund ID
        purchase.stripeRefundId = refund.id;
        await purchase.save();

        // Note: The webhook handler will update status to 'refunded' and send completion email
        // when Stripe confirms the refund

        res.status(200).json({
          success: true,
          message:
            "Refund initiated successfully. You will receive an email confirmation shortly.",
          data: {
            purchaseId: purchase._id,
            orderNumber: purchase.orderNumber,
            refundId: refund.id,
            status: purchase.status,
          },
        });
      } catch (stripeError) {
        console.error("Stripe refund error:", stripeError);

        // Update purchase status to refund_failed
        purchase.status = "refund_failed";
        purchase.refundFailureReason =
          stripeError instanceof Error ? stripeError.message : "Unknown error";
        await purchase.save();

        // Send refund failed email
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
        } catch (emailError) {
          console.error("Failed to send refund failed email:", emailError);
        }

        res.status(500).json({
          success: false,
          message: "Failed to process refund. Please contact support.",
          error:
            stripeError instanceof Error
              ? stripeError.message
              : "Unknown error",
        });
      }
    } catch (error) {
      console.error("Error initiating refund:", error);
      res.status(500).json({
        success: false,
        message: "Failed to initiate refund.",
      });
    }
  }

  /**
   * Calculate refund eligibility for a purchase
   * @private
   */
  private static calculateRefundEligibility(purchase: any): {
    isEligible: boolean;
    reason?: string;
    daysRemaining?: number;
    purchaseDate: Date;
    refundDeadline: Date;
  } {
    const REFUND_WINDOW_DAYS = 30;
    const now = new Date();
    const purchaseDate = new Date(purchase.purchaseDate);
    const refundDeadline = new Date(purchaseDate);
    refundDeadline.setDate(refundDeadline.getDate() + REFUND_WINDOW_DAYS);

    const daysElapsed = Math.floor(
      (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = REFUND_WINDOW_DAYS - daysElapsed;

    // Check if purchase is completed or in refund_failed state
    // Note: "refunded" status is also caught here - Only completed/refund_failed purchases can be refunded
    if (
      purchase.status !== "completed" &&
      purchase.status !== "refund_failed"
    ) {
      return {
        isEligible: false,
        reason: `Purchase status is "${purchase.status}". Only completed purchases can be refunded.`,
        purchaseDate,
        refundDeadline,
      };
    }

    // Check if within 30-day window
    if (now > refundDeadline) {
      return {
        isEligible: false,
        reason: `Refund window has expired. Refunds are only available within ${REFUND_WINDOW_DAYS} days of purchase.`,
        daysRemaining: 0,
        purchaseDate,
        refundDeadline,
      };
    }

    // Eligible for refund
    return {
      isEligible: true,
      reason: `You have ${daysRemaining} day${
        daysRemaining !== 1 ? "s" : ""
      } remaining to request a refund.`,
      daysRemaining,
      purchaseDate,
      refundDeadline,
    };
  }
}

export default PurchaseRefundController;
