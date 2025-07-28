import { Request, Response } from "express";
import { EmailRecipientUtils } from "../utils/emailRecipientUtils";
import { EmailService } from "../services/infrastructure/emailService";
import { RoleUtils } from "../utils/roleUtils";

// Interface definitions for request bodies
interface EventCreatedRequest {
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
    organizerName: string;
    endTime?: string;
    zoomLink?: string;
    purpose?: string;
    format?: string;
  };
  excludeEmail?: string;
}

interface SystemAuthorizationChangeRequest {
  userData: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    oldRole: string;
    newRole: string;
  };
  changedBy: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

interface AtCloudRoleChangeRequest {
  userData: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    oldRoleInAtCloud: string;
    newRoleInAtCloud: string;
  };
}

interface NewLeaderSignupRequest {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
  };
}

interface CoOrganizerAssignedRequest {
  assignedUser: {
    email: string;
    firstName: string;
    lastName: string;
  };
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
  };
  assignedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface EventReminderRequest {
  eventId: string;
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
  };
}

export class EmailNotificationController {
  /**
   * Send event creation notifications to all active users
   * POST /api/v1/notifications/event-created
   */
  static async sendEventCreatedNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventData, excludeEmail }: EventCreatedRequest = req.body;

      if (!eventData || !eventData.title || !eventData.date) {
        res.status(400).json({
          success: false,
          message: "Event data is required with title and date",
        });
        return;
      }

      // Get all active, verified users who want emails
      const recipients = await EmailRecipientUtils.getActiveVerifiedUsers(
        excludeEmail
      );

      if (recipients.length === 0) {
        res.status(200).json({
          success: true,
          message: "No eligible recipients found",
          recipientCount: 0,
        });
        return;
      }

      // Transform data to match existing email service format
      const emailEventData = {
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
        endTime: eventData.endTime || "TBD",
        location: eventData.location,
        zoomLink: eventData.zoomLink,
        organizer: eventData.organizerName,
        purpose: eventData.purpose || "",
        format: eventData.format || "",
      };

      // Send emails in parallel
      const emailPromises = recipients.map(
        (user: { email: string; firstName: string; lastName: string }) =>
          EmailService.sendEventCreatedEmail(
            user.email,
            `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            emailEventData
          ).catch((error: any) => {
            console.error(
              `Failed to send event notification to ${user.email}:`,
              error
            );
            return false;
          })
      );

      await Promise.all(emailPromises);

      res.status(200).json({
        success: true,
        message: "Event creation notifications sent successfully",
        recipientCount: recipients.length,
      });
    } catch (error) {
      console.error("Error sending event creation notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send event creation notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send system authorization level change notifications
   * POST /api/v1/notifications/system-authorization-change
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

      // Determine if this is a promotion or demotion
      const isPromotion = RoleUtils.isPromotion(
        userData.oldRole,
        userData.newRole
      );
      const isDemotion = RoleUtils.isDemotion(
        userData.oldRole,
        userData.newRole
      );

      if (!isPromotion && !isDemotion) {
        res.status(400).json({
          success: false,
          message: "No role change detected - old and new roles are the same",
        });
        return;
      }

      let emailsSent = 0;
      const emailPromises: Promise<boolean>[] = [];

      // Send notification to the user whose role changed
      if (isPromotion) {
        emailPromises.push(
          EmailService.sendPromotionNotificationToUser(
            userData.email,
            userData,
            changedBy
          )
            .then((success) => {
              if (success) emailsSent++;
              return success;
            })
            .catch((error) => {
              console.error(
                `Failed to send promotion notification to user ${userData.email}:`,
                error
              );
              return false;
            })
        );
      } else if (isDemotion) {
        emailPromises.push(
          EmailService.sendDemotionNotificationToUser(
            userData.email,
            userData,
            changedBy
          )
            .then((success) => {
              if (success) emailsSent++;
              return success;
            })
            .catch((error) => {
              console.error(
                `Failed to send demotion notification to user ${userData.email}:`,
                error
              );
              return false;
            })
        );
      }

      // Get admin recipients for notification
      const adminRecipients =
        await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
          userData._id
        );

      // Send notifications to admins
      if (isPromotion) {
        const adminPromises = adminRecipients.map(
          (admin: { email: string; firstName: string; lastName: string }) =>
            EmailService.sendPromotionNotificationToAdmins(
              admin.email,
              `${admin.firstName || ""} ${admin.lastName || ""}`.trim(),
              userData,
              changedBy
            )
              .then((success) => {
                if (success) emailsSent++;
                return success;
              })
              .catch((error) => {
                console.error(
                  `Failed to send promotion notification to admin ${admin.email}:`,
                  error
                );
                return false;
              })
        );
        emailPromises.push(...adminPromises);
      } else if (isDemotion) {
        const adminPromises = adminRecipients.map(
          (admin: { email: string; firstName: string; lastName: string }) =>
            EmailService.sendDemotionNotificationToAdmins(
              admin.email,
              `${admin.firstName || ""} ${admin.lastName || ""}`.trim(),
              userData,
              changedBy
            )
              .then((success) => {
                if (success) emailsSent++;
                return success;
              })
              .catch((error) => {
                console.error(
                  `Failed to send demotion notification to admin ${admin.email}:`,
                  error
                );
                return false;
              })
        );
        emailPromises.push(...adminPromises);
      }

      // Wait for all emails to be sent
      await Promise.all(emailPromises);

      // Total recipients = user + successful admin notifications
      const totalRecipients = emailsSent;

      res.status(200).json({
        success: true,
        message: isPromotion
          ? "Promotion notifications sent successfully"
          : "Role change notifications sent successfully",
        recipientCount: totalRecipients,
        data: {
          userNotified: emailsSent > 0,
          adminsNotified: adminRecipients.length,
          changeType: isPromotion
            ? "promotion"
            : isDemotion
            ? "demotion"
            : "no-change",
        },
      });
    } catch (error) {
      console.error("Error sending role change notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send role change notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send @Cloud ministry role change notifications
   * POST /api/v1/notifications/atcloud-role-change
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
          message: "User data with ID, old role, and new role is required",
        });
        return;
      }

      // Check if there's actually a role change
      if (userData.oldRoleInAtCloud === userData.newRoleInAtCloud) {
        res.status(400).json({
          success: false,
          message:
            "No ministry role change detected - old and new roles are the same",
        });
        return;
      }

      // Send ministry role change notification to the user
      const userEmailSent = await EmailService.sendAtCloudRoleChangeToUser(
        userData.email,
        userData
      );

      // Send ministry role change notification to all Super Admins and Administrators
      const admins =
        await EmailRecipientUtils.getSystemAuthorizationChangeRecipients(
          userData._id
        );

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

      res.status(200).json({
        success: true,
        message: `Ministry role change notifications sent to ${totalRecipients} recipient(s)`,
        recipientCount: totalRecipients,
        data: {
          userNotified: userEmailSent,
          adminCount: adminEmailsSent,
          totalAdmins: admins.length,
          oldRole: userData.oldRoleInAtCloud,
          newRole: userData.newRoleInAtCloud,
        },
      });
    } catch (error) {
      console.error("Error sending ministry role change notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send ministry role change notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send new leader signup notifications to admins
   * POST /api/v1/notifications/new-leader-signup
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

      res.status(200).json({
        success: true,
        message: `New leader signup notification sent to ${successCount} recipient(s)`,
        recipientCount: successCount,
      });
    } catch (error) {
      console.error("Error sending new leader signup notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send new leader signup notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send co-organizer assignment notification
   * POST /api/v1/notifications/co-organizer-assigned
   */
  static async sendCoOrganizerAssignedNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        assignedUser,
        eventData,
        assignedBy,
      }: CoOrganizerAssignedRequest = req.body;

      if (
        !assignedUser ||
        !assignedUser.email ||
        !eventData ||
        !eventData.title
      ) {
        res.status(400).json({
          success: false,
          message: "Assigned user and event data are required",
        });
        return;
      }

      // For now, just return success - we'll implement the actual email methods later
      console.log(
        `Co-organizer assignment notification: ${assignedUser.firstName} ${assignedUser.lastName} assigned to ${eventData.title} by ${assignedBy.firstName} ${assignedBy.lastName}`
      );

      res.status(200).json({
        success: true,
        message:
          "Co-organizer assignment notification sent successfully (placeholder)",
        recipientCount: 1,
      });
    } catch (error) {
      console.error(
        "Error sending co-organizer assignment notification:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send co-organizer assignment notification",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send event reminder notifications to participants
   * POST /api/v1/notifications/event-reminder
   */
  static async sendEventReminderNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventId, eventData }: EventReminderRequest = req.body;

      if (!eventId || !eventData || !eventData.title) {
        res.status(400).json({
          success: false,
          message: "Event ID and event data are required",
        });
        return;
      }

      // For now, just return success - we'll implement the actual email methods later
      console.log(
        `Event reminder notification: ${eventData.title} (${eventId}) on ${eventData.date} at ${eventData.time}`
      );

      res.status(200).json({
        success: true,
        message: "Event reminder notifications sent successfully (placeholder)",
        recipientCount: 0,
      });
    } catch (error) {
      console.error("Error sending event reminder notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send event reminder notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
