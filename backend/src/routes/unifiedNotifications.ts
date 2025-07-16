import { Router } from "express";
import { UnifiedNotificationController } from "../controllers/unifiedNotificationController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all notifications for current user
router.get("/", UnifiedNotificationController.getNotifications);

// Get unread count
router.get("/unread-count", UnifiedNotificationController.getUnreadCount);

// Get notification preferences
router.get(
  "/preferences",
  UnifiedNotificationController.getNotificationPreferences
);

// Update notification preferences
router.put(
  "/preferences",
  UnifiedNotificationController.updateNotificationPreferences
);

// Get notification analytics
router.get(
  "/analytics",
  UnifiedNotificationController.getNotificationAnalytics
);

// Mark specific notification as read
router.patch("/:notificationId/read", UnifiedNotificationController.markAsRead);

// Mark all notifications as read
router.patch("/read-all", UnifiedNotificationController.markAllAsRead);

// Create a new notification (admin/system)
router.post("/", UnifiedNotificationController.createNotification);

// Delete a notification
router.delete(
  "/:notificationId",
  UnifiedNotificationController.deleteNotification
);

// Cleanup expired notifications (admin/system task)
router.post(
  "/cleanup",
  UnifiedNotificationController.cleanupExpiredNotifications
);

export default router;
