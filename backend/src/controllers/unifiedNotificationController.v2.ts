import { Request, Response } from "express";
import { UnifiedNotificationService } from "../services";
import { AuthUtils } from "../utils/authUtils";
import { createErrorResponse, createSuccessResponse } from "../types/api";

export class UnifiedNotificationController {
  private static getNotificationService(
    req: Request
  ): UnifiedNotificationService {
    const service = (req as any).app.get("unifiedNotificationService");
    if (!service) {
      console.error("❌ UnifiedNotificationService not found in app context");
      console.error(
        "Available app settings:",
        Object.keys((req as any).app.settings || {})
      );
      throw new Error("UnifiedNotificationService not initialized");
    }
    return service;
  }

  // Get all notifications for user (unified bell dropdown)
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { page = 1, limit = 50, includeRead = true } = req.query;

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.getNotificationsForUser(
        user.id,
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          includeRead: includeRead === "true",
        }
      );

      res
        .status(200)
        .json(
          createSuccessResponse(result, "Notifications retrieved successfully")
        );
    } catch (error: any) {
      console.error("Error getting notifications:", error);
      res.status(500).json(createErrorResponse("Failed to get notifications"));
    }
  }

  // Mark notification as read
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { notificationId } = req.params;

      const notificationService = this.getNotificationService(req);
      await notificationService.markNotificationAsRead(user.id, notificationId);

      res
        .status(200)
        .json(createSuccessResponse(null, "Notification marked as read"));
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to mark notification as read"));
    }
  }

  // Mark system message as read
  static async markSystemMessageAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { messageId } = req.params;

      const notificationService = this.getNotificationService(req);
      await notificationService.markSystemMessageAsRead(user.id, messageId);

      res
        .status(200)
        .json(createSuccessResponse(null, "System message marked as read"));
    } catch (error: any) {
      console.error("Error marking system message as read:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to mark system message as read"));
    }
  }

  // Create system message (Admin/Moderator only)
  static async createSystemMessage(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const {
        title,
        content,
        type,
        priority = "medium",
        targetUserId,
        expiresAt,
      } = req.body;

      // Validate required fields
      if (!title || !content || !type) {
        res
          .status(400)
          .json(
            createErrorResponse("Missing required fields: title, content, type")
          );
        return;
      }

      // Validate system message type
      const validTypes = [
        "announcement",
        "maintenance",
        "update",
        "warning",
        "auth_level_change",
      ];
      if (!validTypes.includes(type)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              `Invalid type. Must be one of: ${validTypes.join(", ")}`
            )
          );
        return;
      }

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.createSystemMessage({
        title,
        content,
        type,
        priority,
        creatorId: user.id,
        targetUserId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      res
        .status(201)
        .json(
          createSuccessResponse(result, "System message created successfully")
        );
    } catch (error: any) {
      console.error("Error creating system message:", error);
      if (
        error.message === "Insufficient permissions to create system messages"
      ) {
        res.status(403).json(createErrorResponse(error.message));
      } else {
        res
          .status(500)
          .json(createErrorResponse("Failed to create system message"));
      }
    }
  }

  // Create chat message notification
  static async createChatNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { toUserId, message, conversationId } = req.body;

      // Validate required fields
      if (!toUserId || !message) {
        res
          .status(400)
          .json(
            createErrorResponse("Missing required fields: toUserId, message")
          );
        return;
      }

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.createChatMessageNotification(
        user.id,
        toUserId,
        message,
        conversationId
      );

      res
        .status(201)
        .json(
          createSuccessResponse(
            result,
            result
              ? "Chat notification created successfully"
              : "Notification skipped - user in active chat"
          )
        );
    } catch (error: any) {
      console.error("Error creating chat notification:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to create chat notification"));
    }
  }

  // Create auth level change notification
  static async createAuthLevelChangeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { targetUserId, fromLevel, toLevel } = req.body;

      // Validate required fields
      if (!targetUserId || !fromLevel || !toLevel) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "Missing required fields: targetUserId, fromLevel, toLevel"
            )
          );
        return;
      }

      const notificationService = this.getNotificationService(req);
      const result =
        await notificationService.createAuthLevelChangeNotification(
          targetUserId,
          user.id,
          fromLevel,
          toLevel
        );

      res
        .status(201)
        .json(
          createSuccessResponse(
            result,
            "Auth level change notification created successfully"
          )
        );
    } catch (error: any) {
      console.error("Error creating auth level change notification:", error);
      res
        .status(500)
        .json(
          createErrorResponse("Failed to create auth level change notification")
        );
    }
  }

  // Get unread notification count
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const notificationService = this.getNotificationService(req);
      const count = await notificationService.getUnreadCount(user.id);

      res
        .status(200)
        .json(
          createSuccessResponse(
            { count },
            "Unread count retrieved successfully"
          )
        );
    } catch (error: any) {
      console.error("Error getting unread count:", error);
      res.status(500).json(createErrorResponse("Failed to get unread count"));
    }
  }

  // Get notification preferences
  static async getNotificationPreferences(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const notificationService = this.getNotificationService(req);
      const preferences = await notificationService.getNotificationPreferences(
        user.id
      );

      res
        .status(200)
        .json(
          createSuccessResponse(
            preferences,
            "Notification preferences retrieved successfully"
          )
        );
    } catch (error: any) {
      console.error("Error getting notification preferences:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to get notification preferences"));
    }
  }

  // Update notification preferences
  static async updateNotificationPreferences(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const preferences = req.body;

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.updateNotificationPreferences(
        user.id,
        preferences
      );

      res
        .status(200)
        .json(
          createSuccessResponse(
            result,
            "Notification preferences updated successfully"
          )
        );
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to update notification preferences"));
    }
  }

  // Get notification analytics
  static async getNotificationAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const notificationService = this.getNotificationService(req);
      const analytics = await notificationService.getNotificationAnalytics(
        user.id
      );

      res
        .status(200)
        .json(
          createSuccessResponse(
            analytics,
            "Notification analytics retrieved successfully"
          )
        );
    } catch (error: any) {
      console.error("Error getting notification analytics:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to get notification analytics"));
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.markAllNotificationsAsRead(
        user.id
      );

      res
        .status(200)
        .json(
          createSuccessResponse(result, "All notifications marked as read")
        );
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to mark all notifications as read"));
    }
  }

  // Create a general notification
  static async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { type, toUserId, title, message, data } = req.body;

      // Validate required fields
      if (!type || !toUserId || !title || !message) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "Missing required fields: type, toUserId, title, message"
            )
          );
        return;
      }

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.createNotification({
        type,
        userId: toUserId,
        category: type.toLowerCase(),
        title,
        message,
        metadata: data || {},
      });

      res
        .status(201)
        .json(
          createSuccessResponse(result, "Notification created successfully")
        );
    } catch (error: any) {
      console.error("Error creating notification:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to create notification"));
    }
  }

  // Delete a notification
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { notificationId } = req.params;

      const notificationService = this.getNotificationService(req);
      await notificationService.deleteNotification(user.id, notificationId);

      res
        .status(200)
        .json(createSuccessResponse(null, "Notification deleted successfully"));
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to delete notification"));
    }
  }

  // Cleanup expired notifications (admin/system task)
  static async cleanupExpiredNotifications(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const notificationService = this.getNotificationService(req);
      const result = await notificationService.cleanupExpiredNotifications();

      res
        .status(200)
        .json(
          createSuccessResponse(
            result,
            "Expired notifications cleaned up successfully"
          )
        );
    } catch (error: any) {
      console.error("Error cleaning up expired notifications:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to cleanup expired notifications"));
    }
  }
}
