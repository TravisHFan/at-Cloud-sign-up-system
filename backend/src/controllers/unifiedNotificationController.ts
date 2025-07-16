import { Request, Response } from "express";
import { NotificationService } from "../services/business/notificationService";
import {
  ApiResponse,
  AuthenticatedRequest,
  parsePaginationParams,
  createErrorResponse,
  createSuccessResponse,
} from "../types/api";
import { AuthUtils } from "../utils/authUtils";
import { ValidationUtils } from "../utils/validationUtils";

export class UnifiedNotificationController {
  // Get all notifications for current user with filtering
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      // Parse pagination and filter parameters
      const { page, limit } = parsePaginationParams(req);
      const { type, category, isRead, priority } = req.query;

      const filters = {
        type: type as string,
        category: category as string,
        isRead:
          isRead === "true" ? true : isRead === "false" ? false : undefined,
        priority: priority as string,
        page,
        limit,
      };

      const result = await NotificationService.getNotifications(
        user.id,
        filters
      );

      const response = createSuccessResponse(
        {
          notifications: result.notifications,
          unreadCount: result.unreadCount,
        },
        "Notifications retrieved successfully",
        {
          currentPage: result.pagination.currentPage,
          totalPages: result.pagination.totalPages,
          totalItems: result.totalCount,
          hasNext: result.pagination.hasNext,
          hasPrev: result.pagination.hasPrev,
        }
      );

      res.status(200).json(response);
    } catch (error: any) {
      console.error("Error getting notifications:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve notifications"));
    }
  }

  // Mark notification as read
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { notificationId } = req.params;

      // Validate notification ID format
      const { isValid: isValidId, error } = AuthUtils.validateObjectId(
        notificationId,
        "notification ID"
      );
      if (!isValidId) {
        res.status(400).json(createErrorResponse(error!, 400));
        return;
      }

      // Mark notification as read
      const Notification = (await import("../models/Notification")).default;
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: user.id },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        res
          .status(404)
          .json(createErrorResponse("Notification not found", 404));
        return;
      }

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

  // Mark all notifications as read
  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const result = await NotificationService.markAllAsRead(user.id);

      res
        .status(200)
        .json(
          createSuccessResponse(
            { markedAsRead: result.modifiedCount },
            `Successfully marked ${result.modifiedCount} notifications as read`
          )
        );
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to mark all notifications as read"));
    }
  }

  // Get unread count
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const unreadCount = await NotificationService.getUnreadCount(user.id);

      res
        .status(200)
        .json(
          createSuccessResponse(
            { unreadCount },
            "Unread count retrieved successfully"
          )
        );
    } catch (error: any) {
      console.error("Error getting unread count:", error);
      res.status(500).json(createErrorResponse("Failed to get unread count"));
    }
  }

  // Create a new notification (admin/system use)
  static async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      // TODO: Add admin role check

      const {
        targetUserId,
        type,
        category,
        title,
        message,
        priority,
        metadata,
        deliveryChannels,
        expiresAt,
        scheduledFor,
      } = req.body;

      // Validate required fields
      const { isValid: validInput, missingFields } =
        ValidationUtils.validateRequiredFields(req, res, [
          "type",
          "category",
          "title",
          "message",
        ]);

      if (!validInput) {
        return; // Response already sent by validateRequiredFields
      }

      // Create notification
      const notification = await NotificationService.createNotification({
        userId: targetUserId || user.id,
        type,
        category,
        title,
        message,
        priority,
        metadata,
        deliveryChannels,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      });

      res
        .status(201)
        .json(
          createSuccessResponse(
            { notification },
            "Notification created successfully"
          )
        );
    } catch (error: any) {
      console.error("Error creating notification:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to create notification"));
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

      const preferences = await NotificationService.getNotificationPreferences(
        user.id
      );

      res
        .status(200)
        .json(
          createSuccessResponse(
            { preferences },
            "Notification preferences retrieved successfully"
          )
        );
    } catch (error: any) {
      console.error("Error getting notification preferences:", error);
      res
        .status(500)
        .json(
          createErrorResponse("Failed to retrieve notification preferences")
        );
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

      const updates = req.body;

      // Validate preference structure
      if (typeof updates !== "object" || updates === null) {
        res
          .status(400)
          .json(createErrorResponse("Invalid preferences format", 400));
        return;
      }

      const preferences =
        await NotificationService.updateNotificationPreferences(
          user.id,
          updates
        );

      res
        .status(200)
        .json(
          createSuccessResponse(
            { preferences },
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

      const { startDate, endDate } = req.query;

      // Default to last 30 days if no range provided
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate
        ? new Date(startDate as string)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const analytics = await NotificationService.getNotificationAnalytics(
        user.id,
        { start, end }
      );

      res
        .status(200)
        .json(
          createSuccessResponse(
            { analytics, timeRange: { start, end } },
            "Notification analytics retrieved successfully"
          )
        );
    } catch (error: any) {
      console.error("Error getting notification analytics:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve notification analytics"));
    }
  }

  // Delete/hide notification
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { user, isValid } = AuthUtils.validateAuth(req, res);
      if (!isValid) return;

      const { notificationId } = req.params;

      // Validate notification ID format
      const { isValid: isValidId, error } = AuthUtils.validateObjectId(
        notificationId,
        "notification ID"
      );
      if (!isValidId) {
        res.status(400).json(createErrorResponse(error!, 400));
        return;
      }

      // Delete notification (only for the user)
      const Notification = (await import("../models/Notification")).default;
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        userId: user.id,
      });

      if (!notification) {
        res
          .status(404)
          .json(createErrorResponse("Notification not found", 404));
        return;
      }

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

      // TODO: Add admin role check

      const result = await NotificationService.cleanupExpiredNotifications();

      res
        .status(200)
        .json(
          createSuccessResponse(
            { deletedCount: result.deletedCount },
            `Successfully cleaned up ${result.deletedCount} expired notifications`
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
