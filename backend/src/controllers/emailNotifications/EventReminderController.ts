import { Request, Response } from "express";
import mongoose from "mongoose";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { UnifiedMessageController } from "../unifiedMessageController";
import { CachePatterns } from "../../services";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import type { EventReminderRequest } from "./types";

export default class EventReminderController {
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

      // Send reminder emails to all participants and guests (deduplicated by email)
      const reminder = reminderType || "24h";
      const emailResults = await EmailService.sendEventReminderEmailBulk(
        [
          ...eventParticipants.map((p) => ({
            email: p.email,
            name: `${p.firstName} ${p.lastName}`.trim() || p.email,
          })),
          ...eventGuests.map((g) => ({
            email: g.email,
            name: `${g.firstName} ${g.lastName}`.trim() || g.email,
          })),
        ],
        reminderEventData,
        reminder
      );
      const successCount = (emailResults || []).filter(
        (v: boolean) => v === true
      ).length;

      console.log(
        `Event reminder notification sent: ${eventData.title} (${eventId}) - ${
          reminderType || "24h"
        } reminder to ${successCount}/${totalEmailRecipients} recipients (participants + guests, deduped)`
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
