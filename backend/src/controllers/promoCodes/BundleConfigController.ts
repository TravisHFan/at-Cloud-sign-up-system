/**
 * BundleConfigController
 * Handles bundle discount configuration operations
 * Extracted from promoCodeController.ts
 */

import { Request, Response } from "express";
import { SystemConfig } from "../../models";

export default class BundleConfigController {
  /**
   * Get bundle discount configuration
   * GET /api/promo-codes/config
   */
  static async getBundleConfig(req: Request, res: Response): Promise<void> {
    try {
      // Read from SystemConfig model
      const config = await SystemConfig.getBundleDiscountConfig();

      res.status(200).json({
        success: true,
        data: {
          config,
        },
      });
    } catch (error) {
      console.error("Error fetching bundle config:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch bundle discount configuration.",
      });
    }
  }

  /**
   * Update bundle discount configuration (Admin only)
   * PUT /api/promo-codes/config
   * Body: { enabled: boolean, discountAmount: number, expiryDays: number }
   */
  static async updateBundleConfig(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { enabled, discountAmount, expiryDays } = req.body;

      // Validate inputs
      if (typeof enabled !== "boolean") {
        res.status(400).json({
          success: false,
          message: "enabled must be a boolean.",
        });
        return;
      }

      if (
        typeof discountAmount !== "number" ||
        discountAmount < 1000 ||
        discountAmount > 20000
      ) {
        res.status(400).json({
          success: false,
          message:
            "discountAmount must be between $10 (1000) and $200 (20000).",
        });
        return;
      }

      if (
        typeof expiryDays !== "number" ||
        expiryDays < 7 ||
        expiryDays > 365
      ) {
        res.status(400).json({
          success: false,
          message: "expiryDays must be between 7 and 365.",
        });
        return;
      }

      // Update SystemConfig model
      const updatedBy = req.user.username || req.user.email;
      const updatedConfig = await SystemConfig.updateBundleDiscountConfig(
        {
          enabled,
          discountAmount,
          expiryDays,
        },
        updatedBy
      );

      res.status(200).json({
        success: true,
        message: "Bundle discount configuration updated successfully.",
        data: {
          config: {
            enabled: updatedConfig.value.enabled as boolean,
            discountAmount: updatedConfig.value.discountAmount as number,
            expiryDays: updatedConfig.value.expiryDays as number,
          },
        },
      });
    } catch (error) {
      console.error("Error updating bundle config:", error);

      // Check if it's a validation error from the model
      if (error instanceof Error && error.message) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to update bundle discount configuration.",
      });
    }
  }
}
