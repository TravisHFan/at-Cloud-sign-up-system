import { Request, Response } from "express";
import UnifiedNotification, {
  IUnifiedNotification,
} from "../models/UnifiedNotification";
import { User } from "../models";

export class UnifiedNotificationController {
  // Get all notifications for current user with filtering
  static async getNotifications(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const {
        type,
        category,
        isRead,
        priority,
        page = 1,
        limit = 50,
      } = req.query;

      // Build filter query
      const filter: any = { userId: user.id };

      if (type) filter.type = type;
      if (category) filter.category = category;
      if (isRead !== undefined) filter.isRead = isRead === "true";
      if (priority) filter.priority = priority;

      // Add expiration filter - don't show expired notifications
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ];

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const notifications = await UnifiedNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .lean();

      const totalCount = await UnifiedNotification.countDocuments(filter);
      const unreadCount = await UnifiedNotification.countDocuments({
        userId: user.id,
        isRead: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      res.status(200).json({
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: parseInt(page as string),
            totalPages: Math.ceil(totalCount / parseInt(limit as string)),
            totalCount,
            hasNext: skip + notifications.length < totalCount,
            hasPrev: parseInt(page as string) > 1,
          },
          unreadCount,
        },
        message: "Notifications retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting unified notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notifications",
        error: error.message,
      });
    }
  }

  // Mark single notification as read
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      const notification = await UnifiedNotification.findOne({
        _id: notificationId,
        userId: user.id,
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

      await notification.markAsRead();

      res.status(200).json({
        success: true,
        data: { notification },
        message: "Notification marked as read",
      });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark notification as read",
        error: error.message,
      });
    }
  }

  // Mark all notifications as read for user
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const result = await UnifiedNotification.markAllAsReadForUser(user.id);

      res.status(200).json({
        success: true,
        data: { modifiedCount: result.modifiedCount },
        message: "All notifications marked as read",
      });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark all notifications as read",
        error: error.message,
      });
    }
  }

  // Get unread count only
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const unreadCount = await UnifiedNotification.getUnreadCountForUser(
        user.id
      );

      res.status(200).json({
        success: true,
        data: { unreadCount },
        message: "Unread count retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting unread count:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get unread count",
        error: error.message,
      });
    }
  }

  // Create a new notification (internal use)
  static async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        type,
        category,
        title,
        message,
        priority = "normal",
        metadata = {},
        deliveryChannels = ["in-app"],
        expiresAt,
        scheduledFor,
      } = req.body;

      // Validate required fields
      if (!userId || !type || !category || !title || !message) {
        res.status(400).json({
          success: false,
          message:
            "Missing required fields: userId, type, category, title, message",
        });
        return;
      }

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      const notification = new UnifiedNotification({
        userId,
        type,
        category,
        title,
        message,
        priority,
        metadata,
        deliveryChannels,
        expiresAt,
        scheduledFor,
      });

      await notification.save();

      // Mark as delivered immediately for in-app notifications
      if (deliveryChannels.includes("in-app")) {
        await notification.markAsDelivered();
      }

      // Emit real-time notification via Socket.IO
      const socketManager = (req as any).app.get("socketManager");
      if (socketManager) {
        socketManager.sendNotificationToUser(userId, {
          id: notification._id,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
        });
      }

      res.status(201).json({
        success: true,
        data: { notification },
        message: "Notification created successfully",
      });
    } catch (error: any) {
      console.error("Error creating notification:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create notification",
        error: error.message,
      });
    }
  }

  // Delete notification (admin or user)
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      const notification = await UnifiedNotification.findOneAndDelete({
        _id: notificationId,
        userId: user.id,
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete notification",
        error: error.message,
      });
    }
  }

  // Cleanup expired notifications (maintenance endpoint)
  static async cleanupExpired(req: Request, res: Response) {
    try {
      const result = await UnifiedNotification.cleanupExpiredNotifications();

      res.status(200).json({
        success: true,
        data: { deletedCount: result.deletedCount },
        message: "Expired notifications cleaned up successfully",
      });
    } catch (error: any) {
      console.error("Error cleaning up expired notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup expired notifications",
        error: error.message,
      });
    }
  }

  // Get notification statistics
  static async getStats(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const stats = await UnifiedNotification.aggregate([
        { $match: { userId: user.id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
            byType: {
              $push: {
                type: "$type",
                isRead: "$isRead",
              },
            },
            byPriority: {
              $push: {
                priority: "$priority",
                isRead: "$isRead",
              },
            },
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: {
          stats: stats[0] || {
            total: 0,
            unread: 0,
            byType: [],
            byPriority: [],
          },
        },
        message: "Notification statistics retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting notification stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notification statistics",
        error: error.message,
      });
    }
  }
}
