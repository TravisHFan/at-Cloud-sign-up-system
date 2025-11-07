import type { Request } from "express";
import type { IEvent } from "../../models";
import { User } from "../../models";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { Logger } from "../LoggerService";
import { EventController } from "../../controllers/eventController";

const logger = Logger.getInstance().child("AutoUnpublishService");

/**
 * AutoUnpublishService
 * Handles automatic unpublishing of events when required fields are missing after updates.
 * Extracted from UpdateController Phase 8.1.6.
 */
export class AutoUnpublishService {
  /**
   * Check if event should be auto-unpublished and apply unpublish if necessary.
   * Returns state indicating whether auto-unpublish occurred and which fields were missing.
   */
  static async checkAndApplyAutoUnpublish(event: IEvent): Promise<{
    autoUnpublished: boolean;
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
          event.publish = false;
          (
            event as unknown as { autoUnpublishedAt?: Date | null }
          ).autoUnpublishedAt = new Date();
          (
            event as unknown as { autoUnpublishedReason?: string | null }
          ).autoUnpublishedReason = "MISSING_REQUIRED_FIELDS";
          autoUnpublished = true;
          missingFieldsForAutoUnpublish = missing;
        } else {
          // Clear previous auto-unpublish reason if republished later (leave publish flag logic to publish endpoint)
          if (
            (event as unknown as { autoUnpublishedReason?: string })
              .autoUnpublishedReason &&
            !missing.length
          ) {
            (
              event as unknown as { autoUnpublishedReason?: string | null }
            ).autoUnpublishedReason = null;
          }
        }
      } catch (e) {
        try {
          logger.warn(
            `Auto-unpublish check failed during update; proceeding without unpublish: ${
              (e as Error).message
            }`
          );
        } catch {}
      }
    }

    return { autoUnpublished, missingFields: missingFieldsForAutoUnpublish };
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

      // Get all event organizers (main organizer + co-organizers) for auto-unpublish notification
      try {
        const eventOrganizers = await EmailRecipientUtils.getEventAllOrganizers(
          event
        );
        const organizerEmails = eventOrganizers.map((org) => org.email);

        EmailService.sendEventAutoUnpublishNotification({
          eventId: event.id,
          title: event.title,
          format: (event as unknown as { format?: string }).format,
          missingFields: missingFields,
          recipients: organizerEmails, // Send to event organizers instead of fallback admin
        }).catch(() => {});
      } catch {
        // Fallback to admin email if organizer lookup fails
        EmailService.sendEventAutoUnpublishNotification({
          eventId: event.id,
          title: event.title,
          format: (event as unknown as { format?: string }).format,
          missingFields: missingFields,
        }).catch(() => {});
      }

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

      // Create targeted system message for all event organizers to surface auto-unpublish in real-time
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
                title: `Event Auto-Unpublished: ${event.title}`,
                content: `This event was automatically unpublished because required publishing field(s) are missing: ${missingReadable}. Add the missing field(s) and publish again.`,
                type: "warning",
                priority: "medium",
                metadata: {
                  eventId: event.id,
                  reason: "MISSING_REQUIRED_FIELDS",
                  missing: missingFields,
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
                title: `Event Auto-Unpublished: ${event.title}`,
                content: `This event was automatically unpublished because required publishing field(s) are missing: ${missingReadable}. Add the missing field(s) and publish again.`,
                type: "warning",
                priority: "medium",
                metadata: {
                  eventId: event.id,
                  reason: "MISSING_REQUIRED_FIELDS",
                  missing: missingFields,
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
          `Failed to dispatch auto-unpublish notification: ${
            (e as Error).message
          }`
        );
      } catch {}
    }
  }
}
