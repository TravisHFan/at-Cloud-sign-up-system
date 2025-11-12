import { Request, Response } from "express";
import PromoCode from "../../models/PromoCode";
import mongoose from "mongoose";
import { createLogger } from "../../services/LoggerService";

const log = createLogger("DeletionController");

export default class DeletionController {
  /**
   * Delete a promo code (Admin only)
   * DELETE /api/promo-codes/:id
   */
  static async deletePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate promo code ID
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Valid promo code ID is required.",
        });
        return;
      }

      // Find promo code
      const promoCode = await PromoCode.findById(id).populate(
        "ownerId",
        "username email firstName lastName"
      );
      if (!promoCode) {
        res.status(404).json({
          success: false,
          message: "Promo code not found.",
        });
        return;
      }

      // Store info for logging before deletion
      const codeInfo = {
        code: promoCode.code,
        type: promoCode.type,
        isUsed: promoCode.isUsed,
        isActive: promoCode.isActive,
        ownerId: promoCode.ownerId,
      };

      // Delete the promo code
      await PromoCode.findByIdAndDelete(id);

      log.info("Promo code deleted by admin", undefined, {
        promoCodeId: id,
        code: codeInfo.code,
        type: codeInfo.type,
        wasUsed: codeInfo.isUsed,
        wasActive: codeInfo.isActive,
        adminId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        message: `Promo code ${codeInfo.code} has been permanently deleted.`,
      });
    } catch (error) {
      log.error("Failed to delete promo code", error as Error, undefined, {
        promoCodeId: req.params.id,
        adminId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        message: "Failed to delete promo code. Please try again.",
      });
    }
  }
}
