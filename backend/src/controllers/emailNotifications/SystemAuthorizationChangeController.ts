import { Request, Response } from "express";
import { AutoEmailNotificationService } from "../../services/infrastructure/autoEmailNotificationService";
import { RoleUtils } from "../../utils/roleUtils";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import type { SystemAuthorizationChangeRequest } from "./types";

export default class SystemAuthorizationChangeController {
  /**
   * Send system authorization level change notifications
   * POST /api/notifications/system-authorization-change
   *
   * NOW WITH UNIFIED MESSAGING: Email + System Message + Bell Notification
   */
  static async sendSystemAuthorizationChangeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userData, changedBy }: SystemAuthorizationChangeRequest =
        req.body;

      if (
        !userData ||
        !userData._id ||
        !userData.oldRole ||
        !userData.newRole
      ) {
        res.status(400).json({
          success: false,
          message: "User data with ID, old role, and new role is required",
        });
        return;
      }

      // Check if role actually changed
      if (userData.oldRole === userData.newRole) {
        res.status(200).json({
          success: true,
          message: "Role has not changed, no notification sent",
          emailsSent: 0,
          messagesCreated: 0,
        });
        return;
      }

      // Determine if this is a promotion or demotion
      const isPromotion = RoleUtils.isPromotion(
        userData.oldRole,
        userData.newRole
      );
      const isDemotion = RoleUtils.isDemotion(
        userData.oldRole,
        userData.newRole
      );
      const changeType = isPromotion
        ? "promotion"
        : isDemotion
        ? "demotion"
        : "change";

      // Use AutoEmailNotificationService for unified messaging (email + system message + bell notification)
      const result =
        await AutoEmailNotificationService.sendRoleChangeNotification({
          userData,
          changedBy,
          isPromotion,
        });

      console.log(
        `System authorization change notification sent: ${userData.firstName} ${userData.lastName} (${userData.email}) ${userData.oldRole} → ${userData.newRole} (${changeType})`
      );

      res.status(200).json({
        success: true,
        message:
          changeType === "promotion"
            ? `🎉 Promotion notification sent with email, system message, and bell notification`
            : `📋 Role change notification sent with email, system message, and bell notification`,
        emailsSent: result.emailsSent,
        messagesCreated: result.messagesCreated || 0,
        changeType,
        unifiedMessaging: true, // ✅ Flag to indicate we're using the new system
      });
    } catch (error) {
      console.error(
        "Error sending system authorization change notifications:",
        error
      );
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendSystemAuthorizationChangeNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send system authorization change notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
