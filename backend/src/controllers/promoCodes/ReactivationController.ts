import { Request, Response } from "express";
import PromoCode from "../../models/PromoCode";
import mongoose from "mongoose";
import { EmailService } from "../../services";

export default class ReactivationController {
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
            "../unifiedMessageController"
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
