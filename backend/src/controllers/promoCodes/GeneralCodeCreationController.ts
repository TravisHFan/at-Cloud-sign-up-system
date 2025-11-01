/**
 * GeneralCodeCreationController
 * Handles creation of general staff promo codes
 * Extracted from promoCodeController.ts
 */

import { Request, Response } from "express";
import { PromoCode } from "../../models";

export default class GeneralCodeCreationController {
  /**
   * Create general staff access promo code (Admin only)
   * POST /api/promo-codes/staff/general
   * Body: { description: string, discountPercent: number, expiresAt?: Date, isGeneral: boolean }
   */
  static async createGeneralStaffCode(
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

      const { description, discountPercent, expiresAt } = req.body;

      // Validate required fields
      if (!description || typeof description !== "string") {
        res.status(400).json({
          success: false,
          message: "Description is required.",
        });
        return;
      }

      // Validate discount percent
      if (
        typeof discountPercent !== "number" ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        res.status(400).json({
          success: false,
          message: "Discount percent must be between 0 and 100.",
        });
        return;
      }

      // Validate expiration date if provided
      let validatedExpiresAt: Date | undefined;
      if (expiresAt) {
        const expiryDate = new Date(expiresAt);
        if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
          res.status(400).json({
            success: false,
            message: "Expiration date must be in the future.",
          });
          return;
        }
        validatedExpiresAt = expiryDate;
      }

      // Generate unique code
      const code = await PromoCode.generateUniqueCode();

      // Create general promo code (no owner, applies to all programs, unlimited uses)
      const promoCode = await PromoCode.create({
        code,
        type: "staff_access",
        description,
        discountPercent,
        expiresAt: validatedExpiresAt,
        createdBy: req.user.username || req.user.email,
        isGeneral: true, // Flag to indicate this is a general code
        // No ownerId - can be used by anyone
        // No allowedProgramIds - applies to all programs
        // No usage limit - unlimited uses
      });

      res.status(201).json({
        success: true,
        message: "General staff promo code created successfully.",
        data: {
          code: {
            _id: promoCode._id,
            code: promoCode.code,
            type: promoCode.type,
            description: promoCode.description,
            discountPercent: promoCode.discountPercent,
            expiresAt: promoCode.expiresAt,
            isActive: promoCode.isActive,
            isGeneral: true,
            createdAt: promoCode.createdAt,
            createdBy: promoCode.createdBy,
          },
        },
      });
    } catch (error) {
      console.error("Error creating general staff promo code:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create general staff promo code.",
      });
    }
  }
}
