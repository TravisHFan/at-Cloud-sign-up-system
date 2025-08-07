import { Router } from "express";
import { EventController } from "../controllers/eventController";
import {
  authenticate,
  requireLeader,
  authorizeEventAccess,
  authorizeEventManagement,
  authorizePermission,
} from "../middleware/auth";
import { PERMISSIONS } from "../utils/roleUtils";
import {
  validateEventCreation,
  validateObjectId,
  handleValidationErrors,
} from "../middleware/validation";
import { searchLimiter, uploadLimiter } from "../middleware/rateLimiting";

const router = Router();

// Public routes (no authentication required)
router.get("/", searchLimiter, EventController.getAllEvents);
router.get(
  "/:id",
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
