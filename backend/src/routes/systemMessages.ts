import { Router } from "express";
import { SystemMessageController } from "../controllers/systemMessageController";
import { authenticate } from "../middleware/auth";
import { validateSystemMessage, validateError } from "../middleware/validation";

const router = Router();

// All routes require authentication
router.use(authenticate);

// System Messages (Requirements 1-4)
router.get("/", SystemMessageController.getSystemMessages);
router.post(
  "/",
  validateSystemMessage,
  validateError,
  SystemMessageController.createSystemMessage
);
router.patch("/:messageId/read", SystemMessageController.markAsRead);
router.delete("/:messageId", SystemMessageController.deleteMessage);

// Bell Notifications (Requirements 5-6)
router.get("/bell-notifications", SystemMessageController.getBellNotifications);
router.patch(
  "/bell-notifications/:messageId/read",
  SystemMessageController.markBellNotificationAsRead
);
router.delete(
  "/bell-notifications/:messageId",
  SystemMessageController.removeBellNotification
);

export default router;
