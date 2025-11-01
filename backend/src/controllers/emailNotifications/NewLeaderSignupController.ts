import { Request, Response } from "express";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { UnifiedMessageController } from "../unifiedMessageController";
import { User } from "../../models";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import type { NewLeaderSignupRequest } from "./types";

export default class NewLeaderSignupController {
  /**
   * Send new leader signup notification to admins
   * POST /api/notifications/new-leader-signup
   */
  static async sendNewLeaderSignupNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userData }: NewLeaderSignupRequest = req.body;

      if (!userData || !userData.email || !userData.firstName) {
        res.status(400).json({
          success: false,
          message: "User data with email and name is required",
        });
        return;
      }

      // Get admin recipients (Super Admin and Administrator)
      const adminRecipients = await EmailRecipientUtils.getAdminUsers();

      if (adminRecipients.length === 0) {
        console.warn(
          "No admin recipients found for new leader signup notification"
        );
        res.status(200).json({
          success: true,
          message: "New leader signup notification sent to 0 recipient(s)",
          recipientCount: 0,
        });
        return;
      }

      // Prepare leader data with signup date
      const newLeaderData = {
        firstName: userData.firstName,
        lastName: userData.lastName || "",
        email: userData.email,
        roleInAtCloud: userData.roleInAtCloud || "Leader",
        signupDate: new Date().toLocaleDateString(),
      };

      // Send email to all admins
      const emailPromises = adminRecipients.map(
        (admin: {
          email: string;
          firstName: string;
          lastName: string;
          role: string;
        }) =>
          EmailService.sendNewLeaderSignupEmail(
            admin.email,
            `${admin.firstName} ${admin.lastName}`.trim(),
            newLeaderData
          )
      );

      const emailResults = await Promise.allSettled(emailPromises);
      const successCount = emailResults.filter(
        (result: PromiseSettledResult<boolean>) =>
          result.status === "fulfilled" && result.value === true
      ).length;

      console.log(
        `New leader signup notification sent: ${userData.firstName} ${userData.lastName} (${userData.email}) - ${newLeaderData.roleInAtCloud} to ${successCount}/${adminRecipients.length} admins`
      );

      // Create system message and bell notification for admins
      try {
        const admins = await User.find({
          role: { $in: ["Super Admin", "Admin"] },
        });
        const adminIds = admins
          .map((admin) => (admin as { _id?: unknown })._id)
          .filter((id): id is unknown => id !== undefined)
          .map((id) => (typeof id === "string" ? id : String(id)));

        if (adminIds.length > 0) {
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "New Leader Registration",
              content: `A new user has registered with Leader role: ${userData.firstName} ${userData.lastName} (${userData.email}) - ${newLeaderData.roleInAtCloud}. Please review their application.`,
              type: "admin_alert",
              priority: "medium",
              hideCreator: true,
            },
            adminIds,
            {
              id: "system",
              firstName: "System",
              lastName: "Administrator",
              username: "system",
              avatar: "/default-avatar-male.jpg",
              gender: "male",
              authLevel: "Super Admin",
              roleInAtCloud: "System",
            }
          );
        }
      } catch (error) {
        console.warn(
          "Failed to create new leader signup system message:",
          error
        );
      }

      res.status(200).json({
        success: true,
        message: `New leader signup notification sent to ${successCount} recipient(s)`,
        recipientCount: successCount,
      });
    } catch (error) {
      console.error("Error sending new leader signup notifications:", error);
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendNewLeaderSignupNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send new leader signup notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
