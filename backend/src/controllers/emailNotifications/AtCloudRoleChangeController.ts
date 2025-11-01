import { Request, Response } from "express";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import type { AtCloudRoleChangeRequest } from "./types";

export default class AtCloudRoleChangeController {
  /**
   * Send @Cloud ministry role change notifications
   * POST /api/notifications/atcloud-role-change
   */
  static async sendAtCloudRoleChangeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userData }: AtCloudRoleChangeRequest = req.body;

      if (
        !userData ||
        !userData._id ||
        !userData.oldRoleInAtCloud ||
        !userData.newRoleInAtCloud
      ) {
        res.status(400).json({
          success: false,
          message:
            "User data with ID, old roleInAtCloud, and new roleInAtCloud is required",
        });
        return;
      }

      // Check if role actually changed
      if (userData.oldRoleInAtCloud === userData.newRoleInAtCloud) {
        res.status(200).json({
          success: true,
          message: "@Cloud role has not changed, no notification sent",
          recipientCount: 0,
        });
        return;
      }

      // Send email to the user about their role change
      const userEmailSent = await EmailService.sendAtCloudRoleChangeToUser(
        userData.email,
        userData
      );

      // Get admin recipients for notification
      const admins =
        await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
          userData._id
        );

      // Send notification email to all admins
      const adminEmailResults = await Promise.all(
        admins.map((admin) =>
          EmailService.sendAtCloudRoleChangeToAdmins(
            admin.email,
            `${admin.firstName || ""} ${admin.lastName || ""}`.trim(),
            userData
          )
        )
      );

      const adminEmailsSent = adminEmailResults.filter(Boolean).length;
      const totalRecipients = (userEmailSent ? 1 : 0) + adminEmailsSent;

      console.log(
        `@Cloud role change notification sent: ${userData.firstName} ${userData.lastName} (${userData.email}) ${userData.oldRoleInAtCloud} → ${userData.newRoleInAtCloud} to ${totalRecipients} recipient(s)`
      );

      res.status(200).json({
        success: true,
        message: `@Cloud role change notification sent to ${totalRecipients} recipient(s)`,
        recipientCount: totalRecipients,
      });
    } catch (error) {
      console.error("Error sending @Cloud role change notifications:", error);
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendAtCloudRoleChangeNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send @Cloud role change notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
