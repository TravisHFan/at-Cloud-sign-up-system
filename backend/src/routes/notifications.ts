import { Router } from "express";
import { NotificationController } from "../controllers/notificationController";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  validateNotification,
  validateObjectId,
  handleValidationErrors,
} from "../middleware/validation";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User notification routes
router.get("/", NotificationController.getNotifications);
router.put(
  "/:notificationId/read",
  validateObjectId,
  handleValidationErrors,
  NotificationController.markAsRead
);
router.put("/mark-all-read", NotificationController.markAllAsRead);
router.delete(
  "/:notificationId",
  validateObjectId,
  handleValidationErrors,
  NotificationController.deleteNotification
);
router.delete("/", NotificationController.clearAllNotifications);

// Notification settings routes
router.get("/settings", NotificationController.getNotificationSettings);
router.put("/settings", NotificationController.updateNotificationSettings);

// Admin notification routes
router.post(
  "/",
  validateNotification,
  handleValidationErrors,
  requireAdmin,
  NotificationController.createNotification
);
router.post(
  "/bulk",
  validateNotification,
  handleValidationErrors,
  requireAdmin,
  NotificationController.sendBulkNotification
);

// Email notification integration routes (for frontend email service)
router.post(
  "/email/event-created",
  NotificationController.sendEventCreatedEmail
);
router.post(
  "/email/event-reminder",
  NotificationController.sendEventReminderEmail
);

export default router;
