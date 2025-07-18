import { Request, Response } from "express";
import { User, SystemMessage } from "../models";
import mongoose from "mongoose";

/**
 * User-Centric Notification Controller
 *
 * This controller manages notifications and system messages stored directly in the user document.
 * This approach provides better data isolation, performance, and scalability compared to
 * cross-collection queries.
 *
 * Benefits:
 * - Perfect data isolation: Each user only accesses their own data
 * - Improved performance: No cross-user queries needed
 * - Better scalability: User data grows linearly, not exponentially
 * - Enhanced privacy: No exposure to other users' data
 * - Easier caching: User-specific data can be cached independently
 */
export class UserNotificationController {
  // ===== BELL NOTIFICATIONS =====

  /**
   * Get all bell notifications for the current user
   * MIGRATED: Now uses the same logic as System 1 (/system-messages/bell-notifications)
   */
  static async getBellNotifications(
    req: Request,
    res: Response
  ): Promise<Response | void> {
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

      // MIGRATION: Use same logic as SystemMessageController.getBellNotifications
      const userId = user.id;

      const foundUser = await User.findById(userId).select(
        "bellNotificationStates"
      );
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get system messages for user's bell notifications
      const messageIds = foundUser.bellNotificationStates
        .filter((state: any) => !state.isRemoved)
        .map((state: any) => state.messageId);

      const systemMessages = await SystemMessage.find({
        _id: { $in: messageIds },
        isActive: true,
      }).sort({ createdAt: -1 });

      // Combine with user states
      let notifications = systemMessages.map((message: any) => {
        const userState = foundUser.bellNotificationStates.find(
          (state: any) => state.messageId === message._id.toString()
        );

        return {
          id: message._id.toString(),
          _id: message._id.toString(), // Keep both for compatibility
          title: `From ${message.creator.firstName} ${message.creator.lastName}, ${message.creator.authLevel}`,
          message: message.content, // Map content to message for frontend compatibility
          content: message.content,
          type: message.type,
          category: "system", // Default category for compatibility
          priority: message.priority,
          createdAt: message.createdAt,
          expiresAt: message.expiresAt,
          // User-specific state
          isRead: userState?.isRead || false,
          readAt: userState?.readAt,
          showRemoveButton: userState?.isRead || false,
        };
      });

      // Apply filters (same as before but adapted to new structure)
      if (type && type !== "system") {
        notifications = notifications.filter((n: any) => n.type === type);
      }
      if (isRead !== undefined) {
        const isReadBool = isRead === "true";
        notifications = notifications.filter(
          (n: any) => n.isRead === isReadBool
        );
      }
      if (priority) {
        notifications = notifications.filter(
          (n: any) => n.priority === priority
        );
      }

      // Filter out expired notifications
      const now = new Date();
      notifications = notifications.filter(
        (n: any) => !n.expiresAt || new Date(n.expiresAt) > now
      );

      // Pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      const totalCount = notifications.length;
      const paginatedNotifications = notifications.slice(skip, skip + limitNum);

      // Calculate unread count
      const unreadCount = notifications.filter((n: any) => !n.isRead).length;

      res.status(200).json({
        success: true,
        data: {
          notifications: paginatedNotifications,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            hasNext: skip + paginatedNotifications.length < totalCount,
            hasPrev: pageNum > 1,
          },
          unreadCount,
        },
      });
    } catch (error) {
      console.error("Error in getBellNotifications:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  /**
   * Mark a bell notification as read
   */
  static async markBellNotificationAsRead(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
      }

      const foundUser = await User.findById(user.id);
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const success = foundUser.markBellNotificationAsRead(notificationId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      await foundUser.save();

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Error in markBellNotificationAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  /**
   * Delete a bell notification
   */
  static async deleteBellNotification(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const user = (req as any).user;
      const { notificationId } = req.params;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: "Notification ID is required",
        });
      }

      const foundUser = await User.findById(user.id);
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const success = foundUser.removeBellNotification(notificationId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      await foundUser.save();

      res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteBellNotification:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  /**
   * Mark all bell notifications as read
   */
  static async markAllBellNotificationsAsRead(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const user = (req as any).user;

      const foundUser = await User.findById(user.id);
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const markedCount = foundUser.markAllBellNotificationsAsRead();
      await foundUser.save();

      res.status(200).json({
        success: true,
        message: `Marked ${markedCount} notifications as read`,
        data: {
          markedCount,
        },
      });
    } catch (error) {
      console.error("Error in markAllBellNotificationsAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  // ===== SYSTEM MESSAGES =====

  /**
   * Get all system messages for the current user (Legacy endpoint)
   * @deprecated Use /api/v1/system-messages endpoint instead
   */
  static async getSystemMessages(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      // For backward compatibility, return empty array
      // New system messages should use /api/v1/system-messages endpoint
      res.status(200).json({
        success: true,
        message:
          "Please use /api/v1/system-messages endpoint for system messages",
        data: {
          systemMessages: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false,
          },
          unreadCount: 0,
        },
      });
    } catch (error) {
      console.error("Error in getSystemMessages:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  /**
   * Mark a system message as read
   */
  static async markSystemMessageAsRead(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const user = (req as any).user;
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: "Message ID is required",
        });
      }

      const foundUser = await User.findById(user.id);
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const success = foundUser.markSystemMessageAsRead(messageId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: "System message not found",
        });
      }

      await foundUser.save();

      res.status(200).json({
        success: true,
        message: "System message marked as read",
      });
    } catch (error) {
      console.error("Error in markSystemMessageAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  // ===== UTILITY ENDPOINTS =====

  /**
   * Get unread counts for both notifications and system messages
   */
  static async getUnreadCounts(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const user = (req as any).user;

      const foundUser = await User.findById(user.id)
        .select("bellNotifications systemMessageStates bellNotificationStates")
        .lean();

      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const now = new Date();

      // Count unread bell notifications (excluding expired)
      const bellUnread = (foundUser.bellNotifications || []).filter(
        (n: any) => !n.isRead && (!n.expiresAt || new Date(n.expiresAt) > now)
      ).length;

      // Count unread system message states (hybrid architecture)
      const systemUnread = (foundUser.systemMessageStates || []).filter(
        (state: any) => !state.isRead && !state.isDeleted
      ).length;

      res.status(200).json({
        success: true,
        data: {
          bellNotifications: bellUnread,
          systemMessages: systemUnread,
          total: bellUnread + systemUnread,
        },
      });
    } catch (error) {
      console.error("Error in getUnreadCounts:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }

  /**
   * Clean up expired notifications and messages
   */
  static async cleanupExpiredItems(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const user = (req as any).user;

      const foundUser = await User.findById(user.id);
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const result = foundUser.cleanupExpiredItems();
      await foundUser.save();

      res.status(200).json({
        success: true,
        message: "Cleanup completed",
        data: result,
      });
    } catch (error) {
      console.error("Error in cleanupExpiredItems:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  }
}

/**
 * Notification Service Functions
 *
 * These functions are used by other parts of the application to send notifications
 * and system messages to users.
 */
export class NotificationService {
  /**
   * Send a bell notification to a specific user
   */
  static async sendBellNotificationToUser(
    userId: string,
    notificationData: {
      type: "SYSTEM_MESSAGE" | "EVENT_NOTIFICATION" | "USER_ACTION";
      category:
        | "registration"
        | "reminder"
        | "cancellation"
        | "update"
        | "system"
        | "marketing"
        | "role_change"
        | "announcement";
      title: string;
      message: string;
      priority?: "low" | "normal" | "high" | "urgent";
      metadata?: any;
      fromUser?: any;
      expiresAt?: Date;
      deliveryChannels?: ("in-app" | "email" | "push" | "sms")[];
    }
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User not found: ${userId}`);
        return false;
      }

      user.addBellNotification({
        id: new mongoose.Types.ObjectId().toString(),
        ...notificationData,
        deliveryChannels: notificationData.deliveryChannels || ["in-app"],
        deliveryStatus: "delivered",
        deliveredAt: new Date(),
      });

      await user.save();

      return true;
    } catch (error) {
      console.error(
        `Error sending bell notification to user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Send a system message to a specific user
   */
  static async sendSystemMessageToUser(
    userId: string,
    messageData: {
      title: string;
      content: string;
      type:
        | "announcement"
        | "maintenance"
        | "update"
        | "warning"
        | "auth_level_change";
      priority?: "low" | "medium" | "high";
      creator?: any;
      expiresAt?: Date;
      originalMessageId?: string;
    }
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User not found: ${userId}`);
        return false;
      }

      // This method is deprecated - use SystemMessageController instead
      console.log(
        `Deprecated: sendSystemMessageToUser called for user ${userId}`
      );
      console.log("Use SystemMessageController.createSystemMessage instead");

      return false; // Return false to indicate deprecated usage
    } catch (error) {
      console.error(`Error sending system message to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send a system message to all users (broadcast)
   */
  static async broadcastSystemMessage(messageData: {
    title: string;
    content: string;
    type: "announcement" | "maintenance" | "update" | "warning";
    priority?: "low" | "medium" | "high";
    creator?: any;
    expiresAt?: Date;
  }): Promise<{ success: number; failed: number }> {
    try {
      const originalMessageId = new mongoose.Types.ObjectId().toString();
      let success = 0;
      let failed = 0;

      // Process users in batches to avoid memory issues
      const batchSize = 100;
      let skip = 0;

      while (true) {
        const users = await User.find({ isActive: true })
          .select("_id")
          .skip(skip)
          .limit(batchSize)
          .lean();

        if (users.length === 0) break;

        const updatePromises = users.map(async (user) => {
          try {
            await User.findByIdAndUpdate(user._id, {
              $push: {
                systemMessages: {
                  $each: [
                    {
                      id: new mongoose.Types.ObjectId().toString(),
                      ...messageData,
                      originalMessageId,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      isRead: false,
                      isActive: true,
                    },
                  ],
                  $position: 0, // Add to beginning of array
                },
              },
            });
            return true;
          } catch (error) {
            console.error(
              `Failed to send system message to user ${user._id}:`,
              error
            );
            return false;
          }
        });

        const results = await Promise.all(updatePromises);
        success += results.filter(Boolean).length;
        failed += results.filter((r) => !r).length;

        skip += batchSize;
      }

      return { success, failed };
    } catch (error) {
      console.error("Error broadcasting system message:", error);
      return { success: 0, failed: -1 };
    }
  }
}
