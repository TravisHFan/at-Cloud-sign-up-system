import { Request, Response } from "express";
import Purchase from "../../models/Purchase";

/**
 * PurchaseHistoryController
 * Handles user's completed purchase history
 */
class PurchaseHistoryController {
  /**
   * Get user's purchase history
   * GET /api/purchases/my-purchases
   */
  static async getMyPurchases(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const purchases = await Purchase.find({
        userId: req.user._id,
        status: "completed",
      })
        .populate("programId", "title programType")
        .sort({ purchaseDate: -1 });

      res.status(200).json({
        success: true,
        data: purchases,
      });
    } catch (error) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch purchase history.",
      });
    }
  }
}

export default PurchaseHistoryController;
