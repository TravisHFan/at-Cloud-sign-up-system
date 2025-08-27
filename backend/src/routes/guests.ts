import { Router } from "express";
import { GuestController } from "../controllers/guestController";
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
router.post(
  "/:eventId/guest-signup",
  sanitizeGuestBody,
  guestRegistrationValidation,
  handleValidationErrors,
  GuestController.registerGuest
);

// Get guest registrations for an event
// Admins get full details; non-admins get sanitized minimal fields for in-slot display
// GET /api/events/:eventId/guests
router.get(
  "/:eventId/guests",
  authenticateOptional,
  GuestController.getEventGuests
);

// Get guest registration by ID (for email links)
// GET /api/guest-registrations/:id
router.get("/guest-registrations/:id", GuestController.getGuestRegistration);

// Update guest registration details (for self-service via email links)
// PUT /api/guest-registrations/:id
router.put(
  "/guest-registrations/:id",
  authenticate,
  requireAdmin,
  sanitizeGuestBody,
  guestUpdateValidation,
  handleValidationErrors,
  GuestController.updateGuestRegistration
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
  GuestController.cancelGuestRegistration
);

// Re-send manage link (regenerate token + email) for a guest (Admin only)
// POST /api/guest-registrations/:id/resend-manage-link
router.post(
  "/guest-registrations/:id/resend-manage-link",
  authenticate,
  requireAdmin,
  GuestController.resendManageLink
);

// Token-based self-service management (no auth)
// GET /api/guest/manage/:token
router.get("/guest/manage/:token", GuestController.getGuestByToken);
// PUT /api/guest/manage/:token
router.put(
  "/guest/manage/:token",
  sanitizeGuestBody,
  guestUpdateValidation,
  GuestController.updateByToken
);
// DELETE /api/guest/manage/:token
router.delete(
  "/guest/manage/:token",
  sanitizeCancellationBody,
  guestCancellationValidation,
  GuestController.cancelByToken
);

export default router;
