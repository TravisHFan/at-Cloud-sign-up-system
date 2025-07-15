import { Router } from "express";
import { NotificationController } from "../controllers/notificationController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get notifications with filtering
router.get("/", NotificationController.getNotifications);

// Get unread count only
router.get("/unread-count", NotificationController.getUnreadCount);

// Get notification statistics
router.get("/stats", NotificationController.getStats);

// Mark single notification as read
router.patch("/:notificationId/read", NotificationController.markAsRead);

// Mark all notifications as read
router.patch("/read-all", NotificationController.markAllAsRead);

// Create notification (internal use - could be restricted to admin)
router.post("/", NotificationController.createNotification);

// Delete notification
router.delete("/:notificationId", NotificationController.deleteNotification);

// Cleanup expired notifications (maintenance endpoint - should be restricted)
router.delete("/cleanup/expired", NotificationController.cleanupExpired);

export default router;
