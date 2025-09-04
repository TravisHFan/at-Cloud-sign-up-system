import { Request, Response } from "express";
import mongoose from "mongoose";
import { EmailRecipientUtils } from "../utils/emailRecipientUtils";
import { EmailService } from "../services/infrastructure/emailService";
import { AutoEmailNotificationService } from "../services/infrastructure/autoEmailNotificationService";
import { RoleUtils } from "../utils/roleUtils";
import { UnifiedMessageController } from "./unifiedMessageController";
import { User } from "../models";
import { CachePatterns } from "../services";
import { CorrelatedLogger } from "../services/CorrelatedLogger";

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
    avatar?: string; // Add avatar field
    gender?: string; // Add gender field
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
    zoomLink?: string;
    format?: string;
  };
  reminderType?: "1h" | "24h" | "1week";
}

export class EmailNotificationController {
  /**
   * Send event creation notifications to all active users
   * POST /api/notifications/event-created
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
        endDate: (eventData as { endDate?: string }).endDate,
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
          ).catch((error: unknown) => {
            console.error(
              `Failed to send event notification to ${user.email}:`,
              error
            );
            return false as boolean;
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
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendEventCreatedNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send event creation notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

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

      // NEW: Use the unified AutoEmailNotificationService
      const result =
        await AutoEmailNotificationService.sendRoleChangeNotification({
          userData,
          changedBy,
          isPromotion,
        });

      if (!result.success) {
        res.status(500).json({
          success: false,
          message: "Failed to send role change notifications",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: isPromotion
          ? "🎉 Promotion notifications sent successfully (Email + System Message + Bell Notification)"
          : "📋 Role change notifications sent successfully (Email + System Message + Bell Notification)",
        data: {
          emailsSent: result.emailsSent,
          systemMessagesCreated: result.messagesCreated,
          changeType: isPromotion ? "promotion" : "demotion",
          unifiedMessaging: true, // Indicates the new system is working
        },
      });
    } catch (error) {
      console.error("Error sending role change notifications:", error);
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendSystemAuthorizationChangeNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send role change notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

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
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendAtCloudRoleChangeNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send ministry role change notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send new leader signup notifications to admins
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

  /**
   * Send co-organizer assignment notification
   * POST /api/notifications/co-organizer-assigned
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

      // Validate assignedBy data
      if (!assignedBy || !assignedBy.firstName) {
        res.status(400).json({
          success: false,
          message: "Assigned by information is required",
        });
        return;
      }

      // Send email to the newly assigned co-organizer
      const emailSent = await EmailService.sendCoOrganizerAssignedEmail(
        assignedUser.email,
        {
          firstName: assignedUser.firstName,
          lastName: assignedUser.lastName || "",
        },
        {
          title: eventData.title,
          date: eventData.date || "TBD",
          time: eventData.time || "TBD",
          location: eventData.location || "TBD",
        },
        {
          firstName: assignedBy.firstName,
          lastName: assignedBy.lastName || "",
        }
      );

      const recipientCount = emailSent ? 1 : 0;

      const assignedUserName = `${assignedUser.firstName} ${
        assignedUser.lastName || ""
      }`.trim();
      const assignedByName = `${assignedBy.firstName} ${
        assignedBy.lastName || ""
      }`.trim();

      console.log(
        `Co-organizer assignment notification: ${assignedUserName} assigned to ${eventData.title} by ${assignedByName} - Email sent: ${emailSent}`
      );

      res.status(200).json({
        success: true,
        message: `Co-organizer assignment notification sent to ${recipientCount} recipient(s)`,
        recipientCount,
      });
    } catch (error) {
      console.error(
        "Error sending co-organizer assignment notification:",
        error
      );
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendCoOrganizerAssignedNotification failed",
        error as Error
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
   * POST /api/notifications/event-reminder
   */
  static async sendEventReminderNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventId, eventData, reminderType }: EventReminderRequest =
        req.body;

      if (!eventId || !eventData || !eventData.title) {
        res.status(400).json({
          success: false,
          message: "Event ID and event data are required",
        });
        return;
      }

      // Validate reminder type
      const validReminderTypes = ["1h", "24h", "1week"];
      if (reminderType && !validReminderTypes.includes(reminderType)) {
        res.status(400).json({
          success: false,
          message: "Invalid reminder type. Must be '1h', '24h', or '1week'",
        });
        return;
      }

      // ATOMIC DEDUPLICATION CHECK: Use findOneAndUpdate for race-condition-safe check
      if (reminderType === "24h") {
        try {
          const Event = mongoose.model("Event");

          // Atomic operation: Only proceed if we can successfully mark it as being processed
          const updateResult = await Event.findOneAndUpdate(
            {
              _id: eventId,
              $or: [
                { "24hReminderSent": false }, // Explicitly false
                { "24hReminderSent": null }, // Null value
                { "24hReminderSent": { $exists: false } }, // Field doesn't exist
              ],
            },
            {
              "24hReminderSent": true,
              "24hReminderSentAt": new Date(),
              "24hReminderProcessingBy": "email-api", // Track who's processing
            },
            {
              new: false, // Return the document before update
              runValidators: false, // Skip validation for performance
            }
          );

          if (!updateResult) {
            // Another process already marked this event as sent
            console.log(
              `🛡️ DUPLICATE PREVENTION: 24h reminder already sent for event ${eventId}`
            );
            res.status(200).json({
              success: true,
              message: "24h reminder already sent for this event",
              alreadySent: true,
              preventedDuplicate: true,
            });
            return;
          }

          console.log(
            `🔒 ATOMIC LOCK: Successfully claimed event ${eventId} for 24h reminder processing`
          );

          // Invalidate event cache after reminder flag update
          await CachePatterns.invalidateEventCache(eventId);
        } catch (error) {
          console.warn(
            `⚠️ Atomic deduplication check failed for event ${eventId}:`,
            error
          );
          // Continue anyway - better to send duplicate than miss reminder
        }
      }

      // Get event participants (users)
      let eventParticipants: Array<{
        email: string;
        firstName: string;
        lastName: string;
        _id?: unknown;
      }> = [];
      try {
        eventParticipants = await EmailRecipientUtils.getEventParticipants(
          eventId
        );
      } catch (err) {
        console.warn(
          `⚠️ Failed to fetch event participants for ${eventId}; continuing with none:`,
          err
        );
        eventParticipants = [];
      }
      // Normalize in case a mock returns undefined/null
      if (!Array.isArray(eventParticipants)) {
        eventParticipants = [];
      }

      // Also include guest registrations for email channel (no system messages for guests)
      let eventGuests: Array<{
        email: string;
        firstName: string;
        lastName: string;
      }> = [];
      try {
        const guests = await EmailRecipientUtils.getEventGuests(eventId);
        eventGuests = Array.isArray(guests) ? guests : [];
      } catch (err) {
        console.warn(
          `⚠️ Failed to fetch event guests for ${eventId}; continuing without guests:`,
          err
        );
        eventGuests = [];
      }

      const totalEmailRecipients =
        eventParticipants.length + eventGuests.length;

      if (totalEmailRecipients === 0) {
        console.warn(
          `No participants or guests found for event reminder: ${eventId}`
        );
        res.status(200).json({
          success: true,
          message: "Event reminder notification sent to 0 recipient(s)",
          recipientCount: 0,
        });
        return;
      }

      // Prepare event data with defaults
      const reminderEventData = {
        title: eventData.title,
        date: eventData.date || "TBD",
        time: eventData.time || "TBD",
        location: eventData.location || "TBD",
        zoomLink: eventData.zoomLink,
        format: eventData.format || "in-person",
      };

      // Send reminder emails to all participants and guests
      const emailPromises = [
        ...eventParticipants.map(
          (participant: {
            email: string;
            firstName: string;
            lastName: string;
          }) =>
            EmailService.sendEventReminderEmail(
              participant.email,
              `${participant.firstName} ${participant.lastName}`.trim(),
              reminderEventData,
              reminderType || "24h"
            )
        ),
        ...eventGuests.map(
          (guest: { email: string; firstName: string; lastName: string }) =>
            EmailService.sendEventReminderEmail(
              guest.email,
              `${guest.firstName} ${guest.lastName}`.trim(),
              reminderEventData,
              reminderType || "24h"
            )
        ),
      ];

      const emailResults = await Promise.allSettled(emailPromises);
      const successCount = emailResults.filter(
        (result: PromiseSettledResult<boolean>) =>
          result.status === "fulfilled" && result.value === true
      ).length;

      console.log(
        `Event reminder notification sent: ${eventData.title} (${eventId}) - ${
          reminderType || "24h"
        } reminder to ${successCount}/${totalEmailRecipients} recipients (participants + guests)`
      );

      // Create system message and bell notification for event participants
      let systemMessageSuccess = false;
      try {
        const participantIds = eventParticipants
          .map((p) => p._id)
          .filter((id): id is unknown => id !== undefined)
          .map((id) => (typeof id === "string" ? id : String(id)));

        if (participantIds.length > 0) {
          const reminderText =
            reminderType === "1h"
              ? "1 hour"
              : reminderType === "24h"
              ? "24 hours"
              : "1 week";

          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: `Event Reminder: ${eventData.title}`,
              content: `This is a ${reminderText} reminder for the event "${
                eventData.title
              }" scheduled for ${eventData.date} at ${
                eventData.time
              }. Location: ${
                eventData.location || "TBD"
              }. Don't forget to attend!`,
              type: "announcement", // ✅ Valid enum value for event reminders
              priority: "medium",
              hideCreator: true,
            },
            participantIds,
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
          systemMessageSuccess = true;
          console.log(
            `✅ System message and bell notifications created for ${participantIds.length} participants`
          );
        }
      } catch (error) {
        console.error(
          "❌ CRITICAL: Failed to create event reminder system message:",
          error
        );
        console.error(
          "   This means users will not receive system messages or bell notifications!"
        );

        // Log the specific error details for debugging
        if (error instanceof Error) {
          console.error("   Error details:", error.message);
          console.error("   Stack trace:", error.stack);
        }
      }

      // Note: 24h reminder flag is already set atomically at the beginning for race condition protection

      res.status(200).json({
        success: true,
        message: `Event reminder notification sent to ${successCount} recipient(s)`,
        recipientCount: successCount,
        systemMessageCreated: systemMessageSuccess,
        details: {
          emailsSent: successCount,
          totalParticipants: eventParticipants.length,
          totalGuests: eventGuests.length,
          totalEmailRecipients,
          systemMessageSuccess: systemMessageSuccess,
        },
      });
    } catch (error) {
      console.error("Error sending event reminder notifications:", error);
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendEventReminderNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send event reminder notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
