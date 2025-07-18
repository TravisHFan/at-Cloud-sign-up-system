import express from "express";
import { UserNotificationController } from "../controllers/userNotificationController";
import { authenticate } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/validation";
import { param } from "express-validator";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ===== BELL NOTIFICATIONS (DEPRECATED - Use /system-messages/bell-notifications instead) =====

/**
 * @route GET /api/v1/user/notifications/bell
 * @desc Get all bell notifications for current user
 * @access Private
 * @deprecated Use /api/v1/system-messages/bell-notifications instead
 * @query {string} [type] - Filter by notification type
 * @query {string} [category] - Filter by category
 * @query {boolean} [isRead] - Filter by read status
 * @query {string} [priority] - Filter by priority
 * @query {number} [page=1] - Page number
 * @query {number} [limit=50] - Number of items per page
 */
router.get("/bell", UserNotificationController.getBellNotifications);

/**
 * @route PUT /api/v1/user/notifications/bell/:notificationId/read
 * @desc Mark a bell notification as read
 * @access Private
 * @deprecated Use PATCH /api/v1/system-messages/bell-notifications/:id/read instead
 */
router.put(
  "/bell/:notificationId/read",
  [
    param("notificationId")
      .notEmpty()
      .withMessage("Notification ID is required"),
  ],
  handleValidationErrors,
  UserNotificationController.markBellNotificationAsRead
);

/**
 * @route DELETE /api/v1/user/notifications/bell/:notificationId
 * @desc Delete a bell notification
 * @access Private
 * @deprecated Use DELETE /api/v1/system-messages/bell-notifications/:id instead
 */
router.delete(
  "/bell/:notificationId",
  [
    param("notificationId")
      .notEmpty()
      .withMessage("Notification ID is required"),
  ],
  handleValidationErrors,
  UserNotificationController.deleteBellNotification
);

/**
 * @route PUT /api/v1/user/notifications/bell/read-all
 * @desc Mark all bell notifications as read
 * @access Private
 * @deprecated Use PATCH /api/v1/system-messages/bell-notifications/read-all instead
 */
router.put(
  "/bell/read-all",
  UserNotificationController.markAllBellNotificationsAsRead
);

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
router.get("/system", UserNotificationController.getSystemMessages);

/**
 * @route PUT /api/v1/user/notifications/system/:messageId/read
 * @desc Mark a system message as read
 * @access Private
 */
router.put(
  "/system/:messageId/read",
  [param("messageId").notEmpty().withMessage("Message ID is required")],
  handleValidationErrors,
  UserNotificationController.markSystemMessageAsRead
);

// ===== UTILITY ENDPOINTS =====

/**
 * @route GET /api/v1/user/notifications/unread-counts
 * @desc Get unread counts for both notifications and system messages
 * @access Private
 */
router.get("/unread-counts", UserNotificationController.getUnreadCounts);

/**
 * @route POST /api/v1/user/notifications/cleanup
 * @desc Clean up expired notifications and messages
 * @access Private
 */
router.post("/cleanup", UserNotificationController.cleanupExpiredItems);

export default router;
