import { Request, Response } from "express";
import { hashEmail, truncateIpToCidr } from "../utils/privacy";
import {
  registrationFailureCounter,
  registrationAttemptCounter,
} from "../services/PrometheusMetricsService";
import Event from "../models/Event";
import User from "../models/User";
import Registration from "../models/Registration";
import GuestRegistration from "../models/GuestRegistration";
import { CapacityService } from "../services/CapacityService";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import { lockService } from "../services/LockService";
import { EmailService } from "../services/infrastructure/emailService";
import { socketService } from "../services/infrastructure/SocketService";
import { ResponseBuilderService } from "../services/ResponseBuilderService";
import { CachePatterns } from "../services";
import { buildRegistrationICS } from "../services/ICSBuilder";
import buildPublicRegistrationConfirmationEmail from "../services/emailTemplates/publicRegistrationConfirmation";
import AuditLog from "../models/AuditLog";

// hashEmail + truncateIpToCidr imported from utils/privacy

interface PublicRegistrationBody {
  roleId?: string;
  attendee?: { name?: string; email?: string; phone?: string };
  consent?: { termsAccepted?: boolean };
}

export class PublicEventController {
  /**
   * POST /api/public/events/:slug/register (idempotent for duplicates)
   * Behavior:
   *  - If email belongs to existing user -> create standard Registration (or return Already registered)
   *  - Else create GuestRegistration (idempotent return on duplicate)
   */
  static async register(req: Request, res: Response): Promise<void> {
    const log = CorrelatedLogger.fromRequest(req, "PublicEventController");
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);
    try {
      // Count all attempts (success or fail)
      try {
        registrationAttemptCounter.inc();
      } catch {}
      const { slug } = req.params;
      const { roleId, attendee, consent }: PublicRegistrationBody =
        req.body || {};

      if (!slug) {
        log.warn("Public registration validation failure", undefined, {
          reason: "missing_slug",
          requestId,
          ipCidr,
        });
        res.status(400).json({ success: false, message: "Missing slug" });
        try {
          registrationFailureCounter.inc({ reason: "validation" });
        } catch {}
        return;
      }
      if (!roleId) {
        log.warn("Public registration validation failure", undefined, {
          reason: "missing_roleId",
          requestId,
          ipCidr,
          slug,
        });
        res.status(400).json({ success: false, message: "roleId is required" });
        try {
          registrationFailureCounter.inc({ reason: "validation" });
        } catch {}
        return;
      }
      if (!attendee?.name || !attendee?.email) {
        log.warn("Public registration validation failure", undefined, {
          reason: "missing_attendee_fields",
          requestId,
          ipCidr,
          slug,
          roleId,
        });
        res.status(400).json({
          success: false,
          message: "attendee.name and attendee.email are required",
        });
        try {
          registrationFailureCounter.inc({ reason: "validation" });
        } catch {}
        return;
      }
      if (!consent?.termsAccepted) {
        log.warn("Public registration validation failure", undefined, {
          reason: "missing_consent",
          requestId,
          ipCidr,
          slug,
          roleId,
        });
        res
          .status(400)
          .json({ success: false, message: "termsAccepted must be true" });
        try {
          registrationFailureCounter.inc({ reason: "validation" });
        } catch {}
        return;
      }

      const event = await Event.findOne({ publicSlug: slug, publish: true });
      if (!event) {
        log.warn("Public registration event not found", undefined, {
          reason: "event_not_found",
          slug,
          requestId,
          ipCidr,
        });
        res
          .status(404)
          .json({ success: false, message: "Public event not found" });
        try {
          registrationFailureCounter.inc({ reason: "not_found" });
        } catch {}
        return;
      }
      if (event.status !== "upcoming") {
        log.warn("Public registration rejected", undefined, {
          reason: "event_not_upcoming",
          slug,
          requestId,
          ipCidr,
        });
        res.status(400).json({
          success: false,
          message: "Registration closed for this event",
        });
        try {
          registrationFailureCounter.inc({ reason: "closed" });
        } catch {}
        return;
      }

      interface RoleSnapshot {
        id: string;
        name: string;
        description?: string;
        openToPublic?: boolean;
        capacity?: number;
      }
      const targetRole: RoleSnapshot | undefined = (
        event.roles as unknown as RoleSnapshot[]
      ).find((r) => r.id === roleId);
      if (!targetRole) {
        log.warn("Public registration validation failure", undefined, {
          reason: "role_not_found",
          slug,
          roleId,
          requestId,
          ipCidr,
        });
        res.status(400).json({ success: false, message: "Role not found" });
        try {
          registrationFailureCounter.inc({ reason: "validation" });
        } catch {}
        return;
      }
      if (!targetRole.openToPublic) {
        log.warn("Public registration validation failure", undefined, {
          reason: "role_not_open",
          slug,
          roleId,
          requestId,
          ipCidr,
        });
        res.status(400).json({
          success: false,
          message: "Role is not open to public registration",
        });
        try {
          registrationFailureCounter.inc({ reason: "role_not_open" });
        } catch {}
        return;
      }

      // Acquire application-level lock to enforce capacity safely.
      const lockKey = `public-register:${event._id}:${roleId}`;
      let registrationId: string | null = null;
      let registrationType: "user" | "guest" | null = null;
      let duplicate = false;
      let capacityBefore: number | null = null;
      let capacityAfter: number | null = null;

      await lockService.withLock(
        lockKey,
        async () => {
          // Occupancy BEFORE (for capacityBefore + early duplicate idempotency semantics)
          const occBefore = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            roleId
          );
          capacityBefore = occBefore.total;

          // at this point attendee.email is guaranteed (validated earlier)
          const attendeeEmailLc = attendee.email!.toLowerCase();
          const existingUser = await User.findOne({
            email: attendeeEmailLc,
          });

          if (existingUser) {
            // Duplicate user registration check FIRST (idempotent even if capacity is full now)
            const existingReg = await Registration.findOne({
              eventId: event._id,
              userId: existingUser._id,
              roleId,
            });
            if (existingReg) {
              registrationId = existingReg._id.toString();
              registrationType = "user";
              duplicate = true;
              return; // Do NOT capacity-check duplicates
            }
          } else {
            // Duplicate guest check FIRST
            const existingGuest = await GuestRegistration.findOne({
              eventId: event._id,
              email: attendeeEmailLc,
              status: "active",
            });
            if (existingGuest) {
              registrationId = (
                existingGuest as { _id: { toString(): string } }
              )._id.toString();
              registrationType = "guest";
              duplicate = true;
              return; // Do NOT capacity-check duplicates
            }
          }

          // Only enforce capacity after duplicate short-circuit so duplicates remain idempotent post-capacity
          if (CapacityService.isRoleFull(occBefore)) {
            throw new Error("Role at full capacity");
          }

          if (existingUser) {
            // Double-check capacity under lock again (race)
            const occBeforeSave = await CapacityService.getRoleOccupancy(
              event._id.toString(),
              roleId
            );
            if (CapacityService.isRoleFull(occBeforeSave)) {
              throw new Error("Role at full capacity");
            }
            const roleSnapshot = targetRole;
            const reg = new Registration({
              eventId: event._id,
              userId: existingUser._id,
              roleId,
              registrationDate: new Date(),
              registeredBy: existingUser._id,
              userSnapshot: {
                username: existingUser.username,
                firstName: existingUser.firstName,
                lastName: existingUser.lastName,
                email: existingUser.email,
                systemAuthorizationLevel: existingUser.role,
                roleInAtCloud: existingUser.roleInAtCloud,
                avatar: existingUser.avatar,
                gender: existingUser.gender,
              },
              eventSnapshot: {
                title: event.title,
                date: event.date,
                time: event.time,
                location: event.location,
                type: event.type,
                roleName: roleSnapshot.name,
                roleDescription: roleSnapshot.description,
              },
            });
            await reg.save();
            registrationId = reg._id.toString();
            registrationType = "user";
          } else {
            // Guest creation path
            const occBeforeGuest = await CapacityService.getRoleOccupancy(
              event._id.toString(),
              roleId
            );
            if (CapacityService.isRoleFull(occBeforeGuest)) {
              throw new Error("Role at full capacity");
            }
            const guest = new GuestRegistration({
              eventId: event._id,
              roleId,
              fullName: attendee.name,
              gender: "male", // default placeholder
              email: attendeeEmailLc,
              phone: attendee.phone,
              eventSnapshot: {
                title: event.title,
                date: new Date(event.date + "T00:00:00Z"),
                location: event.location,
                roleName: targetRole.name,
              },
              migrationStatus: "pending",
            });
            await guest.save();
            registrationId = (
              guest as { _id: { toString(): string } }
            )._id.toString();
            registrationType = "guest";
          }

          // Recompute occupancy AFTER creation
          const occAfter = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            roleId
          );
          capacityAfter = occAfter.total;
          await event.save();
        },
        10000
      );

      // If capacity error inside lock
      if (!registrationId) {
        res.status(400).json({
          success: false,
          message: "Unable to register (possibly full capacity)",
        });
        try {
          registrationFailureCounter.inc({ reason: "capacity_full" });
        } catch {}
        return;
      }

      const responsePayload: Record<string, unknown> = {
        status: "ok",
        registrationId,
        type: registrationType,
        duplicate,
        message: duplicate ? "Already registered" : "Registered successfully",
      };

      // Fire-and-forget email with ICS attachment (EmailService already skips in test env)
      try {
        const roleSnapshot: RoleSnapshot | undefined = (
          event.roles as unknown as RoleSnapshot[]
        ).find((r) => r.id === roleId);
        const ics = buildRegistrationICS({
          event: {
            _id: event._id,
            title: event.title,
            date: event.date,
            endDate: event.endDate,
            time: event.time,
            endTime: event.endTime,
            location: event.location,
            purpose: event.purpose,
            timeZone: event.timeZone,
          },
          role: roleSnapshot
            ? {
                name: roleSnapshot.name,
                description: roleSnapshot.description || "",
              }
            : null,
          attendeeEmail: attendee.email,
        });
        const { subject, html, text } =
          buildPublicRegistrationConfirmationEmail({
            event: {
              title: event.title,
              date: event.date,
              endDate: event.endDate,
              time: event.time,
              endTime: event.endTime,
              location: event.location,
              purpose: event.purpose || "",
              timeZone: event.timeZone || "",
              isHybrid: event.isHybrid,
              zoomLink: event.zoomLink,
              meetingId: event.meetingId,
              passcode: event.passcode,
              // include format for hybrid inference when isHybrid flag not set
              format: event.format,
            },
            roleName: roleSnapshot?.name,
            duplicate,
          });
        EmailService.sendEmail({
          to: attendee.email,
          subject,
          html,
          text,
          attachments: [
            {
              filename: ics.filename,
              content: ics.content,
              contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            },
          ],
        }).catch(() => undefined);
      } catch {
        /* ignore email build failures */
      }

      // Persist audit log (actorless public action)
      try {
        await AuditLog.create({
          action: "PublicRegistrationCreated",
          eventId: event._id,
          emailHash: attendee.email ? hashEmail(attendee.email) : null,
          metadata: {
            // Include eventId within metadata so tests querying metadata.eventId can locate this log
            eventId: event._id.toString(),
            roleId,
            registrationType,
            duplicate,
            capacityBefore,
            capacityAfter,
            requestId,
            ipCidr,
          },
        });
      } catch (auditErr) {
        log.warn(
          "Failed to persist audit log for public registration",
          undefined,
          {
            error: (auditErr as Error).message,
          }
        );
      }

      // Also structured application log for observability
      log.info("Public registration created", undefined, {
        eventId: event._id.toString(),
        roleId,
        registrationType,
        duplicate,
        capacityBefore,
        capacityAfter,
        emailHash: hashEmail(attendee.email!),
        requestId,
        ipCidr,
      });

      // Emit real-time socket update & invalidate caches only on non-duplicate success
      if (!duplicate) {
        try {
          const eventId = event._id.toString();
          const updatedEvent =
            await ResponseBuilderService.buildEventWithRegistrations(eventId);
          if (registrationType === "guest") {
            socketService.emitEventUpdate(eventId, "guest_registration", {
              eventId,
              roleId,
              guestName: attendee.name,
              event: updatedEvent,
              timestamp: new Date(),
            });
          } else if (registrationType === "user") {
            // Mirror payload contract from eventController user signup path
            const roleSnapshot: RoleSnapshot | undefined = (
              event.roles as unknown as RoleSnapshot[]
            ).find((r) => r.id === roleId);
            socketService.emitEventUpdate(eventId, "user_signed_up", {
              userId: registrationId, // userId not directly tracked here; frontend refetch will reconcile accurate roster
              roleId,
              roleName: roleSnapshot?.name,
              event: updatedEvent,
            });
          }
          await CachePatterns.invalidateEventCache(event._id.toString());
          await CachePatterns.invalidateAnalyticsCache();
        } catch (socketErr) {
          log.warn(
            "Failed to emit realtime update for public registration",
            undefined,
            {
              error: (socketErr as Error).message,
              eventId: event._id.toString(),
              roleId,
            }
          );
        }
      }

      res.status(200).json({ success: true, data: responsePayload });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Role at full capacity")
      ) {
        res
          .status(400)
          .json({ success: false, message: "Role is at full capacity" });
        try {
          registrationFailureCounter.inc({ reason: "capacity_full" });
        } catch {}
        return;
      }
      CorrelatedLogger.fromRequest(req, "PublicEventController").error(
        "register failed",
        err as Error
      );
      try {
        registrationFailureCounter.inc({ reason: "other" });
      } catch {}
      res.status(500).json({ success: false, message: "Failed to register" });
    }
  }
}

export default PublicEventController;
