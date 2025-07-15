import { Request, Response } from "express";
import InAppNotification, {
  IInAppNotification,
} from "../models/InAppNotification";

export class InAppNotificationController {
  // Get all in-app notifications for current user
  static async getNotifications(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const notifications = await InAppNotification.find({
        userId: user.id,
      })
        .sort({ createdAt: -1 })
        .limit(50); // Limit to latest 50 notifications

      res.status(200).json({
        success: true,
        data: { notifications },
        message: "Notifications retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting in-app notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notifications",
        error: error.message,
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      const notification = await InAppNotification.findOneAndUpdate(
        { _id: notificationId, userId: user.id },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

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

  // Mark all notifications as read
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      await InAppNotification.updateMany(
        { userId: user.id, isRead: false },
        { isRead: true }
      );

      res.status(200).json({
        success: true,
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

  // Delete a specific notification
  static async deleteNotification(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      const notification = await InAppNotification.findOneAndDelete({
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

  // Clear all notifications
  static async clearAllNotifications(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      await InAppNotification.deleteMany({ userId: user.id });

      res.status(200).json({
        success: true,
        message: "All notifications cleared",
      });
    } catch (error: any) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear notifications",
        error: error.message,
      });
    }
  }

  // Create a new in-app notification (for system/admin use)
  static async createNotification(req: Request, res: Response) {
    try {
      const {
        userId,
        type,
        title,
        message,
        fromUser,
        actionType,
        actionDetails,
        data,
      } = req.body;

      const notification = new InAppNotification({
        userId,
        type,
        title,
        message,
        fromUser,
        actionType,
        actionDetails,
        data,
        isRead: false,
      });

      await notification.save();

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

  // Get unread count for current user
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const count = await InAppNotification.countDocuments({
        userId: user.id,
        isRead: false,
      });

      res.status(200).json({
        success: true,
        data: { unreadCount: count },
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
}
