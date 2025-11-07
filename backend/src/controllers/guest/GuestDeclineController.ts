/**
 * GuestDeclineController.ts
 * Handles guest invitation decline flow
 */
import type { Request, Response } from "express";
import { GuestRegistration, Event } from "../../models";
import { User } from "../../models";
import mongoose from "mongoose";
import { createLogger } from "../../services/LoggerService";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { TrioNotificationService } from "../../services/notifications/TrioNotificationService";
import { socketService } from "../../services/infrastructure/SocketService";

// Local types
type EventLike = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  date?: Date;
  location?: string;
  organizerDetails?: Array<{ email?: string }>;
};

/**
 * Controller for handling guest invitation decline operations
 */
class GuestDeclineController {
  private static readonly log = createLogger("GuestDeclineController");

  /**
   * Validate a guest invitation decline token and return summary info
   * GET /api/guest/decline/:token
   */
  static async getDeclineTokenInfo(req: Request, res: Response): Promise<void> {
    let { token } = req.params;
    token = typeof token === "string" ? token.trim() : token;
    try {
      const { verifyGuestInvitationDeclineToken } = await import(
        "../../utils/guestInvitationDeclineToken"
      );
      const verification = verifyGuestInvitationDeclineToken(token);
      if (!verification.valid) {
        try {
          GuestDeclineController.log.debug(
            "Decline token verification failed",
            undefined,
            {
              suppliedLength: (token || "").length,
              reason: verification.reason,
            }
          );
        } catch {
          /* ignore logging issues */
        }
        const reasonMap: Record<string, number> = {
          invalid: 400,
          expired: 410,
          wrong_type: 400,
        };
        res.status(reasonMap[verification.reason] || 400).json({
          success: false,
          message:
            verification.reason === "expired"
              ? "Decline link has expired"
              : "Invalid decline link",
          reason: verification.reason,
        });
        return;
      }
      const registrationId = verification.payload.registrationId;
      const doc = await GuestRegistration.findById(registrationId);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Registration not found" });
        return;
      }
      if (doc.status === "cancelled" || doc.declinedAt) {
        res.status(409).json({
          success: false,
          message: "Invitation already declined or cancelled",
        });
        return;
      }
      // Minimal event fetch for summary
      const event = (await Event.findById(doc.eventId)) as EventLike | null;
      res.json({
        success: true,
        data: {
          registrationId: doc._id,
          eventTitle: (event?.title as string) || doc.eventSnapshot?.title,
          roleName: doc.eventSnapshot?.roleName,
          guestName: doc.fullName,
          eventDate: event?.date || doc.eventSnapshot?.date,
          location: event?.location || doc.eventSnapshot?.location,
        },
      });
    } catch (err) {
      console.error("getDeclineTokenInfo error", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  /**
   * Submit a guest invitation decline
   * POST /api/guest/decline/:token  { reason?: string }
   */
  static async submitDecline(req: Request, res: Response): Promise<void> {
    let { token } = req.params;
    token = typeof token === "string" ? token.trim() : token;
    const { reason } = (req.body || {}) as { reason?: string };
    try {
      const { verifyGuestInvitationDeclineToken } = await import(
        "../../utils/guestInvitationDeclineToken"
      );
      const verification = verifyGuestInvitationDeclineToken(token);
      if (!verification.valid) {
        try {
          GuestDeclineController.log.debug(
            "Decline token verification failed (submit)",
            undefined,
            {
              suppliedLength: (token || "").length,
              reason: verification.reason,
            }
          );
        } catch {
          /* ignore */
        }
        const reasonMap: Record<string, number> = {
          invalid: 400,
          expired: 410,
          wrong_type: 400,
        };
        res.status(reasonMap[verification.reason] || 400).json({
          success: false,
          message:
            verification.reason === "expired"
              ? "Decline link has expired"
              : "Invalid decline link",
          reason: verification.reason,
        });
        return;
      }
      const registrationId = verification.payload.registrationId;
      const doc = await GuestRegistration.findById(registrationId);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Registration not found" });
        return;
      }
      if (doc.status === "cancelled" || doc.declinedAt) {
        res.status(409).json({
          success: false,
          message: "Invitation already declined or cancelled",
        });
        return;
      }
      // Apply decline fields
      doc.status = "cancelled"; // maintain existing enum usage
      doc.migrationStatus = "declined";
      doc.declinedAt = new Date();
      if (reason) {
        doc.declineReason = String(reason).slice(0, 500);
      }
      await doc.save();

      // Attempt organizer notification (non-critical)
      // Only notify organizers if guest was NOT invited by an authenticated user
      // (if invitedBy exists, we'll notify that specific user instead)
      try {
        const event = (await Event.findById(doc.eventId)) as EventLike | null;

        // Skip organizer notification if this guest was invited by a specific user
        if (!doc.invitedBy) {
          const organizerEmails: string[] = (
            ((event as EventLike | null)?.organizerDetails || []) as Array<
              Record<string, unknown>
            >
          )
            .map((o) => String(o["email"] || ""))
            .filter((e) => !!e);
          if (organizerEmails.length > 0) {
            GuestDeclineController.log.debug(
              "Sending decline notification to organizers (self-registered guest)",
              undefined,
              { organizerCount: organizerEmails.length }
            );
            await EmailService.sendGuestDeclineNotification({
              event: {
                title:
                  (event?.title as string) ||
                  doc.eventSnapshot?.title ||
                  "Event",
                date:
                  (event?.date as Date) || (doc.eventSnapshot?.date as Date),
              },
              roleName: doc.eventSnapshot?.roleName,
              guest: { name: doc.fullName, email: doc.email },
              reason: doc.declineReason,
              organizerEmails,
            });
          }
        } else {
          GuestDeclineController.log.debug(
            "Skipping organizer notification - guest was invited by authenticated user",
            undefined,
            { invitedBy: String(doc.invitedBy) }
          );
        }

        // Emit real-time guest_declined event so UI updates without refresh
        try {
          const roleId = String(doc.roleId);
          socketService.emitEventUpdate(String(doc.eventId), "guest_declined", {
            roleId,
            guestName: doc.fullName,
          });
        } catch (rtErr) {
          console.error("Failed to emit guest_declined event", rtErr);
        }

        // Create a system message / notification for the person responsible
        // Priority order:
        // 1. invitedBy (authenticated user who invited this guest)
        // 2. event.createdBy (event creator - fallback for old records or self-registrations)
        try {
          let assignerUserId: string | undefined;

          // First priority: Check if guest was invited by an authenticated user
          if (doc.invitedBy) {
            assignerUserId = String(doc.invitedBy);
            GuestDeclineController.log.debug(
              "Using invitedBy for decline notification",
              undefined,
              { invitedBy: assignerUserId }
            );
          } else {
            // Fallback: Use event creator for self-registered guests or old records
            const createdBy = (event as unknown as { createdBy?: unknown })
              ?.createdBy;
            if (
              createdBy &&
              typeof createdBy === "object" &&
              (createdBy as { _id?: unknown })._id
            ) {
              assignerUserId = String((createdBy as { _id: unknown })._id);
            } else if (typeof createdBy === "string") {
              assignerUserId = createdBy;
            }
            GuestDeclineController.log.debug(
              "Using event.createdBy for decline notification (fallback)",
              undefined,
              { createdBy: assignerUserId }
            );
          }

          // Avoid self-notification if guest email matches assigner user (edge case extremely rare)
          if (assignerUserId) {
            // Fetch assigner minimal user doc
            type LeanUser = {
              _id: mongoose.Types.ObjectId;
              firstName?: string;
              lastName?: string;
              username?: string;
              email?: string;
              avatar?: string;
              gender?: string;
              role?: string;
              roleInAtCloud?: string;
            };
            const assignerDoc =
              (await User.findById(assignerUserId).lean<LeanUser | null>()) ||
              null;
            if (
              assignerDoc &&
              (assignerDoc.email || "").toLowerCase() !==
                (doc.email || "").toLowerCase()
            ) {
              await TrioNotificationService.createTrio({
                email: assignerDoc.email
                  ? {
                      to: assignerDoc.email,
                      template: "event-role-rejected",
                      data: {
                        event: {
                          id: String(doc.eventId),
                          title:
                            (event?.title as string) ||
                            doc.eventSnapshot?.title ||
                            "Event",
                        },
                        roleName: doc.eventSnapshot?.roleName || "Role",
                        rejectedBy: {
                          id: "guest",
                          firstName: doc.fullName.split(" ")[0] || doc.fullName,
                          lastName:
                            doc.fullName.split(" ").slice(1).join(" ") || "",
                        },
                        assigner: {
                          id: String(assignerDoc._id),
                          firstName: assignerDoc.firstName || "",
                          lastName: assignerDoc.lastName || "",
                          username: assignerDoc.username || "",
                          avatar: assignerDoc.avatar,
                          gender: assignerDoc.gender,
                          authLevel: assignerDoc.role,
                          roleInAtCloud: assignerDoc.roleInAtCloud,
                        },
                        noteProvided: Boolean(doc.declineReason),
                        noteText: doc.declineReason,
                      },
                      priority: "low",
                    }
                  : undefined,
                systemMessage: {
                  title: "Guest Invitation Declined",
                  content:
                    `${doc.fullName} declined the guest invitation for role "${
                      doc.eventSnapshot?.roleName || "Role"
                    }" in event "${
                      (event?.title as string) ||
                      doc.eventSnapshot?.title ||
                      "Event"
                    }".` +
                    (doc.declineReason
                      ? `\n\nReason: ${doc.declineReason.slice(0, 200)}`
                      : ""),
                  type: "event_role_change",
                  priority: "medium",
                  hideCreator: true,
                },
                recipients: [String(assignerDoc._id)],
                creator: {
                  id: String(assignerDoc._id),
                  firstName: assignerDoc.firstName || "",
                  lastName: assignerDoc.lastName || "",
                  username: assignerDoc.username || "",
                  avatar: assignerDoc.avatar,
                  gender: assignerDoc.gender || "",
                  authLevel: assignerDoc.role || "",
                  roleInAtCloud: assignerDoc.roleInAtCloud,
                },
              });
            }
          }
        } catch (sysErr) {
          console.error(
            "Failed to create system message for guest decline",
            sysErr
          );
        }
      } catch (notifyErr) {
        console.error("Failed to send guest decline notification", notifyErr);
      }

      res.json({
        success: true,
        message: "Invitation declined successfully",
        data: {
          registrationId: doc._id,
          declinedAt: doc.declinedAt,
        },
      });
    } catch (err) {
      console.error("submitDecline error", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export default GuestDeclineController;
