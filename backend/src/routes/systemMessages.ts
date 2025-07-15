import { Router } from "express";
import { SystemMessageController } from "../controllers/systemMessageController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User system message routes
router.get("/", SystemMessageController.getSystemMessages);
router.get("/unread-count", SystemMessageController.getUnreadCount);
router.get(
  "/welcome-status",
  SystemMessageController.checkWelcomeMessageStatus
);
router.put("/:messageId/read", SystemMessageController.markAsRead);
router.put("/mark-all-read", SystemMessageController.markAllAsRead);

// System auto-generated message routes (for welcome messages, etc.)
router.post("/auto", SystemMessageController.createSystemMessage);

// Admin routes
router.post("/", requireAdmin, SystemMessageController.createSystemMessage);
router.delete(
  "/:messageId",
  requireAdmin,
  SystemMessageController.deleteSystemMessage
);

export default router;
