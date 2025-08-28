import { Router } from "express";
import { EventController } from "../controllers/eventController";
import { GuestController } from "../controllers/guestController";
import {
  authenticate,
  authenticateOptional,
  requireLeader,
  authorizeEventAccess,
  authorizeEventManagement,
  authorizePermission,
} from "../middleware/auth";
// import { PERMISSIONS } from "../utils/roleUtils"; // not used here
import {
  validateEventCreation,
  validateObjectId,
  handleValidationErrors,
} from "../middleware/validation";
import { searchLimiter } from "../middleware/rateLimiting";

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

// Event management routes (require leader or higher)
router.post(
  "/",
  validateEventCreation,
  handleValidationErrors,
  requireLeader,
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
