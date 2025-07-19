import { Router } from "express";
import { UnifiedMessageController } from "../controllers/unifiedMessageController";
import { authenticate } from "../middleware/auth";
import { validateSystemMessage, validateError } from "../middleware/validation";

const router = Router();

// All routes require authentication
router.use(authenticate);

// System Messages (Requirements 1-4)
router.get("/", UnifiedMessageController.getSystemMessages);
router.get(
  "/welcome-status",
  UnifiedMessageController.checkWelcomeMessageStatus
);
router.post(
  "/",
  validateSystemMessage,
  validateError,
  UnifiedMessageController.createSystemMessage
);
router.patch("/:messageId/read", UnifiedMessageController.markAsRead);
router.delete("/:messageId", UnifiedMessageController.deleteMessage);

// Bell Notifications (Requirements 5-6)
router.get(
  "/bell-notifications",
  UnifiedMessageController.getBellNotifications
);
router.patch(
  "/bell-notifications/:messageId/read",
  UnifiedMessageController.markBellNotificationAsRead
);
router.patch(
  "/bell-notifications/read-all",
  UnifiedMessageController.markAllBellNotificationsAsRead
);
router.delete(
  "/bell-notifications/:messageId",
  UnifiedMessageController.removeBellNotification
);

export default router;
