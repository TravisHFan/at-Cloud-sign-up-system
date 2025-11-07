/**
 * EventCreationNotificationService
 *
 * Handles all notification logic for newly created events including:
 * - System messages (broadcast to all active users)
 * - Email notifications (all active users excluding creator)
 * - Co-organizer assignment notifications (emails + system messages)
 * - Recurring series announcements
 *
 * Extracted from CreationController as part of Phase 9 refactoring.
 */

import type { IEvent } from "../../models";
import { User } from "../../models";
import { EmailService } from "../infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../controllers/unifiedMessageController";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { ResponseBuilderService } from "../ResponseBuilderService";
import { Logger } from "../LoggerService";

// Initialize logger
const logger = Logger.getInstance().child("EventCreationNotificationService");

interface EventData {
  title: string;
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  location?: string;
  zoomLink?: string;
  organizer: string;
  purpose?: string;
  format: "In-person" | "Online" | "Hybrid Participation";
  timeZone?: string;
}

interface RecurringInfo {
  isRecurring: boolean;
  frequency: "every-two-weeks" | "monthly" | "every-two-months";
  occurrenceCount: number;
}

interface CurrentUser {
  _id: unknown;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  gender?: "male" | "female";
  role: string;
  roleInAtCloud?: string;
  email: string;
}

interface NotificationResult {
  systemMessagesSent: boolean;
  emailsSent: boolean;
  coOrganizerNotificationsSent: boolean;
}

export class EventCreationNotificationService {
  /**
   * Helper type guard for organizerDetails
   */
  private static hasOrganizerDetails(
    v: unknown
  ): v is { organizerDetails?: Array<unknown> } {
    return (
      typeof v === "object" &&
      v !== null &&
      Array.isArray((v as { organizerDetails?: unknown }).organizerDetails)
    );
  }

  /**
   * Send all notifications for a newly created event:
   * 1. System messages to all active users
   * 2. Email notifications to all active users (excluding creator)
   * 3. Co-organizer assignment notifications (if applicable)
   */
  static async sendAllNotifications(
    event: IEvent,
    eventData: EventData,
    currentUser: CurrentUser,
    recurringInfo?: RecurringInfo,
    toIdString?: (id: unknown) => string
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      systemMessagesSent: false,
      emailsSent: false,
      coOrganizerNotificationsSent: false,
    };

    // Use provided toIdString or fallback to toString
    const idToString =
      toIdString ||
      ((id: unknown): string => {
        if (typeof id === "string") return id;
        if (id && typeof id === "object" && "toString" in id) {
          return (id as { toString: () => string }).toString();
        }
        return String(id);
      });

    const isRecurring = !!recurringInfo?.isRecurring;

    // 1. Create system messages for all active users (including event creator)
    try {
      console.log("🔔 Creating system messages for new event...");
      logger.info("Creating system messages for new event", undefined, {
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
      });

      // Get all active users for system message (including event creator)
      const allUsers = await User.find({
        isVerified: true,
        isActive: { $ne: false },
      }).select("_id");

      const allUserIds = allUsers.map((user) => idToString(user._id));

      if (allUserIds.length > 0) {
        const msgTitle = isRecurring
          ? `New Recurring Program: ${eventData.title}`
          : `New Event: ${eventData.title}`;
        const freqMap: Record<string, string> = {
          "every-two-weeks": "Every Two Weeks",
          monthly: "Monthly",
          "every-two-months": "Every Two Months",
        };
        const seriesNote = isRecurring
          ? `\nThis is a recurring program (${
              freqMap[recurringInfo!.frequency!]
            }, ${
              recurringInfo!.occurrenceCount
            } total occurrences including the first). Future events will follow the same weekday per cycle. Visit the system for the full schedule and details.`
          : "";

        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: msgTitle,
            content: `A new ${isRecurring ? "recurring program" : "event"} "${
              eventData.title
            }" has been created for ${eventData.date} at ${eventData.time}. ${
              eventData.purpose || ""
            }${seriesNote}`,
            type: "announcement",
            priority: "medium",
            metadata: { eventId: idToString(event._id), kind: "new_event" },
          },
          allUserIds,
          {
            id: idToString(currentUser._id),
            firstName: currentUser.firstName || "Unknown",
            lastName: currentUser.lastName || "User",
            username: currentUser.username || "unknown",
            avatar: currentUser.avatar,
            gender: currentUser.gender || "male",
            authLevel: currentUser.role,
            roleInAtCloud: currentUser.roleInAtCloud,
          }
        );

        console.log(
          `✅ System message created successfully for ${allUserIds.length} users`
        );
        logger.info("System message created successfully", undefined, {
          recipients: allUserIds.length,
          isRecurring,
          eventId: event._id,
        });
        result.systemMessagesSent = true;
      } else {
        console.log("ℹ️  No active users found for system message");
        logger.info("No active users found for system message");
      }
    } catch (error) {
      console.error("❌ Failed to create system messages for event:", error);
      logger.error(
        "Failed to create system messages for event",
        error as Error,
        undefined,
        { eventId: event?._id }
      );
      // Continue execution - don't fail event creation if system messages fail
    }

    // 2. Send email notifications to all users - ONLY ONCE for recurring series
    try {
      // Get all active, verified users who want emails (excluding event creator)
      const allUsers = await EmailRecipientUtils.getActiveVerifiedUsers(
        currentUser.email
      );

      // Send notifications in parallel but don't wait for all to complete
      // to avoid blocking the response
      const emailPromises = allUsers.map(
        (user: { email: string; firstName: string; lastName: string }) =>
          EmailService.sendEventCreatedEmail(
            user.email,
            `${user.firstName} ${user.lastName}`,
            {
              title: eventData.title,
              date: eventData.date,
              endDate: eventData.endDate,
              time: eventData.time,
              endTime: eventData.endTime,
              location: eventData.location,
              zoomLink: eventData.zoomLink,
              organizer: eventData.organizer,
              purpose: eventData.purpose,
              format: eventData.format,
              timeZone: eventData.timeZone,
              recurringInfo: isRecurring
                ? {
                    frequency: String(recurringInfo!.frequency),
                    occurrenceCount: recurringInfo!.occurrenceCount!,
                  }
                : undefined,
            }
          ).catch((error) => {
            console.error(
              `Failed to send event notification to ${user.email}:`,
              error
            );
            return false; // Continue with other emails even if one fails
          })
      );

      // Process emails in the background
      Promise.all(emailPromises)
        .then(() => {
          // results intentionally ignored
        })
        .catch((error) => {
          console.error("Error processing event notification emails:", error);
        });

      result.emailsSent = true;
    } catch (emailError) {
      console.error(
        "Error fetching users for event notifications:",
        emailError
      );
      // Don't fail the event creation if email notifications fail
    }

    // 3. Send co-organizer assignment notifications (if applicable)
    try {
      // Get populated event data for notifications (includes real emails)
      let populatedEvent: unknown;
      try {
        populatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            idToString(event._id)
          );
      } catch (populationError) {
        console.error("Error populating event data:", populationError);
        populatedEvent = event; // fallback to raw event
      }
      // Additional safeguard: if population returned null/undefined, fall back to original event
      if (!populatedEvent) {
        populatedEvent = event;
      }

      if (
        EventCreationNotificationService.hasOrganizerDetails(populatedEvent) &&
        populatedEvent.organizerDetails &&
        populatedEvent.organizerDetails.length > 0
      ) {
        console.log("🔔 Sending co-organizer assignment notifications...");

        // Get co-organizers (excluding main organizer) using populated event
        const coOrganizers = await EmailRecipientUtils.getEventCoOrganizers(
          populatedEvent as unknown as IEvent
        );

        if (coOrganizers.length > 0) {
          console.log(
            `📧 Found ${coOrganizers.length} co-organizers to notify`
          );

          // Send email notifications to co-organizers
          const coOrganizerEmailPromises = coOrganizers.map(
            async (coOrganizer) => {
              try {
                await EmailService.sendCoOrganizerAssignedEmail(
                  coOrganizer.email,
                  {
                    firstName: coOrganizer.firstName,
                    lastName: coOrganizer.lastName,
                  },
                  {
                    title: event.title,
                    date: event.date,
                    time: event.time,
                    location: event.location || "",
                  },
                  {
                    firstName: currentUser.firstName || "Unknown",
                    lastName: currentUser.lastName || "User",
                  }
                );
                console.log(
                  `✅ Co-organizer notification sent to ${coOrganizer.email}`
                );
                return true;
              } catch (error) {
                console.error(
                  `❌ Failed to send co-organizer notification to ${coOrganizer.email}:`,
                  error
                );
                return false;
              }
            }
          );

          // Send system messages to co-organizers (targeted messages)
          const coOrganizerSystemMessagePromises = coOrganizers.map(
            async (coOrganizer) => {
              try {
                // Get the user ID for targeted system message
                const coOrganizerUser = await User.findOne({
                  email: coOrganizer.email,
                }).select("_id");

                if (coOrganizerUser) {
                  // Create targeted system message using the new method
                  await UnifiedMessageController.createTargetedSystemMessage(
                    {
                      title: `Co-Organizer Assignment: ${event.title}`,
                      content: `You have been assigned as a co-organizer for the event "${event.title}" scheduled for ${event.date} at ${event.time}. Please review the event details and reach out to the main organizer if you have any questions.`,
                      type: "announcement",
                      priority: "high",
                    },
                    [idToString(coOrganizerUser._id)],
                    {
                      id: idToString(currentUser._id),
                      firstName: currentUser.firstName || "Unknown",
                      lastName: currentUser.lastName || "User",
                      username: currentUser.username || "unknown",
                      avatar: currentUser.avatar,
                      gender: currentUser.gender || "male",
                      authLevel: currentUser.role,
                      roleInAtCloud: currentUser.roleInAtCloud,
                    }
                  );

                  console.log(
                    `✅ Co-organizer system message sent to ${coOrganizer.email}`
                  );
                }
                return true;
              } catch (error) {
                console.error(
                  `❌ Failed to send co-organizer system message to ${coOrganizer.email}:`,
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
              console.log(
                `✅ Processed ${results.length} co-organizer notifications`
              );
            })
            .catch((error) => {
              console.error(
                "Error processing co-organizer notifications:",
                error
              );
            });

          result.coOrganizerNotificationsSent = true;
        } else {
          console.log("ℹ️  No co-organizers found for notifications");
        }
      }
    } catch (coOrganizerError) {
      console.error(
        "Error sending co-organizer notifications:",
        coOrganizerError
      );
      // Don't fail the event creation if co-organizer notifications fail
    }

    return result;
  }
}
