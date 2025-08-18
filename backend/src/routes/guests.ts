import { Router } from "express";
import { GuestController } from "../controllers/guestController";
import {
  guestRegistrationValidation,
  guestUpdateValidation,
  guestCancellationValidation,
} from "../middleware/guestValidation";
import { authenticate, requireAdmin } from "../middleware/auth";

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
  guestRegistrationValidation,
  GuestController.registerGuest
);

// Get guest registrations for an event (Admin only)
// GET /api/events/:eventId/guests
router.get(
  "/:eventId/guests",
  authenticate,
  requireAdmin,
  GuestController.getEventGuests
);

// Get guest registration by ID (for email links)
// GET /api/guest-registrations/:id
router.get("/guest-registrations/:id", GuestController.getGuestRegistration);

// Update guest registration details (for self-service via email links)
// PUT /api/guest-registrations/:id
router.put(
  "/guest-registrations/:id",
  guestUpdateValidation,
  GuestController.updateGuestRegistration
);

// Cancel a guest registration
// DELETE /api/guest-registrations/:id
router.delete(
  "/guest-registrations/:id",
  guestCancellationValidation,
  GuestController.cancelGuestRegistration
);

export default router;
