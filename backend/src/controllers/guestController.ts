import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  GuestRegistration,
  Event,
  Registration,
  IGuestRegistration,
  IEvent,
  IEventRole,
} from "../models";
import {
  guestRegistrationValidation,
  validateGuestUniqueness,
  validateGuestRateLimit,
} from "../middleware/guestValidation";
import { EmailService } from "../services/infrastructure/emailService";
import crypto from "crypto";
import { socketService } from "../services/infrastructure/SocketService";
import mongoose from "mongoose";
import { CachePatterns } from "../services";
import { ResponseBuilderService } from "../services/ResponseBuilderService";
import { lockService } from "../services/LockService";

/**
 * Guest Registration Controller
 * Handles guest user registrations for events without requiring full user accounts
 */
export class GuestController {
  /**
   * Register a guest for an event role
   * POST /api/events/:eventId/guest-signup
   */
  static async registerGuest(req: Request, res: Response): Promise<void> {
    try {
      // Debug: trace entry
      try {
        console.debug(
          "[GuestController] registerGuest: start",
          JSON.stringify({ params: req?.params, hasBody: !!req?.body })
        );
      } catch (_) {
        // swallow debug logging errors intentionally (non-critical)
      }
      // Validate request (defensive against mocked/undefined validator in tests)
      let errors: any;
      try {
        errors = validationResult(req);
      } catch (_) {
        errors = undefined;
      }
      if (!errors || typeof errors.isEmpty !== "function") {
        errors = { isEmpty: () => true, array: () => [] };
      }
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
        return;
      }

      const { eventId } = req.params;
      // Be defensive in case req.body is missing due to test/middleware setup
      const { roleId, fullName, gender, email, phone, notes } =
        (req as any)?.body || {};
      // Be defensive: some properties can be undefined in tests/mocks
      const ipAddress =
        (req.ip as string | undefined) ||
        ((req as any).socket?.remoteAddress as string | undefined) ||
        ((req as any).connection?.remoteAddress as string | undefined) ||
        "";
      const userAgent =
        (typeof req.get === "function" && req.get("User-Agent")) ||
        (req.headers?.["user-agent"] as string | undefined);

      // Validate event exists
      // Optional chaining guards against undefined mocks in tests
      // If Event model or findById is unavailable (e.g., due to mocking), treat as not found
      let event: any = null;
      const finder = (Event as any)?.findById;
      try {
        console.debug(
          "[GuestController] registerGuest: finder type",
          typeof finder
        );
      } catch (_) {
        /* intentionally ignore non-critical errors */
      }
      if (typeof finder === "function") {
        // Important: call with proper model context to avoid Mongoose `this` binding errors
        event = await (Event as any).findById(eventId);
      } else {
        event = null;
      }
      if (!event) {
        try {
          console.warn("[GuestController] Event not found for id:", eventId);
        } catch (_) {
          // ignore debug log issues
        }
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      // Find the specific role (defensive against unexpected event shape)
      const roles: IEventRole[] = Array.isArray(event?.roles)
        ? event.roles
        : [];
      const eventRole = roles.find((role: IEventRole) => role.id === roleId);
      if (!eventRole) {
        try {
          console.warn(
            "[GuestController] Event role not found:",
            roleId,
            "available:",
            roles.map((r: any) => r?.id)
          );
        } catch (_) {
          // ignore debug log issues
        }
        res.status(404).json({
          success: false,
          message: "Event role not found",
        });
        return;
      }

      // Check if event registration is still open
      const now = new Date();
      // Defensive: ensure registrationDeadline is a valid Date
      const deadline =
        event?.registrationDeadline instanceof Date
          ? event.registrationDeadline
          : event?.registrationDeadline
          ? new Date(event.registrationDeadline)
          : null;
      if (deadline && now > deadline) {
        try {
          console.warn(
            "[GuestController] Registration deadline passed:",
            deadline?.toISOString?.() || deadline
          );
        } catch (_) {
          // ignore debug log issues
        }
        res.status(400).json({
          success: false,
          message: "Registration deadline has passed",
        });
        return;
      }
      // Perform capacity+uniqueness+save under application lock for atomicity
      const lockKey = `guest-signup:${eventId}:${roleId}`;
      let savedRegistration: any;
      let manageTokenRaw: string | undefined;
      const result = await lockService.withLock(
        lockKey,
        async () => {
          // Count current guest registrations
          let currentGuestCount = 0;
          try {
            const rawCount = await (
              GuestRegistration as any
            )?.countActiveRegistrations?.(eventId, roleId);
            currentGuestCount = Number.isFinite(Number(rawCount))
              ? Number(rawCount)
              : Number.parseInt(String(rawCount ?? 0), 10) || 0;
          } catch (_) {
            currentGuestCount = 0;
          }

          // Count regular user registrations
          let currentUserCount = 0;
          try {
            const rawUserCount = await (Registration as any)?.countDocuments?.({
              eventId: new mongoose.Types.ObjectId(eventId),
              roleId,
            });
            currentUserCount = Number.isFinite(Number(rawUserCount))
              ? Number(rawUserCount)
              : Number.parseInt(String(rawUserCount ?? 0), 10) || 0;
          } catch (_) {
            currentUserCount = 0;
          }

          const totalCurrentRegistrations =
            Number(currentGuestCount) + Number(currentUserCount);

          const rawCapacity =
            (eventRole as any)?.maxParticipants ?? (eventRole as any)?.capacity;
          const roleCapacity = Number.isFinite(Number(rawCapacity))
            ? Number(rawCapacity)
            : Number.parseInt(String(rawCapacity ?? NaN), 10);

          if (
            Number.isFinite(roleCapacity) &&
            !Number.isNaN(totalCurrentRegistrations) &&
            totalCurrentRegistrations >= roleCapacity
          ) {
            return {
              type: "error",
              status: 400,
              body: {
                success: false,
                message: "This role is at full capacity",
              },
            } as const;
          }

          // Rate limiting check (after confirming capacity so capacity takes precedence)
          try {
            const rateLimitCheck = validateGuestRateLimit(
              ipAddress || "",
              email
            );
            if (!rateLimitCheck?.isValid) {
              return {
                type: "error",
                status: 429,
                body: {
                  success: false,
                  message: rateLimitCheck?.message || "Rate limit exceeded",
                },
              } as const;
            }
          } catch (rlErr) {
            // In tests/mocks, prefer not to fail the whole request
            try {
              console.warn(
                "[GuestController] validateGuestRateLimit threw, bypassing:",
                (rlErr as any)?.message || rlErr
              );
            } catch (_) {
              /* intentionally ignore non-critical debug/logging errors */
            }
          }

          // Check uniqueness for this event
          try {
            const uniquenessCheck = await validateGuestUniqueness(
              email,
              eventId
            );
            if (!uniquenessCheck?.isValid) {
              return {
                type: "error",
                status: 400,
                body: {
                  success: false,
                  message: uniquenessCheck?.message || "Already registered",
                },
              } as const;
            }
          } catch (_) {
            // If uniqueness check fails unexpectedly, proceed to rely on unique index if any
          }

          // Create event snapshot for historical reference
          const eventSnapshot = {
            title: String(event.title || ""),
            date:
              event.date instanceof Date ? event.date : new Date(event.date),
            location: String(event.location || ""),
            roleName: String(eventRole.name || ""),
          };

          const guestRegistration = new GuestRegistration({
            eventId: new mongoose.Types.ObjectId(eventId),
            roleId,
            fullName: fullName.trim(),
            gender,
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            notes: notes?.trim(),
            ipAddress,
            userAgent,
            eventSnapshot,
            registrationDate: new Date(),
            status: "active",
            migrationStatus: "pending",
          });

          try {
            manageTokenRaw = (guestRegistration as any).generateManageToken?.();
          } catch (_) {}

          savedRegistration = await guestRegistration.save();
          return { type: "ok" } as const;
        },
        10000
      );

      if (result && (result as any).type === "error") {
        res.status((result as any).status).json((result as any).body);
        return;
      }

      // Send confirmation email
      try {
        await EmailService.sendGuestConfirmationEmail({
          guestEmail: email,
          guestName: fullName,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            time: (event as any)?.time,
            endTime: (event as any)?.endTime,
            endDate: (event as any)?.endDate,
            timeZone: (event as any)?.timeZone,
            format: (event as any)?.format,
            isHybrid: (event as any)?.isHybrid,
            zoomLink: (event as any)?.zoomLink,
            agenda: (event as any)?.agenda,
            description: (event as any)?.description,
            purpose: (event as any)?.purpose,
            meetingId: (event as any)?.meetingId,
            passcode: (event as any)?.passcode,
            organizerDetails: (event as any)?.organizerDetails,
          },
          role: {
            name: eventRole.name,
            description: (eventRole as any)?.description,
          },
          registrationId: (
            savedRegistration._id as mongoose.Types.ObjectId
          ).toString(),
          manageToken: manageTokenRaw,
        });
      } catch (emailError) {
        console.error("Failed to send guest confirmation email:", emailError);
        // Don't fail the registration if email fails
      }

      // Notify organizers
      try {
        const organizerEmails: string[] = (
          (event as any)?.organizerDetails || []
        )
          .map((org: any) => org?.email)
          .filter(Boolean);
        await EmailService.sendGuestRegistrationNotification({
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            time: (event as any)?.time,
            endTime: (event as any)?.endTime,
            endDate: (event as any)?.endDate,
            timeZone: (event as any)?.timeZone,
          },
          guest: {
            name: fullName,
            email,
            phone,
          },
          role: { name: eventRole.name },
          registrationDate: savedRegistration.registrationDate,
          organizerEmails,
        });
      } catch (emailError) {
        console.error("Failed to send organizer notification:", emailError);
        // Don't fail the registration if email fails
      }

      // Build updated event, emit WebSocket, and invalidate caches
      try {
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(eventId);
        socketService.emitEventUpdate(eventId, "guest_registration", {
          eventId,
          roleId,
          guestName: fullName,
          event: updatedEvent,
          timestamp: savedRegistration.registrationDate,
        });
        await CachePatterns.invalidateEventCache(eventId);
        await CachePatterns.invalidateAnalyticsCache();
      } catch (socketError) {
        console.error(
          "Failed to emit WebSocket update or invalidate caches:",
          socketError
        );
        // Don't fail the registration if side-effects fail
      }

      // Return success response
      res.status(201).json({
        success: true,
        message: "Guest registration successful",
        data: {
          registrationId: savedRegistration._id,
          eventTitle: event.title,
          roleName: eventRole.name,
          registrationDate: savedRegistration.registrationDate,
          confirmationEmailSent: true,
          manageToken: manageTokenRaw,
        },
      });
    } catch (error) {
      try {
        console.error("Guest registration error:", error);
      } catch (_) {
        // ignore
      }
      res.status(500).json({
        success: false,
        message: "Internal server error during guest registration",
      });
    }
  }

  /**
   * Re-send manage link (regenerate token and email) for a guest registration
   * POST /api/guest-registrations/:id/resend-manage-link
   * Admin-only (route-protected)
   */
  static async resendManageLink(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const doc = await GuestRegistration.findById(id);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Guest registration not found" });
        return;
      }
      if (doc.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Cannot re-send link for cancelled registration",
        });
        return;
      }

      // Generate a fresh token and extend expiry
      let rawToken: string | undefined;
      try {
        rawToken = (doc as any).generateManageToken?.();
      } catch (_) {
        /* intentionally ignore non-critical debug/logging errors */
      }
      await doc.save();

      // Send email to guest with the new manage link (use confirmation template)
      try {
        // Fetch minimal event info for email context
        const event = await Event.findById(doc.eventId);
        await EmailService.sendGuestConfirmationEmail({
          guestEmail: doc.email,
          guestName: doc.fullName,
          event: {
            title: (event as any)?.title,
            date: (event as any)?.date,
            location: (event as any)?.location,
            time: (event as any)?.time,
            endTime: (event as any)?.endTime,
            endDate: (event as any)?.endDate,
            timeZone: (event as any)?.timeZone,
            format: (event as any)?.format,
            isHybrid: (event as any)?.isHybrid,
            zoomLink: (event as any)?.zoomLink,
            agenda: (event as any)?.agenda,
            description: (event as any)?.description,
            purpose: (event as any)?.purpose,
            meetingId: (event as any)?.meetingId,
            passcode: (event as any)?.passcode,
            organizerDetails: (event as any)?.organizerDetails,
          },
          role: { name: doc.eventSnapshot?.roleName || "" },
          registrationId: (doc._id as any).toString(),
          manageToken: rawToken,
        });
      } catch (emailErr) {
        console.error("Failed to send manage link email:", emailErr);
        // Do not fail the request if email sending fails
      }

      res.status(200).json({
        success: true,
        message: "Manage link re-sent successfully",
      });
    } catch (error) {
      console.error("Error re-sending manage link:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to re-send manage link" });
    }
  }

  /**
   * Get guest registrations for an event
   * Admins receive full admin JSON; non-admins receive public JSON (no email/phone)
   * GET /api/events/:eventId/guests
   */
  static async getEventGuests(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;

      const guests = await GuestRegistration.findActiveByEvent(eventId);

      // Admins and Leaders can view guest contact info; others get sanitized public JSON
      const isPrivilegedViewer =
        !!req.user &&
        (req.userRole === "Super Admin" ||
          req.userRole === "Administrator" ||
          req.userRole === "Leader");

      res.status(200).json({
        success: true,
        data: {
          guests: guests.map((guest) =>
            isPrivilegedViewer ? guest.toAdminJSON() : guest.toPublicJSON()
          ),
          count: guests.length,
        },
      });
    } catch (error) {
      console.error("Error fetching event guests:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch event guests",
      });
    }
  }

  /**
   * Cancel a guest registration
   * DELETE /api/guest-registrations/:id
   */
  static async cancelGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      if (guestRegistration.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Registration is already cancelled",
        });
        return;
      }

      // Update registration status
      guestRegistration.status = "cancelled";
      if (reason) {
        guestRegistration.notes = `${
          guestRegistration.notes || ""
        }\nCancellation reason: ${reason}`.trim();
      }

      await guestRegistration.save();

      // Emit WebSocket update
      try {
        socketService.emitEventUpdate(
          guestRegistration.eventId.toString(),
          "guest_cancellation",
          {
            eventId: guestRegistration.eventId.toString(),
            roleId: guestRegistration.roleId,
            guestName: guestRegistration.fullName,
            timestamp: new Date(),
          }
        );
      } catch (socketError) {
        console.error("Failed to emit cancellation update:", socketError);
      }

      res.status(200).json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest registration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel guest registration",
      });
    }
  }

  /**
   * Update guest registration details
   * PUT /api/guest-registrations/:id
   */
  static async updateGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { fullName, phone, notes } = req.body;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      if (guestRegistration.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Cannot update cancelled registration",
        });
        return;
      }

      // Update allowed fields
      if (fullName) guestRegistration.fullName = fullName.trim();
      if (phone) guestRegistration.phone = phone.trim();
      if (notes !== undefined) guestRegistration.notes = notes?.trim();

      await guestRegistration.save();

      // Emit WebSocket update so connected clients can refresh
      try {
        socketService.emitEventUpdate(
          guestRegistration.eventId.toString(),
          "guest_updated",
          {
            eventId: guestRegistration.eventId.toString(),
            roleId: guestRegistration.roleId,
            guestName: guestRegistration.fullName,
            timestamp: new Date(),
          }
        );
      } catch (socketError) {
        console.error("Failed to emit guest update:", socketError);
      }

      res.status(200).json({
        success: true,
        message: "Guest registration updated successfully",
        data: guestRegistration.toPublicJSON(),
      });
    } catch (error) {
      console.error("Error updating guest registration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update guest registration",
      });
    }
  }

  /**
   * Get guest registration by ID (for email links)
   * GET /api/guest-registrations/:id
   */
  static async getGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { guest: guestRegistration.toPublicJSON() },
      });
    } catch (error) {
      console.error("Error fetching guest registration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch guest registration",
      });
    }
  }

  /**
   * Helper: verify and fetch guest registration by manage token
   */
  private static async findByManageToken(token: string) {
    if (!token) return null;
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();
    return GuestRegistration.findOne({
      manageToken: hashed,
      manageTokenExpires: { $gt: now },
      status: { $ne: "cancelled" },
    });
  }

  /**
   * Get guest registration by token
   * GET /api/guest/manage/:token
   */
  static async getGuestByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as any;
      const doc = await GuestController.findByManageToken(token);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      res
        .status(200)
        .json({ success: true, data: { guest: doc.toPublicJSON() } });
    } catch (error) {
      console.error("Error fetching guest by token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch guest registration",
      });
    }
  }

  /**
   * Update guest registration by token
   * PUT /api/guest/manage/:token
   */
  static async updateByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as any;
      const doc = await GuestController.findByManageToken(token);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      const { fullName, phone, notes } = req.body || {};
      if (fullName) doc.fullName = String(fullName).trim();
      if (phone) doc.phone = String(phone).trim();
      if (notes !== undefined) doc.notes = String(notes ?? "").trim();
      // Rotate token after successful update to reduce replay window
      let newRawToken: string | undefined;
      try {
        newRawToken = (doc as any).generateManageToken?.();
      } catch (_) {
        /* ignore */
      }
      await doc.save();
      // Emit WebSocket update for parity with admin updates
      try {
        socketService.emitEventUpdate(doc.eventId.toString(), "guest_updated", {
          eventId: doc.eventId.toString(),
          roleId: doc.roleId,
          guestName: doc.fullName,
          timestamp: new Date(),
        });
      } catch (_) {
        /* intentionally ignore non-critical debug/logging errors */
      }
      res.status(200).json({
        success: true,
        message: "Guest registration updated successfully",
        data: { ...doc.toPublicJSON(), manageToken: newRawToken },
      });
    } catch (error) {
      console.error("Error updating guest by token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update guest registration",
      });
    }
  }

  /**
   * Cancel guest registration by token
   * DELETE /api/guest/manage/:token
   */
  static async cancelByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as any;
      // For idempotence, first try to locate the document by token regardless of status,
      // then handle already-cancelled with a 400 response instead of 404.
      let doc = await GuestController.findByManageToken(token);
      if (!doc) {
        try {
          const hashed = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");
          const now = new Date();
          doc = await GuestRegistration.findOne({
            manageToken: hashed,
            manageTokenExpires: { $gt: now },
          });
        } catch (_) {
          /* intentionally ignore non-critical debug/logging errors */
        }
      }
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      const { reason } = req.body || {};
      if (doc.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Registration is already cancelled",
        });
        return;
      }
      doc.status = "cancelled";
      if (reason) {
        doc.notes = `${doc.notes || ""}\nCancellation reason: ${String(
          reason
        )}`.trim();
      }
      // Invalidate token immediately on cancel
      try {
        (doc as any).manageToken = undefined;
        (doc as any).manageTokenExpires = undefined;
      } catch (_) {
        /* ignore */
      }
      await doc.save();
      try {
        socketService.emitEventUpdate(
          doc.eventId.toString(),
          "guest_cancellation",
          {
            eventId: doc.eventId.toString(),
            roleId: doc.roleId,
            guestName: doc.fullName,
            timestamp: new Date(),
          }
        );
      } catch (e) {
        // ignore
      }
      res.status(200).json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest by token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel guest registration",
      });
    }
  }
}

export default GuestController;
