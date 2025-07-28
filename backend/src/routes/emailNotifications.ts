import { Router } from "express";
import { EmailNotificationController } from "../controllers/emailNotificationController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Event creation notifications
router.post(
  "/event-created",
  EmailNotificationController.sendEventCreatedNotification
);

// Role change notifications
router.post(
  "/system-authorization-change",
  EmailNotificationController.sendSystemAuthorizationChangeNotification
);
router.post(
  "/atcloud-role-change",
  EmailNotificationController.sendAtCloudRoleChangeNotification
);

// Admin notifications
router.post(
  "/new-leader-signup",
  EmailNotificationController.sendNewLeaderSignupNotification
);

// Event management notifications
router.post(
  "/co-organizer-assigned",
  EmailNotificationController.sendCoOrganizerAssignedNotification
);
router.post(
  "/event-reminder",
  EmailNotificationController.sendEventReminderNotification
);

// Additional notifications (to be implemented)
router.post("/password-reset", (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

router.post("/email-verification", (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

router.post("/security-alert", (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

router.post("/schedule-reminder", (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

router.post("/event-role-removal", (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

router.post("/event-role-move", (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented yet" });
});

export { router as emailNotificationRouter };
