import { Router } from "express";
import { GuestRegistrationController } from "../controllers/guest/GuestRegistrationController";
import GuestListController from "../controllers/guest/GuestListController";
import GuestRetrievalController from "../controllers/guest/GuestRetrievalController";
import GuestUpdateController from "../controllers/guest/GuestUpdateController";
import GuestCancellationController from "../controllers/guest/GuestCancellationController";
import GuestManageLinkController from "../controllers/guest/GuestManageLinkController";
import GuestTokenRetrievalController from "../controllers/guest/GuestTokenRetrievalController";
import GuestTokenUpdateController from "../controllers/guest/GuestTokenUpdateController";
import GuestTokenCancellationController from "../controllers/guest/GuestTokenCancellationController";
import GuestDeclineController from "../controllers/guest/GuestDeclineController";
import {
  guestRegistrationValidation,
  guestUpdateValidation,
  guestCancellationValidation,
  handleValidationErrors,
  sanitizeGuestBody,
  sanitizeCancellationBody,
} from "../middleware/guestValidation";
import {
  authenticateOptional,
  authenticate,
  requireAdmin,
} from "../middleware/auth";

const router = Router();

/**
 * Guest Registration Routes
 *
 * These routes handle guest user registrations for events without requiring full user accounts
 */

// Register a guest for an event role
// POST /api/events/:eventId/guest-signup
// Uses authenticateOptional to support both:
// 1. Authenticated users (Leaders, Admins) inviting guests → tracks invitedBy
// 2. Public guest self-registration → no invitedBy tracking
router.post(
  "/:eventId/guest-signup",
  authenticateOptional,
  sanitizeGuestBody,
  guestRegistrationValidation,
  handleValidationErrors,
  GuestRegistrationController.registerGuest
);

// Get guest registrations for an event
// Admins get full details; non-admins get sanitized minimal fields for in-slot display
// GET /api/events/:eventId/guests
router.get(
  "/:eventId/guests",
  authenticateOptional,
  GuestListController.getEventGuests
);

// Get guest registration by ID (for email links)
// GET /api/guest-registrations/:id
router.get("/guest-registrations/:id", GuestRetrievalController.getGuestRegistration);

// Update guest registration details (for self-service via email links)
// PUT /api/guest-registrations/:id
router.put(
  "/guest-registrations/:id",
  authenticate,
  requireAdmin,
  sanitizeGuestBody,
  guestUpdateValidation,
  handleValidationErrors,
  GuestUpdateController.updateGuestRegistration
);

// Cancel a guest registration
// DELETE /api/guest-registrations/:id
router.delete(
  "/guest-registrations/:id",
  authenticate,
  requireAdmin,
  sanitizeCancellationBody,
  guestCancellationValidation,
  handleValidationErrors,
  GuestCancellationController.cancelGuestRegistration
);

// Re-send manage link (regenerate token + email) for a guest (Admin only)
// POST /api/guest-registrations/:id/resend-manage-link
router.post(
  "/guest-registrations/:id/resend-manage-link",
  authenticate,
  requireAdmin,
  GuestManageLinkController.resendManageLink
);

// Token-based self-service management (no auth)
// GET /api/guest/manage/:token
router.get("/guest/manage/:token", GuestTokenRetrievalController.getGuestByToken);
// PUT /api/guest/manage/:token
router.put(
  "/guest/manage/:token",
  sanitizeGuestBody,
  guestUpdateValidation,
  GuestTokenUpdateController.updateByToken
);
// DELETE /api/guest/manage/:token
router.delete(
  "/guest/manage/:token",
  sanitizeCancellationBody,
  guestCancellationValidation,
  GuestTokenCancellationController.cancelByToken
);

// Guest invitation decline (token-based, no auth)
// GET /api/guest/decline/:token
router.get("/guest/decline/:token", GuestDeclineController.getDeclineTokenInfo);
// POST /api/guest/decline/:token { reason? }
router.post("/guest/decline/:token", GuestDeclineController.submitDecline);

export default router;
