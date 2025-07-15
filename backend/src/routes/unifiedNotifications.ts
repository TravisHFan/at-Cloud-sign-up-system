import { Router } from "express";
import { UnifiedNotificationController } from "../controllers/UnifiedNotificationController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get notifications with filtering
router.get("/", UnifiedNotificationController.getNotifications);

// Get unread count only
router.get("/unread-count", UnifiedNotificationController.getUnreadCount);

// Get notification statistics
router.get("/stats", UnifiedNotificationController.getStats);

// Mark single notification as read
router.patch("/:notificationId/read", UnifiedNotificationController.markAsRead);

// Mark all notifications as read
router.patch("/read-all", UnifiedNotificationController.markAllAsRead);

// Create notification (internal use - could be restricted to admin)
router.post("/", UnifiedNotificationController.createNotification);

// Delete notification
router.delete(
  "/:notificationId",
  UnifiedNotificationController.deleteNotification
);

// Cleanup expired notifications (maintenance endpoint - should be restricted)
router.delete("/cleanup/expired", UnifiedNotificationController.cleanupExpired);

export default router;
