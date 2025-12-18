import type { Request } from "express";
import type { IEvent } from "../../models";
import { User, Event } from "../../models";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { Logger } from "../LoggerService";
import { EventController } from "../../controllers/eventController";

const logger = Logger.getInstance().child("AutoUnpublishService");

/** Grace period before auto-unpublishing (48 hours in milliseconds) */
const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

/**
 * AutoUnpublishService
 * Handles automatic unpublishing of events when required fields are missing after updates.
 * Uses a 48-hour grace period: events are warned immediately but only unpublished after 48 hours.
 * Extracted from UpdateController Phase 8.1.6.
 */
export class AutoUnpublishService {
  /**
   * Check if event should be scheduled for auto-unpublish.
   * Instead of immediately unpublishing, schedule unpublish for 48 hours later.
   * Returns state indicating whether warning was issued and which fields were missing.
   */
  static async checkAndApplyAutoUnpublish(event: IEvent): Promise<{
    autoUnpublished: boolean; // Now means "warning issued / scheduled for unpublish"
    missingFields: string[];
  }> {
    let autoUnpublished = false;
    let missingFieldsForAutoUnpublish: string[] = [];

    if (event.publish) {
      try {
        const { getMissingNecessaryFieldsForPublish } = await import(
          "../../utils/validatePublish"
        );
        const missing = getMissingNecessaryFieldsForPublish(
          event as unknown as IEvent
        );
        if (missing.length) {
          // Check if this is a NEW grace period warning (no existing schedule)
          const existingSchedule = (
            event as unknown as { unpublishScheduledAt?: Date | null }
          ).unpublishScheduledAt;
          const isNewWarning = !existingSchedule;

          // Instead of immediately unpublishing, schedule for 48 hours from now
          // Only update schedule if this is a new warning (don't reset the clock)
          if (isNewWarning) {
            const scheduledTime = new Date(Date.now() + GRACE_PERIOD_MS);
            (
              event as unknown as { unpublishScheduledAt?: Date | null }
            ).unpublishScheduledAt = scheduledTime;
          }
          (
            event as unknown as { unpublishWarningFields?: string[] }
          ).unpublishWarningFields = missing;
          // Keep the event published for now (grace period)
          // event.publish remains true

          // Only trigger notification for NEW warnings, not subsequent edits
          autoUnpublished = isNewWarning;
          missingFieldsForAutoUnpublish = missing;
        } else {
          // All required fields present: clear any scheduled unpublish
          (
            event as unknown as { unpublishScheduledAt?: Date | null }
          ).unpublishScheduledAt = null;
          (
            event as unknown as { unpublishWarningFields?: string[] }
          ).unpublishWarningFields = undefined;
          // Clear previous auto-unpublish reason if republished later
          if (
            (event as unknown as { autoUnpublishedReason?: string })
              .autoUnpublishedReason
          ) {
            (
              event as unknown as { autoUnpublishedReason?: string | null }
            ).autoUnpublishedReason = null;
          }
        }
      } catch (e) {
        try {
          logger.warn(
            `Auto-unpublish check failed during update; proceeding without scheduling: ${
              (e as Error).message
            }`
          );
        } catch {}
      }
    }

    return { autoUnpublished, missingFields: missingFieldsForAutoUnpublish };
  }

  /**
   * Execute scheduled unpublishes for events past their grace period.
   * Called by the scheduler to actually unpublish events whose 48-hour window has expired.
   */
  static async executeScheduledUnpublishes(): Promise<{
    unpublishedCount: number;
    eventIds: string[];
  }> {
    const now = new Date();
    const unpublishedEventIds: string[] = [];

    try {
      // Find events with scheduled unpublish time that has passed
      const eventsToUnpublish = await Event.find({
        publish: true,
        unpublishScheduledAt: { $ne: null, $lte: now },
      });

      for (const event of eventsToUnpublish) {
        try {
          event.publish = false;
          (
            event as unknown as { autoUnpublishedAt?: Date | null }
          ).autoUnpublishedAt = new Date();
          (
            event as unknown as { autoUnpublishedReason?: string | null }
          ).autoUnpublishedReason = "MISSING_REQUIRED_FIELDS";
          // Clear the scheduled unpublish since it's now executed
          (
            event as unknown as { unpublishScheduledAt?: Date | null }
          ).unpublishScheduledAt = null;

          await event.save();
          unpublishedEventIds.push(event.id);

          // Send notification about actual unpublish
          await this.sendActualUnpublishNotification(event);

          logger.info(
            `Event ${event.id} (${event.title}) auto-unpublished after grace period expired`
          );
        } catch (err) {
          logger.error(`Failed to unpublish event ${event.id}:`, err as Error);
        }
      }

      if (unpublishedEventIds.length > 0) {
        logger.info(
          `Auto-unpublished ${unpublishedEventIds.length} events after grace period`
        );
      }
    } catch (err) {
      logger.error("Failed to execute scheduled unpublishes:", err as Error);
    }

    return {
      unpublishedCount: unpublishedEventIds.length,
      eventIds: unpublishedEventIds,
    };
  }

  /**
   * Send notification when an event is actually unpublished (after grace period).
   */
  private static async sendActualUnpublishNotification(
    event: IEvent
  ): Promise<void> {
    try {
      const { EmailService } = await import(
        "../../services/infrastructure/EmailServiceFacade"
      );
      const { domainEvents, EVENT_AUTO_UNPUBLISHED } = await import(
        "../../services/domainEvents"
      );
      const { UnifiedMessageController } = await import(
        "../../controllers/unifiedMessageController"
      );

      const missingFields =
        (event as unknown as { unpublishWarningFields?: string[] })
          .unpublishWarningFields || [];

      // Get all event organizers for notification
      try {
        const eventOrganizers = await EmailRecipientUtils.getEventAllOrganizers(
          event
        );
        const organizerEmails = eventOrganizers.map((org) => org.email);

        EmailService.sendEventActualUnpublishNotification({
          eventId: event.id,
          title: event.title,
          format: (event as unknown as { format?: string }).format,
          missingFields: missingFields,
          recipients: organizerEmails,
        }).catch(() => {});

        // Emit domain event
        try {
          domainEvents.emit(EVENT_AUTO_UNPUBLISHED, {
            eventId: event.id,
            title: event.title,
            format: (event as unknown as { format?: string }).format,
            missingFields: missingFields,
            reason: "MISSING_REQUIRED_FIELDS",
            autoUnpublishedAt: new Date().toISOString(),
          });
        } catch {}

        // Create system message for organizers
        const humanLabels: Record<string, string> = {
          zoomLink: "Zoom Link",
          meetingId: "Meeting ID",
          passcode: "Passcode",
          location: "Location",
        };
        const missingReadable = missingFields
          .map((f) => humanLabels[f] || f)
          .join(", ");

        const organizerUserIds: string[] = [];
        for (const organizer of eventOrganizers) {
          const user = await User.findOne({ email: organizer.email }).select(
            "_id"
          );
          if (user) {
            organizerUserIds.push(EventController.toIdString(user._id));
          }
        }

        if (organizerUserIds.length > 0) {
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: `Event Unpublished: ${event.title}`,
              content: `The 48-hour grace period has expired. Your event was automatically unpublished because required field(s) are still missing: ${missingReadable}. Please add the missing field(s) and publish again to make it publicly visible.`,
              type: "error",
              priority: "high",
              hideCreator: true,
              metadata: {
                eventId: event.id,
                reason: "GRACE_PERIOD_EXPIRED",
                missing: missingFields,
              },
            },
            organizerUserIds
          );
        }
      } catch {
        // Fallback to admin email
        EmailService.sendEventActualUnpublishNotification({
          eventId: event.id,
          title: event.title,
          format: (event as unknown as { format?: string }).format,
          missingFields: missingFields,
        }).catch(() => {});
      }
    } catch (e) {
      logger.warn(
        `Failed to send actual unpublish notification: ${(e as Error).message}`
      );
    }
  }

  /**
   * Send notifications (email + system messages) to organizers when event is auto-unpublished.
   */
  static async sendAutoUnpublishNotifications(
    event: IEvent,
    missingFields: string[],
    req: Request
  ): Promise<void> {
    try {
      const { EmailService } = await import(
        "../../services/infrastructure/EmailServiceFacade"
      );
      const { domainEvents, EVENT_AUTO_UNPUBLISHED } = await import(
        "../../services/domainEvents"
      );
      const { UnifiedMessageController } = await import(
        "../../controllers/unifiedMessageController"
      );

      // Get all event organizers (main organizer + co-organizers) for grace period warning notification
      try {
        const eventOrganizers = await EmailRecipientUtils.getEventAllOrganizers(
          event
        );
        const organizerEmails = eventOrganizers.map((org) => org.email);

        // Send warning email about 48-hour grace period
        EmailService.sendEventUnpublishWarningNotification({
          eventId: event.id,
          title: event.title,
          format: (event as unknown as { format?: string }).format,
          missingFields: missingFields,
          recipients: organizerEmails, // Send to event organizers instead of fallback admin
        }).catch(() => {});
      } catch {
        // Fallback to admin email if organizer lookup fails
        EmailService.sendEventUnpublishWarningNotification({
          eventId: event.id,
          title: event.title,
          format: (event as unknown as { format?: string }).format,
          missingFields: missingFields,
        }).catch(() => {});
      }

      // Note: We don't emit EVENT_AUTO_UNPUBLISHED here since the event is not unpublished yet
      // The event is still published during the grace period

      // Create targeted system message for all event organizers to surface grace period warning in real-time
      try {
        const actor = req.user;
        if (actor && actor._id) {
          const humanLabels: Record<string, string> = {
            zoomLink: "Zoom Link",
            meetingId: "Meeting ID",
            passcode: "Passcode",
            location: "Location",
          };
          const missingReadable = missingFields
            .map((f) => humanLabels[f] || f)
            .join(", ");

          // Get all event organizers to send system messages to
          try {
            const eventOrganizers =
              await EmailRecipientUtils.getEventAllOrganizers(event);
            const organizerUserIds = [];

            // Find the User IDs for all organizers
            for (const organizer of eventOrganizers) {
              const user = await User.findOne({
                email: organizer.email,
              }).select("_id");
              if (user) {
                organizerUserIds.push(EventController.toIdString(user._id));
              }
            }

            // If we have organizer IDs, send to all of them; otherwise fallback to just the actor
            const targetUserIds =
              organizerUserIds.length > 0
                ? organizerUserIds
                : [EventController.toIdString(actor._id)];

            await UnifiedMessageController.createTargetedSystemMessage(
              {
                title: `Action Required: Event Missing Fields – ${event.title}`,
                content: `⚠️ Your event is missing required publishing field(s): ${missingReadable}. Please add the missing field(s) within 48 hours or the event will be automatically unpublished.`,
                type: "warning",
                priority: "high",
                metadata: {
                  eventId: event.id,
                  reason: "GRACE_PERIOD_WARNING",
                  missing: missingFields,
                  expiresAt: new Date(
                    Date.now() + GRACE_PERIOD_MS
                  ).toISOString(),
                },
              },
              targetUserIds,
              {
                id: EventController.toIdString(actor._id),
                firstName: actor.firstName || "",
                lastName: actor.lastName || "",
                username: actor.username || "",
                avatar: actor.avatar,
                gender: actor.gender || "male",
                authLevel: actor.role,
                roleInAtCloud: actor.roleInAtCloud,
              }
            );
          } catch {
            // Fallback to just the actor if organizer lookup fails
            await UnifiedMessageController.createTargetedSystemMessage(
              {
                title: `Action Required: Event Missing Fields – ${event.title}`,
                content: `⚠️ Your event is missing required publishing field(s): ${missingReadable}. Please add the missing field(s) within 48 hours or the event will be automatically unpublished.`,
                type: "warning",
                priority: "high",
                metadata: {
                  eventId: event.id,
                  reason: "GRACE_PERIOD_WARNING",
                  missing: missingFields,
                  expiresAt: new Date(
                    Date.now() + GRACE_PERIOD_MS
                  ).toISOString(),
                },
              },
              [EventController.toIdString(actor._id)],
              {
                id: EventController.toIdString(actor._id),
                firstName: actor.firstName || "",
                lastName: actor.lastName || "",
                username: actor.username || "",
                avatar: actor.avatar,
                gender: actor.gender || "male",
                authLevel: actor.role,
                roleInAtCloud: actor.roleInAtCloud,
              }
            );
          }
        }
      } catch {}
    } catch (e) {
      try {
        logger.warn(
          `Failed to dispatch auto-unpublish warning notification: ${
            (e as Error).message
          }`
        );
      } catch {}
    }
  }
}
