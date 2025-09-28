import { Router, Request, Response } from "express";
import { EventController } from "../controllers/eventController";
import { GuestController } from "../controllers/guestController";
import {
  authenticate,
  authenticateOptional,
  requireLeader,
  authorizeEventManagement,
  authorizePermission,
} from "../middleware/auth";
import { PERMISSIONS } from "../utils/roleUtils";
import {
  validateEventCreation,
  validateObjectId,
  handleValidationErrors,
} from "../middleware/validation";
import { searchLimiter } from "../middleware/rateLimiting";
import { EmailService } from "../services/infrastructure/emailService";
import { EmailRecipientUtils } from "../utils/emailRecipientUtils";
import { Event } from "../models";
import {
  sanitizeGuestBody,
  guestUpdateValidation,
  sanitizeCancellationBody,
  guestCancellationValidation,
} from "../middleware/guestValidation";

const router = Router();

// Public routes (no authentication required)
router.get("/", searchLimiter, EventController.getAllEvents);
// Public: read-only templates (allowed types and role templates)
router.get("/templates", EventController.getEventTemplates);
// Time conflict check (public for quick client validation; read-only)
router.get("/check-conflict", EventController.checkTimeConflict);
router.get(
  "/:id",
  authenticateOptional,
  validateObjectId,
  handleValidationErrors,
  EventController.getEventById
);

// Batch status update (can be called by admins or as a maintenance endpoint)
router.post(
  "/update-statuses",
  authenticate,
  requireLeader,
  EventController.updateAllEventStatuses
);

// Batch signup count recalculation (can be called by admins or as a maintenance endpoint)
router.post(
  "/recalculate-signups",
  authenticate,
  requireLeader,
  EventController.recalculateSignupCounts
);

// All routes below require authentication
router.use(authenticate);

// Event management routes (require CREATE_EVENT permission)
router.post(
  "/",
  validateEventCreation,
  handleValidationErrors,
  authorizePermission(PERMISSIONS.CREATE_EVENT),
  EventController.createEvent
);
router.put(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.updateEvent
);
router.delete(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.deleteEvent
);

// Publish / Unpublish (lifecycle) endpoints
router.post(
  "/:id/publish",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.publishEvent
);
router.post(
  "/:id/unpublish",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.unpublishEvent
);

// Create (or fetch existing) short link for a published event (idempotent)
router.post(
  "/:id/shortlink",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }
      const { id } = req.params;
      const { customKey } = req.body || {};
      const { ShortLinkService } = await import("../services/ShortLinkService");
      const { ShortLinkMetricsService } = await import(
        "../services/ShortLinkMetricsService"
      );
      const { shortLinkCreatedCounter } = await import(
        "../services/PrometheusMetricsService"
      );
      const userId = (req.user as any)._id?.toString();
      const result = await ShortLinkService.getOrCreateForEvent(
        id,
        userId,
        customKey
      );
      if (result.created) {
        try {
          ShortLinkMetricsService.increment("created");
          shortLinkCreatedCounter.inc();
        } catch {}
      }
      res.status(result.created ? 201 : 200).json({
        success: true,
        message: result.created
          ? "Short link created"
          : "Short link already exists",
        data: {
          key: result.shortLink.key,
          eventId: result.shortLink.eventId,
          slug: result.shortLink.targetSlug,
          expiresAt: result.shortLink.expiresAt,
          created: result.created,
        },
      });
    } catch (e: any) {
      const msg = (e && e.message) || "Failed to create short link";
      let code: string | undefined;
      let status = 400;
      if (/not published/i.test(msg)) code = "EVENT_NOT_PUBLISHED";
      else if (/no public roles/i.test(msg)) code = "NO_PUBLIC_ROLE";
      else if (/Custom key invalid \(pattern\)/.test(msg))
        code = "CUSTOM_KEY_INVALID";
      else if (/Custom key reserved/.test(msg)) code = "CUSTOM_KEY_RESERVED";
      else if (/Custom key taken/.test(msg)) {
        code = "CUSTOM_KEY_TAKEN";
        status = 409;
      } else if (/Event not found/i.test(msg)) {
        status = 404;
        code = "EVENT_NOT_FOUND";
      }
      res.status(status).json({ success: false, message: msg, code });
    }
  }
);

// Event participation routes
router.post(
  "/:id/register",
  validateObjectId,
  handleValidationErrors,
  EventController.signUpForEvent
);
router.post(
  "/:id/signup",
  validateObjectId,
  handleValidationErrors,
  EventController.signUpForEvent
);

// Workshop group topic update (auth required; permission checked inside controller)
router.post(
  "/:id/workshop/groups/:group/topic",
  validateObjectId,
  handleValidationErrors,
  EventController.updateWorkshopGroupTopic
);
router.post(
  "/:id/cancel",
  validateObjectId,
  handleValidationErrors,
  EventController.cancelSignup
);

// Event management routes (for organizers and admins)
router.post(
  "/:id/manage/remove-user",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.removeUserFromRole
);
router.post(
  "/:id/manage/move-user",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.moveUserBetweenRoles
);

// Move guest between roles (organizers/admins)
router.post(
  "/:id/manage/move-guest",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  GuestController.moveGuestBetweenRoles
);

// Organizer/Admin: Update guest registration details for a specific event
router.put(
  "/:id/manage/guests/:guestId",
  validateObjectId, // validates :id (eventId)
  sanitizeGuestBody,
  guestUpdateValidation,
  handleValidationErrors,
  authorizeEventManagement,
  GuestController.updateGuestRegistration
);

// Organizer/Admin: Cancel a guest registration for a specific event
router.delete(
  "/:id/manage/guests/:guestId",
  validateObjectId, // validates :id (eventId)
  sanitizeCancellationBody,
  guestCancellationValidation,
  handleValidationErrors,
  authorizeEventManagement,
  GuestController.cancelGuestRegistration
);

// Organizer/Admin: Re-send manage link for a guest in a specific event
router.post(
  "/:id/manage/guests/:guestId/resend-manage-link",
  validateObjectId, // validates :id (eventId)
  handleValidationErrors,
  authorizeEventManagement,
  GuestController.resendManageLink
);

// Email all participants/guests (organizers/admins)
router.post(
  "/:id/email",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  async (req: import("express").Request, res: import("express").Response) => {
    try {
      const { id } = req.params;
      const {
        subject,
        bodyHtml,
        bodyText,
        includeGuests = true,
        includeUsers = true,
      } = req.body || {};

      if (!subject || !bodyHtml) {
        res.status(400).json({
          success: false,
          message: "Subject and bodyHtml are required",
        });
        return;
      }

      // Load event for organizer reply-to
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }

      // Determine Reply-To (primary organizer if available)
      let replyTo = undefined as string | undefined;
      if (
        Array.isArray(event.organizerDetails) &&
        event.organizerDetails.length > 0
      ) {
        const main = event.organizerDetails[0];
        if (main?.email)
          replyTo = `${main.name || "Organizer"} <${main.email}>`;
      }

      // Gather recipients
      const recipients: Array<{
        email: string;
        firstName?: string;
        lastName?: string;
      }> = [];
      if (includeUsers) {
        const users = await EmailRecipientUtils.getEventParticipants(id);
        for (const u of users) {
          if (u.email)
            recipients.push({
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
            });
        }
      }
      if (includeGuests) {
        const guests = await EmailRecipientUtils.getEventGuests(id);
        for (const g of guests) {
          if (g.email)
            recipients.push({
              email: g.email,
              firstName: g.firstName,
              lastName: g.lastName,
            });
        }
      }

      // Dedupe by email
      const seen = new Set<string>();
      const unique = recipients.filter((r) => {
        const key = r.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (unique.length === 0) {
        res.status(200).json({
          success: true,
          message: "No recipients found",
          recipientCount: 0,
        });
        return;
      }

      // Send emails
      const results = await Promise.allSettled(
        unique.map((r) =>
          EmailService.sendEmail({
            to: r.email,
            subject,
            html: bodyHtml,
            text: bodyText,
            replyTo,
          })
        )
      );

      const sent = results.filter(
        (x) => x.status === "fulfilled" && x.value === true
      ).length;

      res.status(200).json({
        success: true,
        message: `Email sent to ${sent}/${unique.length} recipients`,
        recipientCount: unique.length,
        sent,
      });
    } catch (error) {
      console.error("Failed to send event emails:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to send emails" });
    }
  }
);

// Assign user to a role (organizers only)
router.post(
  "/:id/manage/assign-user",
  validateObjectId,
  handleValidationErrors,
  authorizeEventManagement,
  EventController.assignUserToRole
);

// User's event routes
router.get("/user/registered", EventController.getUserEvents);
router.get("/user/created", EventController.getCreatedEvents);

// Event participants (for organizers and admins)
router.get(
  "/:id/participants",
  validateObjectId,
  handleValidationErrors,
  EventController.getEventParticipants
);

export default router;
