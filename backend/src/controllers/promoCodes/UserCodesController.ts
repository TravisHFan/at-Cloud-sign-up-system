/**
 * UserCodesController
 * Handles user's promo code retrieval operations
 * Extracted from promoCodeController.ts
 */

import { Request, Response } from "express";
import { PromoCode } from "../../models";

export default class UserCodesController {
  /**
   * Get current user's promo codes
   * GET /api/promo-codes/my-codes?status=all|active|expired|used
   */
  static async getMyPromoCodes(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const userId = req.user._id;
      const { status } = req.query;

      // Build query
      const query: Record<string, unknown> = { ownerId: userId };

      // Apply status filter
      if (status === "active") {
        query.isActive = true;
        query.isUsed = false;
        query.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];
      } else if (status === "expired") {
        query.expiresAt = { $lte: new Date() };
        query.isUsed = false;
      } else if (status === "used") {
        query.isUsed = true;
      }
      // 'all' or undefined = no additional filters

      // Fetch codes
      const codes = await PromoCode.find(query)
        .populate("usedForProgramId", "title")
        .populate("excludedProgramId", "title")
        .populate("allowedProgramIds", "title")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        codes: codes.map((code) => {
          // Extract allowed program titles if populated
          const allowedProgramTitles = code.allowedProgramIds
            ? (
                code.allowedProgramIds as unknown as Array<{
                  _id: string;
                  title: string;
                }>
              )
                .map((p) => p.title)
                .filter(Boolean)
            : undefined;

          return {
            _id: code._id,
            code: code.code,
            type: code.type,
            discountAmount: code.discountAmount,
            discountPercent: code.discountPercent,
            isActive: code.isActive,
            isUsed: code.isUsed,
            isExpired: code.isExpired,
            isValid: code.isValid,
            expiresAt: code.expiresAt,
            usedAt: code.usedAt,
            usedForProgramId: code.usedForProgramId,
            usedForProgramTitle: (
              code.usedForProgramId as unknown as { title?: string }
            )?.title,
            excludedProgramId: code.excludedProgramId,
            allowedProgramIds: code.allowedProgramIds
              ? (
                  code.allowedProgramIds as unknown as Array<{ _id: string }>
                ).map((p) => p._id.toString())
              : undefined,
            allowedProgramTitles,
            createdAt: code.createdAt,
          };
        }),
      });
    } catch (error) {
      console.error("Error fetching user promo codes:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch promo codes.",
      });
    }
  }
}
