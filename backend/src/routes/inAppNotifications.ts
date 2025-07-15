import { Router } from "express";
import { InAppNotificationController } from "../controllers/inAppNotificationController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User notification routes
router.get("/", InAppNotificationController.getNotifications);
router.get("/unread-count", InAppNotificationController.getUnreadCount);
router.put("/:notificationId/read", InAppNotificationController.markAsRead);
router.put("/mark-all-read", InAppNotificationController.markAllAsRead);
router.delete(
  "/:notificationId",
  InAppNotificationController.deleteNotification
);
router.delete("/", InAppNotificationController.clearAllNotifications);

// Admin routes
router.post("/", requireAdmin, InAppNotificationController.createNotification);

export default router;
