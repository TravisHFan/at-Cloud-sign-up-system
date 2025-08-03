import { Router } from "express";
import { UnifiedMessageController } from "../controllers/unifiedMessageController";
import { EmailNotificationController } from "../controllers/emailNotificationController";
import { authenticate } from "../middleware/auth";
import {
  validateSystemMessage,
  validateError,
  handleValidationErrors,
} from "../middleware/validation";
import { param } from "express-validator";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===== SYSTEM MESSAGES =====

/**
 * @route GET /api/v1/notifications/system
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
 * @route PATCH /api/v1/notifications/system/:messageId/read
 * @desc Mark a system message as read
 * @access Private
 */
router.patch(
  "/system/:messageId/read",
  [param("messageId").notEmpty().withMessage("Message ID is required")],
  handleValidationErrors,
  UnifiedMessageController.markAsRead
);

/**
 * @route POST /api/v1/notifications/system
 * @desc Create a new system message
 * @access Private
 */
router.post(
  "/system",
  validateSystemMessage,
  validateError,
  UnifiedMessageController.createSystemMessage
);

/**
 * @route DELETE /api/v1/notifications/system/:messageId
 * @desc Delete a system message
 * @access Private
 */
router.delete(
  "/system/:messageId",
  [param("messageId").notEmpty().withMessage("Message ID is required")],
  handleValidationErrors,
  UnifiedMessageController.deleteMessage
);

// ===== BELL NOTIFICATIONS =====

/**
 * @route GET /api/v1/notifications/bell
 * @desc Get bell notifications for current user
 * @access Private
 */
router.get("/bell", UnifiedMessageController.getBellNotifications);

/**
 * @route PATCH /api/v1/notifications/bell/:messageId/read
 * @desc Mark a bell notification as read
 * @access Private
 */
router.patch(
  "/bell/:messageId/read",
  [param("messageId").notEmpty().withMessage("Message ID is required")],
  handleValidationErrors,
  UnifiedMessageController.markBellNotificationAsRead
);

/**
 * @route PATCH /api/v1/notifications/bell/read-all
 * @desc Mark all bell notifications as read
 * @access Private
 */
router.patch(
  "/bell/read-all",
  UnifiedMessageController.markAllBellNotificationsAsRead
);

/**
 * @route DELETE /api/v1/notifications/bell/:messageId
 * @desc Remove a bell notification
 * @access Private
 */
router.delete(
  "/bell/:messageId",
  [param("messageId").notEmpty().withMessage("Message ID is required")],
  handleValidationErrors,
  UnifiedMessageController.removeBellNotification
);

// ===== EMAIL NOTIFICATIONS =====
// Note: These are manual trigger endpoints for administrative use

/**
 * @route POST /api/v1/notifications/email/event-created
 * @desc Manually trigger event creation notification emails
 * @access Private
 */
router.post(
  "/email/event-created",
  EmailNotificationController.sendEventCreatedNotification
);

/**
 * @route POST /api/v1/notifications/email/role-change
 * @desc Manually trigger role change notification emails
 * @access Private
 */
router.post(
  "/email/role-change",
  EmailNotificationController.sendSystemAuthorizationChangeNotification
);

/**
 * @route POST /api/v1/notifications/email/co-organizer-assigned
 * @desc Manually trigger co-organizer assignment notification emails
 * @access Private
 */
router.post(
  "/email/co-organizer-assigned",
  EmailNotificationController.sendCoOrganizerAssignedNotification
);

// ===== UTILITY ENDPOINTS =====

/**
 * @route GET /api/v1/notifications/unread-counts
 * @desc Get unread counts for both notifications and system messages
 * @access Private
 */
router.get("/unread-counts", UnifiedMessageController.getUnreadCounts);

/**
 * @route POST /api/v1/notifications/cleanup
 * @desc Clean up expired notifications and messages
 * @access Private
 */
router.post("/cleanup", UnifiedMessageController.cleanupExpiredMessages);

// ===== WELCOME SYSTEM =====

/**
 * @route GET /api/v1/notifications/welcome-status
 * @desc Check if user has received welcome message
 * @access Private
 */
router.get(
  "/welcome-status",
  UnifiedMessageController.checkWelcomeMessageStatus
);

/**
 * @route POST /api/v1/notifications/welcome
 * @desc Send welcome notification to user
 * @access Private
 */
router.post("/welcome", UnifiedMessageController.sendWelcomeNotification);

export default router;
