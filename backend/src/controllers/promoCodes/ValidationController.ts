/**
 * ValidationController
 * Handles promo code validation operations
 * Extracted from promoCodeController.ts
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { PromoCode } from "../../models";

export default class ValidationController {
  /**
   * Validate promo code for a program
   * POST /api/promo-codes/validate
   * Body: { code: string, programId: string }
   */
  static async validatePromoCode(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { code, programId } = req.body;

      // Validate inputs
      if (!code || typeof code !== "string") {
        res.status(400).json({
          success: false,
          valid: false,
          message: "Promo code is required.",
        });
        return;
      }

      if (!programId || !mongoose.Types.ObjectId.isValid(programId)) {
        res.status(400).json({
          success: false,
          valid: false,
          message: "Valid program ID is required.",
        });
        return;
      }

      // Find promo code
      const promoCode = await PromoCode.findOne({
        code: code.toUpperCase(),
      }).populate("excludedProgramId", "title");

      if (!promoCode) {
        res.status(200).json({
          success: true,
          valid: false,
          message: "Invalid promo code.",
        });
        return;
      }

      // Check if code can be used for this program
      const canUseResult = promoCode.canBeUsedForProgram(
        new mongoose.Types.ObjectId(programId)
      );

      if (!canUseResult.valid) {
        let message = "This promo code cannot be used for this program.";

        if (!promoCode.isActive) {
          message = "This promo code has been deactivated.";
        } else if (promoCode.isUsed) {
          message = "This promo code has already been used.";
        } else if (promoCode.isExpired) {
          message = "This promo code has expired.";
        } else if (
          promoCode.excludedProgramId &&
          promoCode.excludedProgramId._id.toString() === programId
        ) {
          const excludedProgram = promoCode.excludedProgramId as unknown as {
            _id: mongoose.Types.ObjectId;
            name: string;
          };
          message = `This bundle code cannot be used for the program you purchased (${excludedProgram.name}).`;
        } else if (
          promoCode.allowedProgramIds &&
          promoCode.allowedProgramIds.length > 0 &&
          !promoCode.allowedProgramIds.some(
            (id: mongoose.Types.ObjectId) => id.toString() === programId
          )
        ) {
          message = "This staff code is not valid for this program.";
        }

        res.status(200).json({
          success: true,
          valid: false,
          message,
        });
        return;
      }

      // Check ownership for personal promo codes (skip for general codes)
      const userId = req.user._id as mongoose.Types.ObjectId;
      if (!promoCode.isGeneral) {
        if (
          !promoCode.ownerId ||
          promoCode.ownerId.toString() !== userId.toString()
        ) {
          res.status(200).json({
            success: true,
            valid: false,
            message: "This promo code belongs to another user.",
          });
          return;
        }
      }

      // Valid code
      res.status(200).json({
        success: true,
        valid: true,
        message: "Promo code is valid.",
        discount: {
          type: promoCode.discountAmount
            ? ("amount" as const)
            : ("percent" as const),
          value: promoCode.discountAmount || promoCode.discountPercent || 0,
        },
        code: {
          _id: promoCode._id,
          code: promoCode.code,
          type: promoCode.type,
          discountAmount: promoCode.discountAmount,
          discountPercent: promoCode.discountPercent,
          expiresAt: promoCode.expiresAt,
        },
      });
    } catch (error) {
      console.error("Error validating promo code:", error);
      res.status(500).json({
        success: false,
        valid: false,
        message: "Failed to validate promo code.",
      });
    }
  }
}
