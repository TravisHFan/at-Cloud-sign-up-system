import { Request, Response } from "express";
import { EmailRecipientUtils } from "../utils/emailRecipientUtils";
import { EmailService } from "../services/infrastructure/emailService";

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

      // For now, just return success - we'll implement the actual email methods later
      console.log(
        `Role change notification: ${userData.firstName} ${userData.lastName} changed from ${userData.oldRole} to ${userData.newRole} by ${changedBy.firstName} ${changedBy.lastName}`
      );

      res.status(200).json({
        success: true,
        message: "Role change notifications sent successfully (placeholder)",
        recipientCount: 0,
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

      // For now, just return success - we'll implement the actual email methods later
      console.log(
        `Ministry role change notification: ${userData.firstName} ${userData.lastName} changed from ${userData.oldRoleInAtCloud} to ${userData.newRoleInAtCloud}`
      );

      res.status(200).json({
        success: true,
        message:
          "Ministry role change notifications sent successfully (placeholder)",
        recipientCount: 0,
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

      // For now, just return success - we'll implement the actual email methods later
      console.log(
        `New leader signup notification: ${userData.firstName} ${userData.lastName} (${userData.email}) - ${userData.roleInAtCloud}`
      );

      res.status(200).json({
        success: true,
        message:
          "New leader signup notifications sent successfully (placeholder)",
        recipientCount: 0,
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
