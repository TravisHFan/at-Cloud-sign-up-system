import { Request, Response } from "express";
import mongoose from "mongoose";
import Purchase from "../../models/Purchase";

/**
 * PurchaseReceiptController
 * Handles purchase receipt generation and retrieval
 */
class PurchaseReceiptController {
  /**
   * Get purchase receipt data
   * GET /api/purchases/:id/receipt
   */
  static async getPurchaseReceipt(req: Request, res: Response): Promise<void> {
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

      const purchase = await Purchase.findById(id)
        .populate("programId", "title programType hostedBy")
        .populate("eventId", "title")
        .populate("userId", "firstName lastName email");

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Admins can view any receipt
      const isAdmin =
        req.user.role === "Super Admin" || req.user.role === "Administrator";

      // Check if user owns this purchase
      const purchaseUserId =
        typeof purchase.userId === "object" && "_id" in purchase.userId
          ? (purchase.userId._id as mongoose.Types.ObjectId).toString()
          : (purchase.userId as mongoose.Types.ObjectId).toString();

      const isOwner =
        purchaseUserId === (req.user._id as mongoose.Types.ObjectId).toString();

      // Allow access if user is owner or admin
      if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, message: "Access denied." });
        return;
      }

      // Only show receipt for completed purchases
      if (purchase.status !== "completed") {
        // Provide specific message for refunded purchases
        if (
          purchase.status === "refunded" ||
          purchase.status === "refund_processing"
        ) {
          res.status(400).json({
            success: false,
            message:
              "This purchase has been refunded. Receipts are not available for refunded purchases.",
          });
          return;
        }

        // Generic message for other statuses
        res.status(400).json({
          success: false,
          message: "Receipt is only available for completed purchases.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("Error fetching receipt:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch receipt.",
      });
    }
  }
}

export default PurchaseReceiptController;
