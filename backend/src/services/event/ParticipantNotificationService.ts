import type { Request } from "express";
import type { IEvent } from "../../models";
import { User } from "../../models";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { EmailService } from "../infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../controllers/unifiedMessageController";
import { EventController } from "../../controllers/eventController";
import { formatActorDisplay } from "../../utils/systemMessageFormatUtils";
import { Logger } from "../LoggerService";

const logger = Logger.getInstance().child("ParticipantNotificationService");

/**
 * ParticipantNotificationService
 * Handles notifications to participants and guests when event is updated.
 * Extracted from UpdateController Phase 8.1.8.
 */
export class ParticipantNotificationService {
  /**
   * Send event update notifications (email + system messages) to all participants and guests.
   * Handles deduplication and email-to-userId resolution.
   */
  static async sendEventUpdateNotifications(
    eventId: string,
    event: IEvent,
    req: Request
  ): Promise<void> {
    try {
      const [participants, guests] = await Promise.all([
        EmailRecipientUtils.getEventParticipants(eventId),
        EmailRecipientUtils.getEventGuests(eventId),
      ]);

      const actorDisplay = formatActorDisplay({
        firstName: req.user?.firstName,
        lastName: req.user?.lastName,
        email: req.user?.email || "",
        role: req.user?.role || "",
      });

      const updateMessage = `The event "${
        event.title
      }" you registered for has been edited by ${
        actorDisplay || "an authorized user"
      }. Please review the updated details.`;

      const eventMeta = event as unknown as {
        endDate?: string;
        timeZone?: string;
      };
      const emailPayload = {
        eventTitle: event.title,
        date: event.date,
        endDate: eventMeta.endDate,
        time: event.time,
        endTime: event.endTime,
        timeZone: eventMeta.timeZone,
        message: updateMessage,
      };

      // Combine participants and guests into a single array for deduplication
      // (Users with multiple roles should only receive one email)
      const allRecipients = [
        ...(participants || []).map(
          (p: { email: string; firstName?: string; lastName?: string }) => ({
            email: p.email,
            name:
              [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email,
          })
        ),
        ...(guests || []).map(
          (g: { email: string; firstName?: string; lastName?: string }) => ({
            email: g.email,
            name:
              [g.firstName, g.lastName].filter(Boolean).join(" ") || g.email,
          })
        ),
      ];

      // Send emails (bulk function handles deduplication by email address)
      const emailSends = EmailService.sendEventNotificationEmailBulk(
        allRecipients,
        emailPayload
      );

      // Resolve participant user IDs; fallback to lookup by email when _id missing
      const participantUserIds = (
        await Promise.all(
          (participants || []).map(
            async (p: { _id?: unknown; email?: string }) => {
              const existing = p._id
                ? EventController.toIdString(p._id)
                : undefined;
              if (existing) return existing;
              if (!p.email) return undefined;
              try {
                const email = String(p.email).toLowerCase();
                // Support both real Mongoose Query (with select/lean) and mocked plain object returns
                const findQuery = (
                  User as unknown as {
                    findOne: (q: unknown) => unknown;
                  }
                ).findOne({
                  email,
                  isActive: true,
                  isVerified: true,
                });

                let userDoc: unknown;
                if (
                  findQuery &&
                  typeof (findQuery as { select?: unknown }).select ===
                    "function"
                ) {
                  // In production, use a lean, minimal fetch
                  try {
                    userDoc = await (
                      findQuery as {
                        select: (f: string) => {
                          lean: () => Promise<unknown>;
                        };
                      }
                    )
                      .select("_id")
                      .lean();
                  } catch {
                    // Fallback: await the query as-is (helps in certain mocked scenarios)
                    userDoc = await (findQuery as Promise<unknown>);
                  }
                } else {
                  // In tests, mocked findOne may resolve directly to a plain object
                  userDoc = await (findQuery as Promise<unknown>);
                }

                const idVal = (userDoc as { _id?: unknown })?._id;
                return idVal ? EventController.toIdString(idVal) : undefined;
              } catch (e) {
                console.warn(
                  `⚠️ Failed to resolve user ID by email for participant ${p.email}:`,
                  e
                );
                return undefined;
              }
            }
          )
        )
      )
        .filter(Boolean)
        // ensure uniqueness
        .filter((id, idx, arr) => arr.indexOf(id) === idx) as string[];

      const systemMessagePromise =
        participantUserIds.length > 0
          ? UnifiedMessageController.createTargetedSystemMessage(
              {
                title: `Event Updated: ${event.title}`,
                content: updateMessage,
                type: "update",
                priority: "medium",
                metadata: { eventId: eventId },
              },
              participantUserIds,
              {
                id: EventController.toIdString(req.user!._id),
                firstName: req.user?.firstName || "",
                lastName: req.user?.lastName || "",
                username: req.user?.username || "",
                avatar: req.user?.avatar,
                gender: req.user?.gender || "male",
                authLevel: req.user?.role || "",
                roleInAtCloud: req.user?.roleInAtCloud,
              }
            ).catch((err: unknown) => {
              console.error(
                "❌ Failed to create participant system messages for event update:",
                err
              );
              return false as boolean;
            })
          : Promise.resolve(true as boolean);

      // Fire-and-forget to avoid blocking the response
      Promise.all([emailSends, systemMessagePromise])
        .then(([emailResults, sys]) => {
          const results = [...(emailResults as boolean[]), sys as boolean];
          const successCount = results.filter((r) => r === true).length;
          console.log(
            `✅ Processed ${successCount}/${results.length} event edit notifications (emails + system messages, deduped)`
          );
        })
        .catch((err) => {
          console.error(
            "Error processing event edit notifications (participants/guests):",
            err
          );
        });
    } catch (notifyErr) {
      console.error(
        "Error preparing participant/guest notifications for event edit:",
        notifyErr
      );
    }
  }
}
