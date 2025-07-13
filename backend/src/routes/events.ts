import { Router } from "express";
import { EventController } from "../controllers/eventController";
import {
  authenticate,
  requireLeader,
  authorizeEventAccess,
  authorizePermission,
} from "../middleware/auth";
import { PERMISSIONS } from "../utils/roleUtils";

const router = Router();

// Public routes (no authentication required)
router.get("/", EventController.getAllEvents);
router.get("/:id", EventController.getEventById);

// All routes below require authentication
router.use(authenticate);

// Event management routes (require leader or higher)
router.post("/", requireLeader, EventController.createEvent);
router.put("/:id", authorizeEventAccess, EventController.updateEvent);
router.delete("/:id", authorizeEventAccess, EventController.deleteEvent);

// Event participation routes
router.post("/:id/signup", EventController.signUpForEvent);
router.post("/:id/cancel", EventController.cancelSignup);

// User's event routes
router.get("/user/registered", EventController.getUserEvents);
router.get("/user/created", EventController.getCreatedEvents);

// Event participants (for organizers and admins)
router.get("/:id/participants", EventController.getEventParticipants);

export default router;
