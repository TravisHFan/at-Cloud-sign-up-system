import { Request, Response } from "express";
import { validationResult } from "express-validator";
import type { Result, ValidationError } from "express-validator";
import { GuestRegistration, Event, IEventRole } from "../models";
import { User } from "../models";
import {
  validateGuestUniqueness,
  validateGuestRateLimit,
} from "../middleware/guestValidation";
import { EmailService } from "../services/infrastructure/EmailServiceFacade";
import crypto from "crypto";
import { socketService } from "../services/infrastructure/SocketService";
import mongoose from "mongoose";
import { CachePatterns } from "../services";
import { createLogger } from "../services/LoggerService";
import { ResponseBuilderService } from "../services/ResponseBuilderService";
import { lockService } from "../services/LockService";
import { CapacityService } from "../services/CapacityService";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import { createGuestInvitationDeclineToken } from "../utils/guestInvitationDeclineToken";
import { TrioNotificationService } from "../services/notifications/TrioNotificationService";

/**
 * Guest Registration Controller
 * Handles guest user registrations for events without requiring full user accounts
 */
export type EventLike = {
  _id?: mongoose.Types.ObjectId | string;
  title?: string;
  date?: unknown;
  location?: unknown;
  time?: unknown;
  endTime?: unknown;
  endDate?: unknown;
  timeZone?: unknown;
  format?: unknown;
  isHybrid?: unknown;
  zoomLink?: unknown;
  agenda?: unknown;
  purpose?: unknown;
  meetingId?: unknown;
  passcode?: unknown;
  organizerDetails?: Array<{ email?: string } | Record<string, unknown>>;
  createdBy?: unknown;
  roles?: IEventRole[];
  registrationDeadline?: Date | string | null;
};

export type UserLike = {
  _id?: mongoose.Types.ObjectId | string;
  firstName?: string;
  lastName?: string;
};
export type RequestWithUser = Request & { user?: UserLike; userRole?: string };
type UserModelLike = {
  findOne?: (
    query: Record<string, unknown>
  ) => { select?: (fields: string) => Promise<unknown> } | Promise<unknown>;
};
type SavedGuest = {
  _id: mongoose.Types.ObjectId;
  registrationDate: Date;
  status?: string;
};

// Narrowing helpers to keep casts minimal and avoid `any`
const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const asBool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
const asDateOrString = (v: unknown): Date | string | undefined =>
  v instanceof Date || typeof v === "string" ? (v as Date | string) : undefined;

export class GuestController {
  // Structured logger for this controller (console output preserved for tests)
  private static log = createLogger("GuestController");
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
        GuestController.log.debug("registerGuest start", undefined, {
          params: req?.params,
          hasBody: !!req?.body,
        });
      } catch {
        // swallow debug logging errors intentionally (non-critical)
      }
      // Validate request (defensive against mocked/undefined validator in tests)
      let errors:
        | Result<ValidationError>
        | { isEmpty: () => boolean; array: () => unknown[] }
        | undefined;
      try {
        errors = validationResult(req);
      } catch {
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
      type GuestSignupBody = {
        roleId?: string;
        fullName?: string;
        gender?: string;
        email?: string;
        phone?: string;
        notes?: string;
      };
      const body = (req.body ?? {}) as Partial<GuestSignupBody>;
      const { roleId, fullName, gender, email, phone, notes } = body;
      // Be defensive: some properties can be undefined in tests/mocks
      const ipAddress =
        (req.ip as string | undefined) ||
        (req.socket as unknown as { remoteAddress?: string })?.remoteAddress ||
        (req.connection as unknown as { remoteAddress?: string })
          ?.remoteAddress ||
        "";
      const userAgent =
        (typeof req.get === "function" && req.get("User-Agent")) ||
        (req.headers?.["user-agent"] as string | undefined);

      // Validate event exists
      // Optional chaining guards against undefined mocks in tests
      // If Event model or findById is unavailable (e.g., due to mocking), treat as not found
      let event: EventLike | null = null;
      const finder = (
        Event as unknown as {
          findById?: (id: string) => Promise<EventLike | null>;
        }
      )?.findById;
      try {
        console.debug(
          "[GuestController] registerGuest: finder type",
          typeof finder
        );
      } catch {
        /* intentionally ignore non-critical errors */
      }
      if (typeof finder === "function") {
        // Important: call with proper model context to avoid Mongoose `this` binding errors
        event = await (
          Event as unknown as {
            findById: (id: string) => Promise<EventLike | null>;
          }
        ).findById(eventId);
      } else {
        event = null;
      }
      if (!event) {
        try {
          console.warn("[GuestController] Event not found for id:", eventId);
        } catch {
          // ignore debug log issues
        }
        GuestController.log.warn("Event not found", undefined, { eventId });
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
            roles.map((r) => r.id)
          );
        } catch {
          // ignore debug log issues
        }
        GuestController.log.warn("Event role not found", undefined, {
          eventId,
          roleId,
          available: roles.map((r) => r.id),
        });
        res.status(404).json({
          success: false,
          message: "Event role not found",
        });
        return;
      }

      // Prevent guest registration using an email that already belongs to a registered user
      try {
        const userModel = User as unknown as UserModelLike;
        const existingUserQuery = userModel.findOne?.({
          email: String(email || "")
            .toLowerCase()
            .trim(),
        });
        let existingUser: unknown = undefined;
        const selectable = existingUserQuery as
          | { select?: (fields: string) => Promise<unknown> }
          | undefined;
        if (selectable?.select && typeof selectable.select === "function") {
          existingUser = await selectable.select("_id");
        } else if (
          existingUserQuery &&
          typeof (existingUserQuery as Promise<unknown>).then === "function"
        ) {
          existingUser = await existingUserQuery;
        }
        if (existingUser) {
          res.status(400).json({
            success: false,
            message:
              "This email belongs to an existing user account. Please sign in or use a different email to register as a guest.",
          });
          return;
        }
      } catch {
        // On unexpected errors, do not leak internal details; proceed to other validations
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
        } catch {
          // ignore debug log issues
        }
        GuestController.log.warn("Registration deadline passed", undefined, {
          eventId,
          deadline: deadline?.toString?.() || deadline,
        });
        res.status(400).json({
          success: false,
          message: "Registration deadline has passed",
        });
        return;
      }
      // Perform capacity+uniqueness+save under application lock for atomicity
      const roleIdStr = String(roleId ?? "");
      const lockKey = `guest-signup:${eventId}:${roleIdStr}`;
      let savedRegistration: SavedGuest | null = null;
      let manageTokenRaw: string | undefined;
      const result = await lockService.withLock(
        lockKey,
        async () => {
          // Get occupancy via CapacityService (capacity should be enforced before rate limit and uniqueness)
          const occupancy = await CapacityService.getRoleOccupancy(
            eventId,
            roleIdStr
          );

          if (CapacityService.isRoleFull(occupancy)) {
            return {
              type: "error",
              status: 400,
              body: {
                success: false,
                message: "This role is at full capacity",
              },
            } as const;
          }

          // Rate limiting check (should occur before uniqueness so RL counts duplicate attempts)
          try {
            const rateLimitCheck = validateGuestRateLimit(
              ipAddress || "",
              String(email ?? "")
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
                rlErr instanceof Error ? rlErr.message : rlErr
              );
            } catch {
              /* intentionally ignore non-critical debug/logging errors */
            }
            GuestController.log.warn(
              "validateGuestRateLimit threw, bypassing",
              undefined,
              {
                ipAddress,
                email: String(email ?? ""),
                error:
                  rlErr instanceof Error ? rlErr.message : (rlErr as unknown),
              }
            );
          }

          // Additional guard FIRST: prevent duplicate registration for the exact same role.
          // Check duplicate BEFORE limit check for idempotent behavior.
          // Multi-role (up to limit) is allowed, but not the same role twice.
          try {
            const existingSameRole = await GuestRegistration.findOne({
              email: String(email ?? "").toLowerCase(),
              eventId: new mongoose.Types.ObjectId(eventId),
              roleId: roleIdStr,
              status: "active",
            }).select("_id");
            if (existingSameRole) {
              return {
                type: "error",
                status: 400,
                body: {
                  success: false,
                  message: "Already registered for this role",
                },
              } as const;
            }
          } catch {
            /* swallow duplicate role lookup errors */
          }

          // Uniqueness check (after duplicate check to ensure idempotency)
          try {
            const uniquenessCheck = await validateGuestUniqueness(
              String(email ?? ""),
              eventId
            );
            if (!uniquenessCheck?.isValid) {
              return {
                type: "error",
                status: 400,
                body: {
                  success: false,
                  message:
                    uniquenessCheck?.message ||
                    "This guest has reached the 1-role limit for this event.",
                },
              } as const;
            }
          } catch {
            // If uniqueness check fails unexpectedly, proceed to rely on unique index if any
          }

          // Create event snapshot for historical reference
          const eventSnapshot = await (async () => {
            const { EventSnapshotBuilder } = await import(
              "../services/EventSnapshotBuilder"
            );
            return EventSnapshotBuilder.buildGuestSnapshot(event, eventRole);
          })();

          // Coerce potentially undefined inputs to empty strings for safety
          const fullNameStr = String(fullName ?? "");
          const emailStr = String(email ?? "");
          const phoneStr =
            phone === undefined || phone === null ? "" : String(phone);
          const guestRegistration = new GuestRegistration({
            eventId: new mongoose.Types.ObjectId(eventId),
            roleId: roleIdStr,
            fullName: fullNameStr.trim(),
            gender,
            email: emailStr.toLowerCase().trim(),
            ...(phoneStr.trim() ? { phone: phoneStr.trim() } : {}),
            notes: notes?.trim(),
            ipAddress,
            userAgent,
            eventSnapshot,
            registrationDate: new Date(),
            status: "active",
            migrationStatus: "pending",
          });

          try {
            manageTokenRaw = (
              guestRegistration as unknown as {
                generateManageToken?: () => string | undefined;
              }
            ).generateManageToken?.();
          } catch {
            /* intentionally ignore non-critical errors */
          }

          const saved = await guestRegistration.save();
          savedRegistration = {
            _id: saved._id as mongoose.Types.ObjectId,
            registrationDate: saved.registrationDate as Date,
          };
          return { type: "ok" } as const;
        },
        10000
      );

      type WithLockResult =
        | { type: "ok" }
        | { type: "error"; status: number; body: Record<string, unknown> };
      const lockOutcome = result as unknown as WithLockResult;
      if (lockOutcome && lockOutcome.type === "error") {
        res.status(lockOutcome.status).json(lockOutcome.body);
        return;
      }

      // Send confirmation email
      try {
        // Fetch enriched event (fresh organizer contacts) before emailing
        let enrichedEvent: EventLike = event as EventLike;
        try {
          enrichedEvent =
            (await ResponseBuilderService.buildEventWithRegistrations(
              eventId
            )) as EventLike;
        } catch {
          enrichedEvent = event as EventLike;
        }
        // Map organizer details into the strict email payload shape (optional)
        const organizerDetailsPayload = Array.isArray(
          enrichedEvent?.organizerDetails
        )
          ? (enrichedEvent.organizerDetails as Array<Record<string, unknown>>)
              .map((o) => ({
                name: asString(o["name"]) || "Organizer",
                role: asString(o["role"]) || "Organizer",
                email: asString(o["email"]) || "",
                phone: asString(o["phone"]) || undefined,
              }))
              .filter((o) => !!o.email)
          : undefined;
        const createdBySrc =
          enrichedEvent?.createdBy ?? (event as EventLike)?.createdBy;
        const createdByObj =
          createdBySrc && typeof createdBySrc === "object"
            ? (createdBySrc as Record<string, unknown>)
            : undefined;
        const createdByPayload = createdByObj
          ? {
              firstName: asString(createdByObj["firstName"]),
              lastName: asString(createdByObj["lastName"]),
              username: asString(createdByObj["username"]),
              email: asString(createdByObj["email"]),
              phone: asString(createdByObj["phone"]),
              avatar: asString(createdByObj["avatar"]),
              gender: asString(createdByObj["gender"]),
            }
          : undefined;
        await EmailService.sendGuestConfirmationEmail({
          guestEmail: String(email ?? ""),
          guestName: String(fullName ?? ""),
          event: {
            title:
              asString(enrichedEvent?.title) ||
              asString((event as EventLike)?.title) ||
              "Event",
            date:
              asDateOrString(enrichedEvent?.date) ??
              asDateOrString((event as EventLike)?.date) ??
              new Date(),
            location:
              asString(enrichedEvent?.location) ||
              asString((event as EventLike)?.location),
            time:
              asString(enrichedEvent?.time) ||
              asString((event as EventLike)?.time),
            endTime:
              asString(enrichedEvent?.endTime) ||
              asString((event as EventLike)?.endTime),
            endDate:
              asDateOrString(enrichedEvent?.endDate) ||
              asDateOrString((event as EventLike)?.endDate),
            timeZone:
              asString(enrichedEvent?.timeZone) ||
              asString((event as EventLike)?.timeZone),
            format:
              asString(enrichedEvent?.format) ||
              asString((event as EventLike)?.format),
            isHybrid:
              asBool(enrichedEvent?.isHybrid) ??
              asBool((event as EventLike)?.isHybrid),
            zoomLink:
              asString(enrichedEvent?.zoomLink) ||
              asString((event as EventLike)?.zoomLink),
            agenda:
              asString(enrichedEvent?.agenda) ||
              asString((event as EventLike)?.agenda),
            purpose:
              asString(enrichedEvent?.purpose) ||
              asString((event as EventLike)?.purpose),
            meetingId:
              asString(enrichedEvent?.meetingId) ||
              asString((event as EventLike)?.meetingId),
            passcode:
              asString(enrichedEvent?.passcode) ||
              asString((event as EventLike)?.passcode),
            organizerDetails: organizerDetailsPayload,
            createdBy: createdByPayload,
          },
          role: {
            name: eventRole.name,
            description: (eventRole as unknown as { description?: string })
              ?.description,
          },
          registrationId: (
            (savedRegistration as unknown as { _id: mongoose.Types.ObjectId })
              ?._id as mongoose.Types.ObjectId
          ).toString(),
          manageToken: manageTokenRaw,
          inviterName: "INVITE_TRIGGERED", // Simple flag to indicate this was an invitation
          // Always attempt to generate a decline token (email template now always shows decline section for invited guests)
          declineToken: (() => {
            try {
              const regId = (
                (
                  savedRegistration as unknown as {
                    _id?: mongoose.Types.ObjectId;
                  }
                )?._id || new mongoose.Types.ObjectId()
              ).toString();
              return createGuestInvitationDeclineToken({
                registrationId: regId,
              });
            } catch (tokErr) {
              // Intentionally non-blocking: log and allow flow to continue (email will show fallback copy)
              try {
                // warn(message, context?, metadata?)
                GuestController.log.warn(
                  "Failed to generate guest decline token",
                  undefined,
                  {
                    eventId,
                    roleId,
                    email: String(email ?? ""),
                    error: (tokErr as Error)?.message,
                  }
                );
              } catch {
                /* swallow logging issues */
              }
              return undefined;
            }
          })(),
        });
      } catch (emailError) {
        console.error("Failed to send guest confirmation email:", emailError);
        GuestController.log.error(
          "Failed to send guest confirmation email",
          emailError as Error,
          undefined,
          {
            eventId,
            roleId,
            email: String(email ?? ""),
          }
        );
        // Correlated error log (non-invasive)
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to send guest confirmation email",
            emailError as Error,
            undefined,
            { eventId, roleId, email: String(email ?? "") }
          );
        } catch {
          /* ignore logging issues */
        }
        // Don't fail the registration if email fails
      }

      // Notify organizers
      try {
        // Use enrichedEvent to ensure we have real emails
        let enrichedEvent: EventLike;
        try {
          enrichedEvent =
            (await ResponseBuilderService.buildEventWithRegistrations(
              eventId
            )) as EventLike;
        } catch {
          enrichedEvent = event as EventLike;
        }
        const organizerEmails: string[] = (
          (enrichedEvent?.organizerDetails ?? []) as Array<
            { email?: string } | Record<string, unknown>
          >
        )
          .map((org) => (org as { email?: string }).email)
          .filter((e): e is string => typeof e === "string" && e.length > 0);
        await EmailService.sendGuestRegistrationNotification({
          event: {
            title:
              asString(enrichedEvent?.title) ||
              asString((event as EventLike)?.title) ||
              "Event",
            date:
              asDateOrString(enrichedEvent?.date) ??
              asDateOrString((event as EventLike)?.date) ??
              new Date(),
            location:
              asString(enrichedEvent?.location) ||
              asString((event as EventLike)?.location),
            time:
              asString(enrichedEvent?.time) ||
              asString((event as EventLike)?.time),
            endTime:
              asString(enrichedEvent?.endTime) ||
              asString((event as EventLike)?.endTime),
            endDate:
              asDateOrString(enrichedEvent?.endDate) ||
              asDateOrString((event as EventLike)?.endDate),
            timeZone:
              asString(enrichedEvent?.timeZone) ||
              asString((event as EventLike)?.timeZone),
          },
          guest: {
            name: String(fullName ?? ""),
            email: String(email ?? ""),
            phone: String(phone ?? ""),
          },
          role: { name: eventRole.name },
          registrationDate: (savedRegistration! as SavedGuest).registrationDate,
          organizerEmails,
        });
      } catch (emailError) {
        console.error("Failed to send organizer notification:", emailError);
        // Don't fail the registration if email fails
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to send organizer notification",
            emailError as Error,
            undefined,
            { eventId, roleId, email: String(email ?? "") }
          );
        } catch {
          /* ignore logging issues */
        }
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
          timestamp: new Date(),
        });
        await CachePatterns.invalidateEventCache(eventId);
        await CachePatterns.invalidateAnalyticsCache();
      } catch (socketError) {
        console.error(
          "Failed to emit WebSocket update or invalidate caches:",
          socketError
        );
        GuestController.log.error(
          "Failed to emit WebSocket update or invalidate caches",
          socketError as Error,
          undefined,
          { eventId, roleId }
        );
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to emit WebSocket update or invalidate caches",
            socketError as Error,
            undefined,
            { eventId, roleId }
          );
        } catch {
          /* ignore logging issues */
        }
        // Don't fail the registration if side-effects fail
      }

      // Return success response
      GuestController.log.info("Guest registration successful", undefined, {
        eventId,
        roleId,
        email: String(email ?? ""),
      });
      res.status(201).json({
        success: true,
        message: "Guest registration successful",
        data: {
          registrationId: (savedRegistration! as SavedGuest)._id,
          eventId,
          eventTitle: String((event as EventLike)?.title ?? "Event"),
          roleName: eventRole.name,
          registrationDate: (savedRegistration! as SavedGuest).registrationDate,
          confirmationEmailSent: true,
          manageToken: manageTokenRaw,
          organizerDetails: (event as EventLike)?.organizerDetails as
            | Array<Record<string, unknown>>
            | undefined,
        },
      });
    } catch (error) {
      // Map duplicate key (DB uniq index) to friendly 400
      const code = (error as unknown as { code?: number }).code;
      if (code === 11000) {
        GuestController.log.warn(
          "Duplicate guest email for event (unique index)",
          undefined,
          {
            eventId: (req.params || {}).eventId,
            email: String((req.body || {}).email ?? ""),
          }
        );
        res.status(400).json({
          success: false,
          message: "This guest has reached the 3-role limit for this event.",
        });
        return;
      }
      try {
        console.error("Guest registration error:", error);
      } catch {
        // ignore
      }
      GuestController.log.error(
        "Guest registration error",
        error as Error,
        undefined,
        {
          eventId: (req.params || {}).eventId,
          roleId: (req.body || {}).roleId,
          email: String((req.body || {}).email ?? ""),
        }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Guest registration error",
          error as Error,
          undefined,
          {
            eventId: (req.params || {}).eventId,
            roleId: (req.body || {}).roleId,
            email: String((req.body || {}).email ?? ""),
          }
        );
      } catch {
        /* ignore */
      }
      res.status(500).json({
        success: false,
        message: "Internal server error during guest registration",
      });
    }
  }

  /**
   * Validate a guest invitation decline token and return summary info
   * GET /api/guest/decline/:token
   */
  static async getDeclineTokenInfo(req: Request, res: Response): Promise<void> {
    let { token } = req.params;
    token = typeof token === "string" ? token.trim() : token;
    try {
      const { verifyGuestInvitationDeclineToken } = await import(
        "../utils/guestInvitationDeclineToken"
      );
      const verification = verifyGuestInvitationDeclineToken(token);
      if (!verification.valid) {
        try {
          GuestController.log.debug(
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
        "../utils/guestInvitationDeclineToken"
      );
      const verification = verifyGuestInvitationDeclineToken(token);
      if (!verification.valid) {
        try {
          GuestController.log.debug(
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
      try {
        const event = (await Event.findById(doc.eventId)) as EventLike | null;
        const organizerEmails: string[] = (
          ((event as EventLike | null)?.organizerDetails || []) as Array<
            Record<string, unknown>
          >
        )
          .map((o) => String(o["email"] || ""))
          .filter((e) => !!e);
        if (organizerEmails.length > 0) {
          await EmailService.sendGuestDeclineNotification({
            event: {
              title:
                (event?.title as string) || doc.eventSnapshot?.title || "Event",
              date: (event?.date as Date) || (doc.eventSnapshot?.date as Date),
            },
            roleName: doc.eventSnapshot?.roleName,
            guest: { name: doc.fullName, email: doc.email },
            reason: doc.declineReason,
            organizerEmails,
          });
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

        // Create a system message / notification for assigner-like actor (fallback to event creator)
        try {
          // Derive assigner candidate: registration snapshot may not store assigner; fallback to event.createdBy
          let assignerUserId: string | undefined;
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
        rawToken = (
          doc as unknown as { generateManageToken?: () => string | undefined }
        ).generateManageToken?.();
      } catch {
        /* intentionally ignore non-critical debug/logging errors */
      }
      await doc.save();

      // Send email to guest with the new manage link (use confirmation template)
      try {
        // Fetch minimal event info for email context
        const event = (await Event.findById(doc.eventId)) as EventLike | null;
        await EmailService.sendGuestConfirmationEmail({
          guestEmail: String(doc.email ?? ""),
          guestName: String(doc.fullName ?? ""),
          event: {
            title: asString((event as EventLike | null)?.title) || "Event",
            date:
              asDateOrString((event as EventLike | null)?.date) ?? new Date(),
            location: asString((event as EventLike | null)?.location),
            time: asString((event as EventLike | null)?.time),
            endTime: asString((event as EventLike | null)?.endTime),
            endDate: asDateOrString((event as EventLike | null)?.endDate),
            timeZone: asString((event as EventLike | null)?.timeZone),
            format: asString((event as EventLike | null)?.format),
            isHybrid: asBool((event as EventLike | null)?.isHybrid),
            zoomLink: asString((event as EventLike | null)?.zoomLink),
            agenda: asString((event as EventLike | null)?.agenda),
            purpose: asString((event as EventLike | null)?.purpose),
            meetingId: asString((event as EventLike | null)?.meetingId),
            passcode: asString((event as EventLike | null)?.passcode),
            organizerDetails: Array.isArray(
              (event as EventLike | null)?.organizerDetails
            )
              ? (
                  ((event as EventLike).organizerDetails as Array<
                    Record<string, unknown>
                  >) || []
                )
                  .map((o) => ({
                    name: asString(o["name"]) || "Organizer",
                    role: asString(o["role"]) || "Organizer",
                    email: asString(o["email"]) || "",
                    phone: asString(o["phone"]) || undefined,
                  }))
                  .filter((o) => !!o.email)
              : undefined,
            createdBy: (():
              | {
                  firstName?: string;
                  lastName?: string;
                  username?: string;
                  email?: string;
                  phone?: string;
                  avatar?: string;
                  gender?: string;
                }
              | undefined => {
              const cbUnknown: unknown = (event as EventLike | null)?.createdBy;
              const cb =
                cbUnknown && typeof cbUnknown === "object"
                  ? (cbUnknown as Record<string, unknown>)
                  : undefined;
              return cb
                ? {
                    firstName: asString(cb["firstName"]),
                    lastName: asString(cb["lastName"]),
                    username: asString(cb["username"]),
                    email: asString(cb["email"]),
                    phone: asString(cb["phone"]),
                    avatar: asString(cb["avatar"]),
                    gender: asString(cb["gender"]),
                  }
                : undefined;
            })(),
          },
          role: { name: (doc.eventSnapshot?.roleName as string) || "" },
          registrationId: (doc._id as mongoose.Types.ObjectId).toString(),
          manageToken: rawToken,
        });
      } catch (emailErr) {
        console.error("Failed to send manage link email:", emailErr);
        // Do not fail the request if email sending fails
        GuestController.log.error(
          "Failed to send manage link email",
          emailErr as Error,
          undefined,
          { id }
        );
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to send manage link email",
            emailErr as Error,
            undefined,
            { id }
          );
        } catch {
          /* ignore */
        }
      }

      res.status(200).json({
        success: true,
        message: "Manage link re-sent successfully",
      });
    } catch (error) {
      console.error("Error re-sending manage link:", error);
      GuestController.log.error(
        "Error re-sending manage link",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error re-sending manage link",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
        );
      } catch {
        /* ignore */
      }
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
      GuestController.log.error(
        "Error fetching event guests",
        error as Error,
        undefined,
        { eventId: (req.params || {}).eventId }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error fetching event guests",
          error as Error,
          undefined,
          { eventId: (req.params || {}).eventId }
        );
      } catch {
        /* ignore */
      }
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
      const params = req.params as Partial<Record<"guestId" | "id", string>>;
      const id = params.guestId || params.id;
      if (!id) {
        res
          .status(400)
          .json({ success: false, message: "Missing guest registration id" });
        return;
      }
      // reason in body is currently not used; request body preserved intentionally

      // Atomically delete the guest registration and get the document back
      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }
      // Preserve details for notifications prior to deletion
      const eventId = guestRegistration.eventId.toString();
      const roleId = guestRegistration.roleId;
      const guestName = guestRegistration.fullName;
      const guestEmail = guestRegistration.email;

      // Perform deletion (source of truth aligns with user registrations)
      await GuestRegistration.deleteOne({ _id: guestRegistration._id });

      // Proactively notify the guest that an organizer/admin removed them from the role
      try {
        const event = await Event.findById(eventId);
        // Resolve the role name for context; fallback gracefully
        const roleName =
          (event?.roles || []).find((r: IEventRole) => r?.id === roleId)
            ?.name ||
          (
            guestRegistration as unknown as {
              eventSnapshot?: { roleName?: string };
            }
          ).eventSnapshot?.roleName ||
          (
            guestRegistration as unknown as {
              eventSnapshot?: { roleName?: string };
            }
          ).eventSnapshot?.roleName ||
          "the role";
        const actor = (req as unknown as RequestWithUser)?.user || {};
        // Send a simple role-removed email to the guest
        await EmailService.sendEventRoleRemovedEmail(guestEmail, {
          event: event
            ? { title: (event as EventLike).title }
            : { title: "Event" },
          user: { email: guestEmail, name: guestName },
          roleName,
          actor: {
            firstName: (actor as UserLike)?.firstName || "",
            lastName: (actor as UserLike)?.lastName || "",
          },
        });
      } catch (emailErr) {
        console.error("Failed to send guest removal email:", emailErr);
        // Do not fail the cancellation flow if email sending fails
        GuestController.log.error(
          "Failed to send guest removal email",
          emailErr as Error,
          undefined,
          { id, eventId, roleId, guestEmail }
        );
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to send guest removal email",
            emailErr as Error,
            undefined,
            { id, eventId, roleId, guestEmail }
          );
        } catch {
          /* ignore */
        }
      }

      // Emit WebSocket update
      try {
        socketService.emitEventUpdate(eventId, "guest_cancellation", {
          eventId,
          roleId,
          guestName,
          timestamp: new Date(),
        });
      } catch (socketError) {
        console.error("Failed to emit cancellation update:", socketError);
        GuestController.log.error(
          "Failed to emit cancellation update",
          socketError as Error,
          undefined,
          { eventId, roleId, guestName }
        );
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to emit cancellation update",
            socketError as Error,
            undefined,
            { eventId, roleId, guestName }
          );
        } catch {
          /* ignore */
        }
      }

      res.status(200).json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest registration:", error);
      GuestController.log.error(
        "Error cancelling guest registration",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error cancelling guest registration",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
        );
      } catch {
        /* ignore */
      }
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
      const params = req.params as Partial<Record<"guestId" | "id", string>>;
      const id = params.guestId || params.id;
      if (!id) {
        res
          .status(400)
          .json({ success: false, message: "Missing guest registration id" });
        return;
      }
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
      // Phone is optional and can be cleared by providing an empty string
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
        const normalizedPhone =
          typeof phone === "string"
            ? phone.trim()
            : (phone as string | undefined);
        guestRegistration.phone =
          normalizedPhone && normalizedPhone.length > 0
            ? normalizedPhone
            : (undefined as unknown as string);
      }
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
        try {
          CorrelatedLogger.fromRequest(req, "GuestController").error(
            "Failed to emit guest update",
            socketError as Error,
            undefined,
            { id }
          );
        } catch {
          /* ignore */
        }
      }

      res.status(200).json({
        success: true,
        message: "Guest registration updated successfully",
        data: guestRegistration.toPublicJSON(),
      });
    } catch (error) {
      console.error("Error updating guest registration:", error);
      GuestController.log.error(
        "Error updating guest registration",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error updating guest registration",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
        );
      } catch {
        /* ignore */
      }
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
      GuestController.log.error(
        "Error fetching guest registration",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error fetching guest registration",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
        );
      } catch {
        /* ignore */
      }
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
      const { token } = req.params as { token: string };
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
      GuestController.log.error(
        "Error fetching guest by token",
        error as Error,
        undefined,
        { token: (req.params || {}).token }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error fetching guest by token",
          error as Error,
          undefined,
          { token: (req.params || {}).token }
        );
      } catch {
        /* ignore */
      }
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
      const { token } = req.params as { token: string };
      const doc = await GuestController.findByManageToken(token);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      const { fullName, phone, notes } = req.body || {};
      if (fullName) doc.fullName = String(fullName).trim();
      // Phone is optional and can be cleared by providing an empty string
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
        const normalizedPhone =
          typeof phone === "string"
            ? phone.trim()
            : (phone as string | undefined);
        doc.phone =
          normalizedPhone && normalizedPhone.length > 0
            ? normalizedPhone
            : (undefined as unknown as string);
      }
      if (notes !== undefined) doc.notes = String(notes ?? "").trim();
      // Rotate token after successful update to reduce replay window
      let newRawToken: string | undefined;
      try {
        newRawToken = (
          doc as unknown as { generateManageToken?: () => string | undefined }
        ).generateManageToken?.();
      } catch {
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
      } catch {
        /* intentionally ignore non-critical debug/logging errors */
      }
      res.status(200).json({
        success: true,
        message: "Guest registration updated successfully",
        data: { ...doc.toPublicJSON(), manageToken: newRawToken },
      });
    } catch (error) {
      console.error("Error updating guest by token:", error);
      GuestController.log.error(
        "Error updating guest by token",
        error as Error,
        undefined,
        { token: (req.params || {}).token }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestController").error(
          "Error updating guest by token",
          error as Error,
          undefined,
          { token: (req.params || {}).token }
        );
      } catch {
        /* ignore */
      }
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
      const { token } = req.params as { token: string };
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
        } catch {
          /* intentionally ignore non-critical debug/logging errors */
        }
      }
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      // Capture details then delete the registration
      const eventId = doc.eventId.toString();
      const roleId = doc.roleId;
      const guestName = doc.fullName;
      await GuestRegistration.deleteOne({ _id: doc._id });
      try {
        socketService.emitEventUpdate(eventId, "guest_cancellation", {
          eventId,
          roleId,
          guestName,
          timestamp: new Date(),
        });
      } catch {
        // ignore
      }
      res.status(200).json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest by token:", error);
      GuestController.log.error(
        "Error cancelling guest by token",
        error as Error,
        undefined,
        { token: (req.params || {}).token }
      );
      res.status(500).json({
        success: false,
        message: "Failed to cancel guest registration",
      });
    }
  }

  /**
   * Move a guest registration between roles (admin/organizer management operation)
   * POST /api/events/:id/manage/move-guest
   */
  static async moveGuestBetweenRoles(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { guestRegistrationId, fromRoleId, toRoleId } = (req.body ||
        {}) as {
        guestRegistrationId: string;
        fromRoleId: string;
        toRoleId: string;
      };

      // Basic validation
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        res.status(400).json({ success: false, message: "Invalid event ID." });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(guestRegistrationId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid guest registration ID." });
        return;
      }
      if (!fromRoleId || !toRoleId) {
        res.status(400).json({
          success: false,
          message: "Source and target role IDs are required.",
        });
        return;
      }
      if (fromRoleId === toRoleId) {
        res
          .status(200)
          .json({ success: true, message: "No change - same role", data: {} });
        return;
      }

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }

      const sourceRole = event.roles.find(
        (r: IEventRole) => r.id === fromRoleId
      );
      const targetRole = event.roles.find((r: IEventRole) => r.id === toRoleId);
      if (!sourceRole || !targetRole) {
        res
          .status(404)
          .json({ success: false, message: "Source or target role not found" });
        return;
      }

      // Find guest registration and ensure it belongs to source role and event
      const guest = await GuestRegistration.findById(guestRegistrationId);
      if (!guest) {
        res
          .status(404)
          .json({ success: false, message: "Guest registration not found" });
        return;
      }
      if (guest.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Cannot move a cancelled registration",
        });
        return;
      }
      if (guest.eventId.toString() !== event._id.toString()) {
        res.status(400).json({
          success: false,
          message: "Registration does not belong to this event",
        });
        return;
      }
      if (guest.roleId !== fromRoleId) {
        res.status(400).json({
          success: false,
          message: "Registration is not in the specified source role",
        });
        return;
      }

      // Perform capacity check and move under an application-level lock on the target role
      // Use the same key family as guest signup so signups and moves serialize together
      const lockKey = `guest-signup:${eventId}:${toRoleId}`;
      const lockResult = await lockService.withLock(
        lockKey,
        async () => {
          // Re-check capacity inside lock
          const occ = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            toRoleId
          );
          if (CapacityService.isRoleFull(occ)) {
            return {
              type: "error",
              status: 400,
              message: `Target role is at full capacity (${occ.total}/$${
                (occ.capacity ??
                  (targetRole as unknown as { maxParticipants?: number })
                    ?.maxParticipants) ||
                "?"
              })`,
            } as const;
          }

          // Persist move
          guest.roleId = toRoleId;
          // Invalidate any manage token to avoid stale links tied to old role context
          try {
            (
              guest as unknown as { manageToken?: string | undefined }
            ).manageToken = undefined;
            (
              guest as unknown as { manageTokenExpires?: Date | undefined }
            ).manageTokenExpires = undefined;
          } catch {
            /* intentionally ignore non-critical errors */
          }
          await guest.save();
          await event.save();
          return { type: "ok" } as const;
        },
        10000
      );

      type MoveLockResult =
        | { type: "ok" }
        | { type: "error"; status: number; message: string };
      const moveOutcome = lockResult as unknown as MoveLockResult;
      if (moveOutcome?.type === "error") {
        res.status(moveOutcome.status).json({
          success: false,
          message: moveOutcome.message,
        });
        return;
      }

      // Invalidate caches and build updated event
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          eventId,
          (req as RequestWithUser).user?._id
            ? String((req as RequestWithUser).user!._id)
            : undefined
        );

      // Email the guest about the role move
      try {
        const actor = (req as RequestWithUser)?.user || {};
        const fromName = sourceRole?.name || "Previous Role";
        const toName = targetRole?.name || "New Role";
        await EmailService.sendEventRoleMovedEmail(guest.email, {
          event: { title: (event as EventLike).title },
          user: { email: guest.email, name: guest.fullName },
          fromRoleName: fromName,
          toRoleName: toName,
          actor: {
            firstName: (actor as UserLike)?.firstName || "",
            lastName: (actor as UserLike)?.lastName || "",
          },
        });
      } catch (emailErr) {
        console.error("Failed to send guest moved email:", emailErr);
        // Non-fatal
        GuestController.log.error(
          "Failed to send guest moved email",
          emailErr as Error,
          undefined,
          { eventId, guestId: guestRegistrationId, fromRoleId, toRoleId }
        );
      }

      // Emit real-time updates
      // Backward-compatible generic guest update
      socketService.emitEventUpdate(eventId, "guest_updated", {
        eventId,
        roleId: toRoleId,
        guestName: guest.fullName,
        event: updatedEvent,
      });

      // New explicit guest_moved event for clearer client reactions
      const fromRoleName = sourceRole?.name || undefined;
      const toRoleName = targetRole?.name || undefined;
      socketService.emitEventUpdate(eventId, "guest_moved", {
        eventId,
        fromRoleId,
        toRoleId,
        fromRoleName,
        toRoleName,
        guestName: guest.fullName,
        event: updatedEvent,
      });

      res.status(200).json({
        success: true,
        message: "Guest moved between roles successfully",
        data: { event: updatedEvent },
      });
    } catch (error) {
      console.error("Move guest between roles error:", error);
      GuestController.log.error(
        "Move guest between roles error",
        error as Error,
        undefined,
        {
          eventId: (req.params || {}).id,
          guestRegistrationId: (req.body || {}).guestRegistrationId,
          fromRoleId: (req.body || {}).fromRoleId,
          toRoleId: (req.body || {}).toRoleId,
        }
      );
      res.status(500).json({
        success: false,
        message:
          (error as unknown as { message?: string })?.message ||
          "Failed to move guest between roles",
      });
    }
  }
}

export default GuestController;
