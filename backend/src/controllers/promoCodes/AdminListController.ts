/**
 * AdminListController
 * Handles admin promo code listing with filters and pagination
 * Extracted from promoCodeController.ts
 */

import { Request, Response } from "express";
import { PromoCode, User } from "../../models";
import { PopulatedUser, PopulatedProgram } from "./types";

export default class AdminListController {
  /**
   * Get all promo codes (Admin only)
   * GET /api/promo-codes?type=all|bundle_discount|staff_access&status=all|active|used|expired&search=CODE&page=1&limit=20
   */
  static async getAllPromoCodes(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,
        status,
        search,
        page = "1",
        limit = "20",
      } = req.query as Record<string, string>;

      // Build query
      const query: Record<string, unknown> = {};

      // Filter by type
      if (type && type !== "all") {
        if (type === "bundle_discount" || type === "staff_access") {
          query.type = type;
        }
      }

      // Filter by status
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

      // Search by code or owner
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), "i");
        // Try to find user by name or email
        const users = await User.find({
          $or: [
            { username: searchRegex },
            { email: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex },
          ],
        }).select("_id");

        const userIds = users.map((u) => u._id);

        query.$or = [
          { code: searchRegex },
          { ownerId: { $in: userIds } },
        ] as unknown[];
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      // Fetch codes with pagination
      const [codes, total] = await Promise.all([
        PromoCode.find(query)
          .populate("ownerId", "username email firstName lastName")
          .populate("usedForProgramId", "title")
          .populate("excludedProgramId", "title")
          .populate("allowedProgramIds", "title")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        PromoCode.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        codes: codes.map((code) => {
          const ownerIdPopulated =
            typeof code.ownerId === "object" && code.ownerId !== null
              ? (code.ownerId as unknown as PopulatedUser)
              : null;

          const usedForProgramPopulated =
            typeof code.usedForProgramId === "object" &&
            code.usedForProgramId !== null
              ? (code.usedForProgramId as unknown as PopulatedProgram)
              : null;

          return {
            _id: code._id,
            code: code.code,
            type: code.type,
            discountAmount: code.discountAmount,
            discountPercent: code.discountPercent,
            isGeneral: code.isGeneral,
            ownerId: ownerIdPopulated ? ownerIdPopulated._id : code.ownerId,
            ownerEmail: ownerIdPopulated?.email,
            ownerName: ownerIdPopulated
              ? `${ownerIdPopulated.firstName || ""} ${
                  ownerIdPopulated.lastName || ""
                }`.trim() || ownerIdPopulated.username
              : undefined,
            isActive: code.isActive,
            isUsed: code.isUsed,
            isExpired: code.isExpired,
            isValid: code.isValid,
            expiresAt: code.expiresAt,
            usedAt: code.usedAt,
            usedForProgramId: usedForProgramPopulated
              ? usedForProgramPopulated._id
              : code.usedForProgramId,
            usedForProgramTitle: usedForProgramPopulated?.title,
            excludedProgramId: code.excludedProgramId,
            allowedProgramIds: code.allowedProgramIds,
            createdAt: code.createdAt,
            createdBy: code.createdBy,
          };
        }),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching all promo codes:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch promo codes.",
      });
    }
  }
}
