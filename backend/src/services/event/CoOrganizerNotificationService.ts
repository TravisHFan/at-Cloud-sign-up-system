import type { Request } from "express";
import type { IEvent } from "../../models";
import { User } from "../../models";
import { EmailService } from "../infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../controllers/unifiedMessageController";
import { EventController } from "../../controllers/eventController";
import { Logger } from "../LoggerService";

const logger = Logger.getInstance().child("CoOrganizerNotificationService");

/**
 * CoOrganizerNotificationService
 * Handles notifications to newly added co-organizers when event is updated.
 * Extracted from UpdateController Phase 8.1.7.
 */
export class CoOrganizerNotificationService {
  /**
   * Send welcome notifications (email + system messages) to newly added co-organizers.
   * Compares old vs new organizer lists to detect additions.
   */
  static async sendNewCoOrganizerNotifications(
    event: IEvent,
    oldOrganizerUserIds: string[],
    normalizedData: {
      organizerDetails?: Array<{ userId?: unknown }>;
    },
    req: Request
  ): Promise<void> {
    try {
      if (
        !normalizedData.organizerDetails ||
        !Array.isArray(normalizedData.organizerDetails)
      ) {
        return;
      }

      // Get new organizer user IDs
      const newOrganizerUserIds = normalizedData.organizerDetails
        .map((org: { userId?: unknown }) =>
          org.userId ? EventController.toIdString(org.userId) : undefined
        )
        .filter(Boolean);

      // Find newly added organizers (exclude main organizer)
      const mainOrganizerId = event.createdBy.toString();
      const newCoOrganizerIds = newOrganizerUserIds.filter(
        (userId): userId is string =>
          !!userId &&
          userId !== mainOrganizerId &&
          !oldOrganizerUserIds.includes(userId)
      );

      if (newCoOrganizerIds.length === 0) {
        console.log("ℹ️  No new co-organizers found for notifications");
        return;
      }

      console.log(
        `📧 Found ${newCoOrganizerIds.length} new co-organizers to notify`
      );

      // Get user details for new co-organizers
      // Note: Co-organizers are explicitly assigned a responsibility, so they should
      // be notified regardless of their emailNotifications preference setting.
      // Only verify they are active and verified users.
      const newCoOrganizers = await User.find({
        _id: { $in: newCoOrganizerIds },
        isActive: true,
        isVerified: true,
        // emailNotifications filter intentionally omitted - co-organizers
        // are explicitly assigned and should be notified of their responsibilities
      }).select("_id email firstName lastName");

      // Send email notifications to new co-organizers
      const coOrganizerEmailPromises = newCoOrganizers.map(
        async (coOrganizer) => {
          try {
            await EmailService.sendCoOrganizerAssignedEmail(
              coOrganizer.email,
              {
                firstName: coOrganizer.firstName || "Unknown",
                lastName: coOrganizer.lastName || "User",
              },
              {
                title: event.title,
                date: event.date,
                time: event.time,
                location: event.location || "",
              },
              {
                firstName: req.user!.firstName || "Unknown",
                lastName: req.user!.lastName || "User",
              }
            );
            console.log(
              `✅ Co-organizer update notification sent to ${coOrganizer.email}`
            );
            return true;
          } catch (error) {
            console.error(
              `❌ Failed to send co-organizer update notification to ${coOrganizer.email}:`,
              error
            );
            return false;
          }
        }
      );

      // Send system messages to new co-organizers (targeted messages)
      const coOrganizerSystemMessagePromises = newCoOrganizers.map(
        async (coOrganizer) => {
          try {
            // Create targeted system message using the new method
            await UnifiedMessageController.createTargetedSystemMessage(
              {
                title: `Co-Organizer Assignment: ${event.title}`,
                content: `You have been assigned as a co-organizer for the event "${event.title}" scheduled for ${event.date} at ${event.time}. Please review the event details and reach out to the main organizer if you have any questions.`,
                type: "announcement",
                priority: "high",
              },
              [EventController.toIdString(coOrganizer._id)],
              {
                id: EventController.toIdString(req.user!._id),
                firstName: req.user!.firstName || "Unknown",
                lastName: req.user!.lastName || "User",
                username: req.user!.username || "unknown",
                avatar: req.user!.avatar, // Include avatar for proper display
                gender: req.user!.gender || "male",
                authLevel: req.user!.role,
                roleInAtCloud: req.user!.roleInAtCloud,
              }
            );

            console.log(
              `✅ Co-organizer update system message sent to ${coOrganizer.email}`
            );
            return true;
          } catch (error) {
            console.error(
              `❌ Failed to send co-organizer update system message to ${coOrganizer.email}:`,
              error
            );
            return false;
          }
        }
      );

      // Process notifications in the background
      Promise.all([
        ...coOrganizerEmailPromises,
        ...coOrganizerSystemMessagePromises,
      ])
        .then((results) => {
          const successCount = results.filter(
            (result) => result === true
          ).length;
          console.log(
            `✅ Processed ${successCount}/${results.length} co-organizer update notifications`
          );
        })
        .catch((error) => {
          console.error(
            "Error processing co-organizer update notifications:",
            error
          );
        });
    } catch (coOrganizerError) {
      console.error(
        "Error sending co-organizer update notifications:",
        coOrganizerError
      );
      // Don't fail the event update if co-organizer notifications fail
    }
  }
}
