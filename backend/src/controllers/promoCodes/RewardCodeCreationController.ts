import { Request, Response } from "express";
import PromoCode from "../../models/PromoCode";
import User from "../../models/User";
import mongoose from "mongoose";
import { EmailService } from "../../services";

export default class RewardCodeCreationController {
  /**
   * Create reward promo code (Admin only)
   * POST /api/promo-codes/reward
   * Body: { userId: string, discountPercent: number, allowedProgramIds?: string[], expiresAt?: Date }
   */
  static async createRewardCode(req: Request, res: Response): Promise<void> {
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

      // Validate discount percent (10-100% for reward codes)
      if (
        typeof discountPercent !== "number" ||
        discountPercent < 10 ||
        discountPercent > 100
      ) {
        res.status(400).json({
          success: false,
          message:
            "Discount percent must be between 10 and 100 for reward codes.",
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
        type: "reward",
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

        // Send email notification with Reward Code branding
        await EmailService.sendStaffPromoCodeEmail({
          recipientEmail: owner.email,
          recipientName,
          promoCode: promoCode.code,
          discountPercent: promoCode.discountPercent ?? 10,
          allowedPrograms,
          expiresAt: promoCode.expiresAt?.toISOString(),
          createdBy: req.user.username || req.user.email,
          codeType: "reward", // Specify this is a reward code
        });

        // Create system message/notification using UnifiedMessageController pattern
        const { UnifiedMessageController } = await import(
          "../unifiedMessageController"
        );

        const programText = allowedPrograms
          ? ` for ${allowedPrograms}`
          : " for all programs";

        const expiryText = promoCode.expiresAt
          ? `\n\nExpires: ${new Date(promoCode.expiresAt).toLocaleDateString()}`
          : "";

        // Format creator name: System Auth Level + Full Name
        const creatorFullName =
          req.user.firstName && req.user.lastName
            ? `${req.user.firstName} ${req.user.lastName}`
            : req.user.username || req.user.email;
        const creatorAuthLevel = req.user.role || "Administrator";
        const creatorDisplay = `${creatorAuthLevel} ${creatorFullName}`;

        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: "🎁 You've Received a Reward Code",
            content: `You've been granted a ${
              promoCode.discountPercent ?? 10
            }% discount reward code${programText} by ${creatorDisplay}.\n\nUse code: ${
              promoCode.code
            }${expiryText}`,
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
          `Sent notifications to ${owner.email} for reward code ${promoCode.code}`
        );
      } catch (notifError) {
        console.error("Failed to send reward code notifications:", notifError);
        // Don't fail the request if notifications fail
      }

      res.status(201).json({
        success: true,
        message: "Reward code created successfully.",
        data: {
          promoCode,
        },
      });
    } catch (error: unknown) {
      console.error("Create reward code error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create reward code.",
      });
    }
  }
}
