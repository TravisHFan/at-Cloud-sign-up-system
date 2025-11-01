/**
 * UsageHistoryController
 * Handles promo code usage history retrieval
 * Extracted from promoCodeController.ts
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { PromoCode } from "../../models";

export default class UsageHistoryController {
  /**
   * Get promo code usage history (Admin only)
   * GET /api/promo-codes/:id/usage-history
   */
  static async getPromoCodeUsageHistory(
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

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid promo code ID." });
        return;
      }

      // Find the promo code
      const promoCode = await PromoCode.findById(id)
        .populate("usageHistory.userId", "firstName lastName email username")
        .populate("usageHistory.programId", "title");

      if (!promoCode) {
        res
          .status(404)
          .json({ success: false, message: "Promo code not found." });
        return;
      }

      // Return usage history
      res.status(200).json({
        success: true,
        data: {
          code: promoCode.code,
          type: promoCode.type,
          isGeneral: promoCode.isGeneral || false,
          description: promoCode.description,
          usageHistory: promoCode.usageHistory || [],
          usageCount: promoCode.usageHistory?.length || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching promo code usage history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch usage history.",
      });
    }
  }
}
