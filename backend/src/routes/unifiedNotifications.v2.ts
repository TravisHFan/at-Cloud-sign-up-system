import { Router } from "express";
import { UnifiedNotificationController } from "../controllers/unifiedNotificationController.v2";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Core notification routes
router.get("/", UnifiedNotificationController.getNotifications);
router.patch("/:notificationId/read", UnifiedNotificationController.markAsRead);

// System message routes
router.post(
  "/system-messages",
  UnifiedNotificationController.createSystemMessage
);
router.patch(
  "/system-messages/:messageId/read",
  UnifiedNotificationController.markSystemMessageAsRead
);

// Chat notification routes
router.post(
  "/chat-notifications",
  UnifiedNotificationController.createChatNotification
);

// Auth level change notification routes
router.post(
  "/auth-level-change",
  UnifiedNotificationController.createAuthLevelChangeNotification
);

export default router;
