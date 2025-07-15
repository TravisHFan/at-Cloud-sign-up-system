import { Router } from "express";
import { SystemMessageController } from "../controllers/systemMessageController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User system message routes
router.get("/", SystemMessageController.getSystemMessages);
router.get("/unread-count", SystemMessageController.getUnreadCount);
router.put("/:messageId/read", SystemMessageController.markAsRead);
router.put("/mark-all-read", SystemMessageController.markAllAsRead);

// Admin routes
router.post("/", requireAdmin, SystemMessageController.createSystemMessage);
router.delete(
  "/:messageId",
  requireAdmin,
  SystemMessageController.deleteSystemMessage
);

export default router;
