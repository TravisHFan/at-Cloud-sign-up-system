import { Request, Response } from "express";
import mongoose from "mongoose";
import { PromoCode, User, SystemConfig } from "../models";
import { EmailService } from "../services";

// Type for populated user reference
interface PopulatedUser {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username: string;
}

// Type for populated program reference
interface PopulatedProgram {
  _id: string;
  title: string;
}

export class PromoCodeController {
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

      // Check ownership for ALL promo codes (one-time, one-person)
      const userId = req.user._id as mongoose.Types.ObjectId;
      if (promoCode.ownerId.toString() !== userId.toString()) {
        res.status(200).json({
          success: true,
          valid: false,
          message: "This promo code belongs to another user.",
        });
        return;
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

  /**
   * Create staff access promo code (Admin only)
   * POST /api/promo-codes/staff
   * Body: { userId: string, discountPercent: number, allowedProgramIds?: string[], expiresAt?: Date }
   */
  static async createStaffCode(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { userId, discountPercent, allowedProgramIds, expiresAt } =
        req.body;

      // Validate user ID
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({
          success: false,
          message: "Valid user ID is required.",
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

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Validate allowed program IDs if provided
      let validatedProgramIds: mongoose.Types.ObjectId[] | undefined;
      if (allowedProgramIds && Array.isArray(allowedProgramIds)) {
        if (allowedProgramIds.length > 0) {
          const allValid = allowedProgramIds.every((id) =>
            mongoose.Types.ObjectId.isValid(id)
          );
          if (!allValid) {
            res.status(400).json({
              success: false,
              message: "Invalid program ID in allowedProgramIds.",
            });
            return;
          }
          validatedProgramIds = allowedProgramIds.map(
            (id) => new mongoose.Types.ObjectId(id)
          );
        }
      }

      // Validate expiration date
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

      // Create promo code
      const promoCode = await PromoCode.create({
        code,
        type: "staff_access",
        ownerId: new mongoose.Types.ObjectId(userId),
        discountPercent,
        allowedProgramIds: validatedProgramIds,
        expiresAt: validatedExpiresAt,
        createdBy: req.user.username || req.user.email,
      });

      // Populate for response
      await promoCode.populate("ownerId", "username email firstName lastName");
      if (validatedProgramIds && validatedProgramIds.length > 0) {
        await promoCode.populate("allowedProgramIds", "title");
      }

      // Send notifications to the code recipient
      try {
        const owner = promoCode.ownerId as unknown as {
          _id: string;
          email: string;
          firstName?: string;
          lastName?: string;
          username: string;
        };
        const recipientName =
          owner.firstName && owner.lastName
            ? `${owner.firstName} ${owner.lastName}`
            : owner.username;

        // Get program names for email
        const allowedPrograms =
          validatedProgramIds && validatedProgramIds.length > 0
            ? (
                promoCode.allowedProgramIds as unknown as Array<{
                  title: string;
                }>
              )
                .map((p) => p.title)
                .join(", ")
            : undefined;

        // Send email notification
        await EmailService.sendStaffPromoCodeEmail({
          recipientEmail: owner.email,
          recipientName,
          promoCode: promoCode.code,
          discountPercent: promoCode.discountPercent ?? 100,
          allowedPrograms,
          expiresAt: promoCode.expiresAt?.toISOString(),
          createdBy: req.user.username || req.user.email,
        });

        // Create system message/notification using UnifiedMessageController pattern
        const { UnifiedMessageController } = await import(
          "./unifiedMessageController"
        );

        // Format creator name: System Auth Level + Full Name
        const creatorFullName =
          req.user.firstName && req.user.lastName
            ? `${req.user.firstName} ${req.user.lastName}`
            : req.user.username || req.user.email;
        const creatorAuthLevel = req.user.role || "Administrator"; // System auth level (Super Admin, Administrator, etc.)
        const creatorDisplay = `${creatorAuthLevel} ${creatorFullName}`;

        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: "🎁 You've Received a Staff Access Code",
            content: `You've been granted a ${
              promoCode.discountPercent ?? 100
            }% discount code${
              allowedPrograms ? ` for ${allowedPrograms}` : " for all programs"
            } by ${creatorDisplay}.\n\nUse code: ${promoCode.code}`,
            type: "announcement",
            priority: "high",
            hideCreator: false,
            metadata: {
              promoCodeId: String(promoCode._id),
              promoCode: promoCode.code,
              linkUrl: "/dashboard/promo-codes",
            },
          },
          [owner._id], // Target specific user
          {
            id: req.user.id,
            firstName: req.user.firstName || "",
            lastName: req.user.lastName || "",
            username: req.user.username || req.user.email,
            avatar: req.user.avatar,
            gender: req.user.gender || "male",
            authLevel: req.user.roleInAtCloud || "Administrator",
            roleInAtCloud: req.user.roleInAtCloud,
          }
        );

        console.log(
          `Sent notifications to ${owner.email} for staff code ${promoCode.code}`
        );
      } catch (notificationError) {
        // Log but don't fail the request if notifications fail
        console.error(
          "Failed to send notifications for staff promo code:",
          notificationError
        );
      }

      // Get owner info for response
      const ownerInfo = promoCode.ownerId as unknown as {
        _id: string;
        email: string;
        firstName?: string;
        lastName?: string;
        username: string;
      };
      const ownerName =
        ownerInfo.firstName && ownerInfo.lastName
          ? `${ownerInfo.firstName} ${ownerInfo.lastName}`
          : ownerInfo.username;

      res.status(201).json({
        success: true,
        message: "Staff promo code created successfully.",
        data: {
          code: {
            _id: promoCode._id,
            code: promoCode.code,
            type: promoCode.type,
            discountPercent: promoCode.discountPercent,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ownerId: (promoCode.ownerId as any)?._id || promoCode.ownerId,
            ownerEmail: ownerInfo.email,
            ownerName,
            allowedProgramIds: promoCode.allowedProgramIds,
            expiresAt: promoCode.expiresAt,
            isActive: promoCode.isActive,
            createdAt: promoCode.createdAt,
            createdBy: promoCode.createdBy,
          },
        },
      });
    } catch (error) {
      console.error("Error creating staff promo code:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create staff promo code.",
      });
    }
  }

  /**
   * Get bundle discount configuration (Admin only)
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

  /**
   * Deactivate a promo code (Admin only)
   * PUT /api/promo-codes/:id/deactivate
   */
  static async deactivatePromoCode(req: Request, res: Response): Promise<void> {
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

      // Find and deactivate promo code
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

      // Check if already inactive
      if (!promoCode.isActive) {
        res.status(400).json({
          success: false,
          message: "Promo code is already deactivated.",
        });
        return;
      }

      // Populate programs if needed
      if (
        promoCode.allowedProgramIds &&
        promoCode.allowedProgramIds.length > 0
      ) {
        await promoCode.populate("allowedProgramIds", "title");
      }

      // Deactivate
      await promoCode.deactivate();

      // Send notifications to the code owner
      try {
        if (!req.user) {
          console.warn("No user found in request, skipping notifications");
        } else {
          const owner = promoCode.ownerId as unknown as {
            _id: string;
            email: string;
            firstName?: string;
            lastName?: string;
            username: string;
          };
          const recipientName =
            owner.firstName && owner.lastName
              ? `${owner.firstName} ${owner.lastName}`
              : owner.username;

          // Get program names for notifications
          const allowedPrograms =
            promoCode.allowedProgramIds &&
            promoCode.allowedProgramIds.length > 0
              ? (
                  promoCode.allowedProgramIds as unknown as Array<{
                    title: string;
                  }>
                )
                  .map((p) => p.title)
                  .join(", ")
              : undefined;

          // Format actor name: System Auth Level + Full Name
          const actorFullName =
            req.user.firstName && req.user.lastName
              ? `${req.user.firstName} ${req.user.lastName}`
              : req.user.username || req.user.email;
          const actorAuthLevel = req.user.role || "Administrator";
          const actorDisplay = `${actorAuthLevel} ${actorFullName}`;

          // Send email notification
          await EmailService.sendPromoCodeDeactivatedEmail({
            recipientEmail: owner.email,
            recipientName,
            promoCode: promoCode.code,
            discountPercent: promoCode.discountPercent ?? 100,
            allowedPrograms,
            deactivatedBy: actorDisplay,
          });

          // Create system message/notification
          const { UnifiedMessageController } = await import(
            "./unifiedMessageController"
          );
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "⛔ Your Promo Code Has Been Deactivated",
              content: `Your promo code ${promoCode.code} (${
                promoCode.discountPercent ?? 100
              }% discount${
                allowedPrograms
                  ? ` for ${allowedPrograms}`
                  : " for all programs"
              }) has been deactivated by ${actorDisplay}.\n\nThis code can no longer be used for enrollment.`,
              type: "warning",
              priority: "high",
              hideCreator: false,
              metadata: {
                promoCodeId: String(promoCode._id),
                promoCode: promoCode.code,
                linkUrl: "/dashboard/promo-codes",
              },
            },
            [owner._id],
            {
              id: req.user.id,
              firstName: req.user.firstName || "",
              lastName: req.user.lastName || "",
              username: req.user.username || req.user.email,
              avatar: req.user.avatar,
              gender: req.user.gender || "male",
              authLevel: req.user.role || "Administrator",
              roleInAtCloud: req.user.roleInAtCloud,
            }
          );

          console.log(
            `Sent deactivation notifications to ${owner.email} for code ${promoCode.code}`
          );
        }
      } catch (notificationError) {
        // Log but don't fail the request if notifications fail
        console.error(
          "Failed to send deactivation notifications:",
          notificationError
        );
      }

      res.status(200).json({
        success: true,
        message: "Promo code deactivated successfully.",
        code: {
          _id: promoCode._id,
          code: promoCode.code,
          isActive: promoCode.isActive,
        },
      });
    } catch (error) {
      console.error("Error deactivating promo code:", error);
      res.status(500).json({
        success: false,
        message: "Failed to deactivate promo code.",
      });
    }
  }

  /**
   * Reactivate a promo code (Admin only)
   * PUT /api/promo-codes/:id/reactivate
   */
  static async reactivatePromoCode(req: Request, res: Response): Promise<void> {
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

      // Find and reactivate promo code
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

      // Check if already active
      if (promoCode.isActive) {
        res.status(400).json({
          success: false,
          message: "Promo code is already active.",
        });
        return;
      }

      // Populate programs if needed
      if (
        promoCode.allowedProgramIds &&
        promoCode.allowedProgramIds.length > 0
      ) {
        await promoCode.populate("allowedProgramIds", "title");
      }

      // Reactivate
      await promoCode.reactivate();

      // Send notifications to the code owner
      try {
        if (!req.user) {
          console.warn("No user found in request, skipping notifications");
        } else {
          const owner = promoCode.ownerId as unknown as {
            _id: string;
            email: string;
            firstName?: string;
            lastName?: string;
            username: string;
          };
          const recipientName =
            owner.firstName && owner.lastName
              ? `${owner.firstName} ${owner.lastName}`
              : owner.username;

          // Get program names for notifications
          const allowedPrograms =
            promoCode.allowedProgramIds &&
            promoCode.allowedProgramIds.length > 0
              ? (
                  promoCode.allowedProgramIds as unknown as Array<{
                    title: string;
                  }>
                )
                  .map((p) => p.title)
                  .join(", ")
              : undefined;

          // Format actor name: System Auth Level + Full Name
          const actorFullName =
            req.user.firstName && req.user.lastName
              ? `${req.user.firstName} ${req.user.lastName}`
              : req.user.username || req.user.email;
          const actorAuthLevel = req.user.role || "Administrator";
          const actorDisplay = `${actorAuthLevel} ${actorFullName}`;

          // Send email notification
          await EmailService.sendPromoCodeReactivatedEmail({
            recipientEmail: owner.email,
            recipientName,
            promoCode: promoCode.code,
            discountPercent: promoCode.discountPercent ?? 100,
            allowedPrograms,
            expiresAt: promoCode.expiresAt?.toISOString(),
            reactivatedBy: actorDisplay,
          });

          // Create system message/notification
          const { UnifiedMessageController } = await import(
            "./unifiedMessageController"
          );
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "✅ Your Promo Code Has Been Reactivated",
              content: `Good news! Your promo code ${promoCode.code} (${
                promoCode.discountPercent ?? 100
              }% discount${
                allowedPrograms
                  ? ` for ${allowedPrograms}`
                  : " for all programs"
              }) has been reactivated by ${actorDisplay}.\n\nYou can now use this code for enrollment.`,
              type: "announcement",
              priority: "high",
              hideCreator: false,
              metadata: {
                promoCodeId: String(promoCode._id),
                promoCode: promoCode.code,
                linkUrl: "/dashboard/promo-codes",
              },
            },
            [owner._id],
            {
              id: req.user.id,
              firstName: req.user.firstName || "",
              lastName: req.user.lastName || "",
              username: req.user.username || req.user.email,
              avatar: req.user.avatar,
              gender: req.user.gender || "male",
              authLevel: req.user.role || "Administrator",
              roleInAtCloud: req.user.roleInAtCloud,
            }
          );

          console.log(
            `Sent reactivation notifications to ${owner.email} for code ${promoCode.code}`
          );
        }
      } catch (notificationError) {
        // Log but don't fail the request if notifications fail
        console.error(
          "Failed to send reactivation notifications:",
          notificationError
        );
      }

      res.status(200).json({
        success: true,
        message: "Promo code reactivated successfully.",
        code: {
          _id: promoCode._id,
          code: promoCode.code,
          isActive: promoCode.isActive,
        },
      });
    } catch (error) {
      console.error("Error reactivating promo code:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reactivate promo code.",
      });
    }
  }
}
