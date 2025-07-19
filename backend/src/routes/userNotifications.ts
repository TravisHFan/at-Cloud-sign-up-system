import express from "express";
import { UnifiedMessageController } from "../controllers/unifiedMessageController";
import { authenticate } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/validation";
import { param } from "express-validator";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ===== SYSTEM MESSAGES =====

/**
 * @route GET /api/v1/user/notifications/system
 * @desc Get all system messages for current user
 * @access Private
 * @query {string} [type] - Filter by message type
 * @query {string} [priority] - Filter by priority
 * @query {boolean} [isRead] - Filter by read status
 * @query {number} [page=1] - Page number
 * @query {number} [limit=50] - Number of items per page
 */
router.get("/system", UnifiedMessageController.getSystemMessages);

/**
 * @route PUT /api/v1/user/notifications/system/:messageId/read
 * @desc Mark a system message as read
 * @access Private
 */
router.put(
  "/system/:messageId/read",
  [param("messageId").notEmpty().withMessage("Message ID is required")],
  handleValidationErrors,
  UnifiedMessageController.markAsRead
);

// ===== UTILITY ENDPOINTS =====

/**
 * @route GET /api/v1/user/notifications/unread-counts
 * @desc Get unread counts for both notifications and system messages
 * @access Private
 */
router.get("/unread-counts", UnifiedMessageController.getUnreadCounts);

/**
 * @route POST /api/v1/user/notifications/cleanup
 * @desc Clean up expired notifications and messages
 * @access Private
 */
router.post("/cleanup", UnifiedMessageController.cleanupExpiredItems);

export default router;
