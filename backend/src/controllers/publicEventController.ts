import { Request, Response } from "express";
import { truncateIpToCidr } from "../utils/privacy";
import {
  registrationFailureCounter,
  registrationAttemptCounter,
} from "../services/PrometheusMetricsService";
import Event from "../models/Event";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import { GUEST_MAX_ROLES_PER_EVENT } from "../middleware/guestValidation";
import { ValidationHelper } from "./publicEvent/ValidationHelper";
import { RegistrationHelper } from "./publicEvent/RegistrationHelper";
import { NotificationHelper } from "./publicEvent/NotificationHelper";
import { CacheHelper } from "./publicEvent/CacheHelper";

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

      // 1. Validation phase using ValidationHelper
      if (!ValidationHelper.validateSlug(slug, log, req, res)) return;
      if (!ValidationHelper.validateRoleId(roleId, slug, log, req, res)) return;
      if (
        !ValidationHelper.validateAttendee(
          attendee,
          slug,
          roleId!,
          log,
          req,
          res
        )
      )
        return;
      if (
        !ValidationHelper.validateConsent(consent, slug, roleId!, log, req, res)
      )
        return;

      // 2. Event & Role lookup
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
      if (
        !ValidationHelper.validateRole(targetRole, roleId!, slug, log, req, res)
      )
        return;
      if (
        !ValidationHelper.validateRolePublic(
          targetRole!,
          roleId!,
          slug,
          log,
          req,
          res
        )
      )
        return;

      // 3. Execute registration with lock using RegistrationHelper
      const result = await RegistrationHelper.executeRegistrationWithLock(
        event,
        roleId!,
        targetRole!,
        attendee!
      );

      // 4. Handle limit reached errors
      if (result.limitReached) {
        res.status(400).json({
          success: false,
          message:
            result.limitReachedFor === "user"
              ? `You have reached the ${result.userLimit}-role limit for this event.`
              : `This guest has reached the ${GUEST_MAX_ROLES_PER_EVENT}-role limit for this event.`,
        });
        try {
          registrationFailureCounter.inc({ reason: "limit_reached" });
        } catch {}
        return;
      }

      if (!result.registrationId) {
        res.status(400).json({
          success: false,
          message: "Unable to register (possibly full capacity)",
        });
        try {
          registrationFailureCounter.inc({ reason: "capacity_full" });
        } catch {}
        return;
      }

      // 5. Build response payload
      const responsePayload: Record<string, unknown> = {
        status: "ok",
        registrationId: result.registrationId,
        type: result.registrationType,
        duplicate: result.duplicate,
        // For backward compatibility with tests expecting the shorter message
        message: result.duplicate
          ? "Already registered"
          : "Registered successfully",
      };

      // 6. Fire-and-forget notifications using NotificationHelper
      NotificationHelper.sendConfirmationEmail(
        event,
        roleId!,
        attendee!,
        result.duplicate
      ).catch(() => undefined);

      NotificationHelper.createAuditLog(
        event,
        roleId!,
        attendee!,
        result.registrationType,
        result.duplicate,
        result.capacityBefore,
        result.capacityAfter,
        requestId,
        ipCidr || "",
        log
      ).catch(() => undefined);

      // 7. Emit real-time updates using CacheHelper (only on non-duplicate success)
      if (!result.duplicate) {
        await CacheHelper.emitRegistrationUpdate(
          event,
          roleId!,
          result.registrationType,
          result.registrationId,
          attendee?.name,
          log
        );
      }

      // 8. Success response
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
