import { Request, Response } from "express";
import Purchase from "../../models/Purchase";

/**
 * PurchaseVerificationController
 * Handles Stripe session verification after payment
 */
class PurchaseVerificationController {
  /**
   * Verify Stripe session and get purchase details
   * GET /api/purchases/verify-session/:sessionId
   */
  static async verifySession(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { sessionId } = req.params;

      if (!sessionId) {
        res
          .status(400)
          .json({ success: false, message: "Session ID is required." });
        return;
      }

      // Find purchase by session ID and user ID
      // Note: We don't filter by status here because purchase might still be "pending"
      // when user lands on success page (webhook might not have processed yet)
      const purchase = await Purchase.findOne({
        stripeSessionId: sessionId,
        userId: req.user._id,
      }).populate("programId", "title programType");

      if (!purchase) {
        res.status(404).json({
          success: false,
          message: "Purchase not found. Please wait a moment and try again.",
        });
        return;
      }

      console.log("✅ Purchase found:", {
        id: purchase._id,
        orderNumber: purchase.orderNumber,
        programId: purchase.programId,
        status: purchase.status,
      });

      res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("Error verifying session:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify session.",
      });
    }
  }
}

export default PurchaseVerificationController;
