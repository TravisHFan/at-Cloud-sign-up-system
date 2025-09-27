import { Request, Response } from "express";
import crypto from "crypto";
import Event from "../models/Event";
import User from "../models/User";
import Registration from "../models/Registration";
import GuestRegistration from "../models/GuestRegistration";
import { CapacityService } from "../services/CapacityService";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import { lockService } from "../services/LockService";
import { EmailService } from "../services/infrastructure/emailService";
import { buildRegistrationICS } from "../services/ICSBuilder";
import buildPublicRegistrationConfirmationEmail from "../services/emailTemplates/publicRegistrationConfirmation";
import AuditLog from "../models/AuditLog";

// Simple email hashing (lowercase then sha256) for audit/log style use.
export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

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
      const { slug } = req.params;
      const { roleId, attendee, consent }: PublicRegistrationBody =
        req.body || {};

      if (!slug) {
        res.status(400).json({ success: false, message: "Missing slug" });
        return;
      }
      if (!roleId) {
        res.status(400).json({ success: false, message: "roleId is required" });
        return;
      }
      if (!attendee?.name || !attendee?.email) {
        res.status(400).json({
          success: false,
          message: "attendee.name and attendee.email are required",
        });
        return;
      }
      if (!consent?.termsAccepted) {
        res
          .status(400)
          .json({ success: false, message: "termsAccepted must be true" });
        return;
      }

      const event = await Event.findOne({ publicSlug: slug, publish: true });
      if (!event) {
        res
          .status(404)
          .json({ success: false, message: "Public event not found" });
        return;
      }
      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Registration closed for this event",
        });
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
        res.status(400).json({ success: false, message: "Role not found" });
        return;
      }
      if (!targetRole.openToPublic) {
        res.status(400).json({
          success: false,
          message: "Role is not open to public registration",
        });
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

      res.status(200).json({ success: true, data: responsePayload });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Role at full capacity")
      ) {
        res
          .status(400)
          .json({ success: false, message: "Role is at full capacity" });
        return;
      }
      CorrelatedLogger.fromRequest(req, "PublicEventController").error(
        "register failed",
        err as Error
      );
      res.status(500).json({ success: false, message: "Failed to register" });
    }
  }
}

// Helper: Truncate IP to coarse CIDR for privacy (IPv4 /24, IPv6 /48). Returns null if not parseable.
function truncateIpToCidr(ip: string): string | null {
  if (!ip) return null;
  // Remove IPv6 prefix artifacts like '::ffff:' for IPv4-mapped addresses
  const v4Match = ip.match(/(?:(?:\d{1,3}\.){3}\d{1,3})/);
  if (v4Match) {
    const parts = v4Match[0].split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
  }
  // Simplistic IPv6 handling: take first 3 hextets (48 bits)
  if (ip.includes(":")) {
    const cleaned = ip.split("%")[0]; // drop interface suffix
    const hextets = cleaned.split(":").filter(Boolean);
    if (hextets.length >= 3) {
      return `${hextets[0]}:${hextets[1]}:${hextets[2]}::/48`;
    }
  }
  return null;
}

export default PublicEventController;
