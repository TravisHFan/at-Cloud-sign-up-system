import { Request, Response } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import Event from "../models/Event";
import User from "../models/User";
import Registration from "../models/Registration";
import GuestRegistration from "../models/GuestRegistration";
import { CapacityService } from "../services/CapacityService";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import { lockService } from "../services/LockService";
import { EmailService } from "../services/infrastructure/emailService";

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
        res
          .status(400)
          .json({
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
        res
          .status(400)
          .json({
            success: false,
            message: "Registration closed for this event",
          });
        return;
      }

      const targetRole = event.roles.find((r: any) => r.id === roleId);
      if (!targetRole) {
        res.status(400).json({ success: false, message: "Role not found" });
        return;
      }
      if (!targetRole.openToPublic) {
        res
          .status(400)
          .json({
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
          // Occupancy BEFORE
          const occBefore = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            roleId
          );
          capacityBefore = occBefore.total;
          if (CapacityService.isRoleFull(occBefore)) {
            throw new Error("Role at full capacity");
          }

          // at this point attendee.email is guaranteed (validated earlier)
          const existingUser = await User.findOne({
            email: attendee.email!.toLowerCase(),
          });
          if (existingUser) {
            // Check duplicate registration for user
            const existingReg = await Registration.findOne({
              eventId: event._id,
              userId: existingUser._id,
              roleId,
            });
            if (existingReg) {
              registrationId = existingReg._id.toString();
              registrationType = "user";
              duplicate = true;
              return;
            }
            // Double-check capacity under lock again (race: another user created registration)
            const occBeforeSave = await CapacityService.getRoleOccupancy(
              event._id.toString(),
              roleId
            );
            if (CapacityService.isRoleFull(occBeforeSave)) {
              throw new Error("Role at full capacity");
            }
            // Create user registration
            const roleSnapshot = targetRole; // embed snapshot
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
            // Guest path: idempotent by email+event
            let guest = await GuestRegistration.findOne({
              eventId: event._id,
              email: attendee.email!.toLowerCase(),
              status: "active",
            });
            if (guest) {
              registrationId = (guest as any)._id.toString();
              registrationType = "guest";
              duplicate = true;
              return;
            }
            const occBeforeGuest = await CapacityService.getRoleOccupancy(
              event._id.toString(),
              roleId
            );
            if (CapacityService.isRoleFull(occBeforeGuest)) {
              throw new Error("Role at full capacity");
            }
            guest = new GuestRegistration({
              eventId: event._id,
              roleId,
              fullName: attendee.name,
              gender: "male", // default; TODO: consider making gender optional or passed (simplified for initial public flow)
              email: attendee.email!.toLowerCase(),
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
            registrationId = (guest as any)._id.toString();
            registrationType = "guest";
          }

          // Recompute occupancy AFTER creation
          const occAfter = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            roleId
          );
          capacityAfter = occAfter.total;
          // Update event stats (signedUp / totalSlots)
          await event.save();
        },
        10000
      );

      // If capacity error inside lock
      if (!registrationId) {
        res
          .status(400)
          .json({
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

      // Fire-and-forget email (skip in test env via existing EmailService behavior)
      try {
        EmailService.sendEmail({
          to: attendee.email,
          subject: `Registration Confirmed: ${event.title}`,
          html: `<p>You are registered for ${event.title}.</p>`,
        }).catch(() => undefined);
      } catch {
        /* ignore */
      }

      // Basic inline (non-persistent) audit-like log (full AuditLog model can be integrated later)
      log.info("Public registration created", undefined, {
        eventId: event._id.toString(),
        roleId,
        registrationType,
        duplicate,
        capacityBefore,
        capacityAfter,
        emailHash: hashEmail(attendee.email!),
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

export default PublicEventController;
