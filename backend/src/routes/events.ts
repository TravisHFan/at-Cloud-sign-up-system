import { Router } from "express";
import { EventController } from "../controllers/eventController";
import {
  authenticate,
  requireLeader,
  authorizeEventAccess,
  authorizePermission,
} from "../middleware/auth";
import { uploadEventImage } from "../middleware/upload";
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
  authorizeEventAccess,
  EventController.updateEvent
);
router.delete(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  authorizeEventAccess,
  EventController.deleteEvent
);

// Event image upload
router.post(
  "/:id/image",
  validateObjectId,
  handleValidationErrors,
  uploadLimiter,
  uploadEventImage,
  EventController.uploadEventImage
);

// Event participation routes
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
