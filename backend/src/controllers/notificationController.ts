import { Request, Response } from "express";
import Notification, { INotification } from "../models/Notification";
import { User, IUser } from "../models";

export class NotificationController {
  // Get all notifications for current user
  static async getNotifications(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const notifications = await Notification.find({
        recipient: user.id,
      })
        .sort({ createdAt: -1 })
        .populate("data.eventId", "title date time location")
        .populate("data.registrationId", "eventId status");

      res.status(200).json({
        success: true,
        data: { notifications },
        message: "Notifications retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting notifications:", error);
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

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: user.id },
        {
          status: "read",
          readAt: new Date(),
        },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: { notification },
        message: "Notification marked as read",
      });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json({
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
      await Notification.updateMany(
        { recipient: user.id, status: { $ne: "read" } },
        {
          status: "read",
          readAt: new Date(),
        }
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

  // Delete notification
  static async deleteNotification(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: user.id,
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      return res.status(500).json({
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
      await Notification.deleteMany({ recipient: user.id });

      res.status(200).json({
        success: true,
        message: "All notifications cleared successfully",
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

  // Create notification (admin functionality)
  static async createNotification(req: Request, res: Response) {
    try {
      const {
        type,
        title,
        message,
        userId,
        eventId,
        actionUrl,
        priority,
        expiresAt,
        metadata,
      } = req.body;

      // If userId is provided, send to specific user
      // Otherwise, send to all users
      let recipients: string[] = [];

      if (userId) {
        recipients = [userId];
      } else {
        const users = await User.find({ isActive: true }, "_id");
        recipients = users.map((user: any) => user._id.toString());
      }

      const notifications = await Promise.all(
        recipients.map((recipientId) =>
          Notification.create({
            recipient: recipientId,
            type: type || "in-app",
            category: "system",
            title,
            message,
            data: {
              eventId,
              actionUrl,
              additionalInfo: metadata,
            },
            priority: priority || "normal",
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          })
        )
      );

      // Broadcast notifications via Socket.IO for real-time updates
      const socketManager = (req as any).app.get("socketManager");
      if (socketManager) {
        notifications.forEach((notification) => {
          socketManager.sendNotificationToUser(
            notification.recipient.toString(),
            {
              _id: notification._id,
              type: notification.type,
              category: notification.category,
              title: notification.title,
              message: notification.message,
              data: notification.data,
              priority: notification.priority,
              status: notification.status,
              createdAt: notification.createdAt,
              expiresAt: notification.expiresAt,
            }
          );
        });
      }

      res.status(201).json({
        success: true,
        data: {
          count: notifications.length,
          notifications: notifications.slice(0, 5), // Return first 5 for reference
        },
        message: `Notification sent to ${notifications.length} users`,
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

  // Send bulk notifications (admin functionality)
  static async sendBulkNotification(req: Request, res: Response) {
    try {
      const {
        type,
        title,
        message,
        userIds,
        roleFilter,
        eventId,
        actionUrl,
        priority,
        expiresAt,
        metadata,
      } = req.body;

      let recipients: string[] = [];

      if (userIds && Array.isArray(userIds)) {
        recipients = userIds;
      } else if (roleFilter) {
        const users = await User.find(
          {
            role: roleFilter,
            isActive: true,
          },
          "_id"
        );
        recipients = users.map((user: any) => user._id.toString());
      } else {
        const users = await User.find({ isActive: true }, "_id");
        recipients = users.map((user: any) => user._id.toString());
      }

      const notifications = await Promise.all(
        recipients.map((recipientId) =>
          Notification.create({
            recipient: recipientId,
            type: type || "in-app",
            category: "system",
            title,
            message,
            data: {
              eventId,
              actionUrl,
              additionalInfo: metadata,
            },
            priority: priority || "normal",
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          })
        )
      );

      res.status(201).json({
        success: true,
        data: { count: notifications.length },
        message: `Bulk notification sent to ${notifications.length} users`,
      });
    } catch (error: any) {
      console.error("Error sending bulk notification:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send bulk notification",
        error: error.message,
      });
    }
  }

  // Get notification settings (placeholder)
  static async getNotificationSettings(req: Request, res: Response) {
    try {
      // For now, return default settings
      // In a real app, you'd store these in the User model or separate NotificationSettings model
      const settings = {
        emailNotifications: true,
        pushNotifications: true,
        eventReminders: true,
        chatNotifications: true,
        systemMessages: true,
      };

      res.status(200).json({
        success: true,
        data: { settings },
        message: "Notification settings retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting notification settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get notification settings",
        error: error.message,
      });
    }
  }

  // Update notification settings (placeholder)
  static async updateNotificationSettings(req: Request, res: Response) {
    try {
      const settings = req.body;

      // For now, just return the settings
      // In a real app, you'd update the User model or separate NotificationSettings model

      res.status(200).json({
        success: true,
        data: { settings },
        message: "Notification settings updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update notification settings",
        error: error.message,
      });
    }
  }

  // Email notification endpoints (integration with frontend email service)
  static async sendEventCreatedEmail(req: Request, res: Response) {
    try {
      const { eventData, excludeEmail } = req.body;

      // Get all users except the organizer
      const users = await User.find(
        {
          isActive: true,
          email: { $ne: excludeEmail },
        },
        "email firstName lastName"
      );

      // Create in-app notifications for all users
      const notifications = await Promise.all(
        users.map((user: IUser) =>
          Notification.create({
            recipient: user._id,
            type: "in-app",
            category: "update",
            title: `New Event: ${eventData.eventTitle}`,
            message: `${eventData.organizerName} has created a new event "${eventData.eventTitle}" on ${eventData.eventDate}`,
            data: {
              eventId: eventData.eventId,
              actionUrl: `/dashboard/upcoming`,
              additionalInfo: eventData,
            },
            priority: "normal",
          })
        )
      );

      // Here you would integrate with your email service
      // For now, we'll just log it
      console.log(
        `Event created email would be sent to ${users.length} users for event: ${eventData.eventTitle}`
      );

      res.status(200).json({
        success: true,
        data: { notificationCount: notifications.length },
        message: "Event created notifications sent successfully",
      });
    } catch (error: any) {
      console.error("Error sending event created notifications:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send event created notifications",
        error: error.message,
      });
    }
  }

  static async sendEventReminderEmail(req: Request, res: Response) {
    try {
      const { eventId } = req.body;

      // Here you would:
      // 1. Find all users registered for the event
      // 2. Send email reminders
      // 3. Create in-app notifications

      console.log(`Event reminder would be sent for event: ${eventId}`);

      res.status(200).json({
        success: true,
        message: "Event reminder scheduled successfully",
      });
    } catch (error: any) {
      console.error("Error sending event reminder:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send event reminder",
        error: error.message,
      });
    }
  }
}
