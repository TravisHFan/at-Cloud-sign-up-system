import { Request, Response } from "express";
import { Types } from "mongoose";
import Message from "../models/Message";
import User, { IUser } from "../models/User";
import mongoose from "mongoose";
import { socketService } from "../services/infrastructure/SocketService";

/**
 * Unified Message Controller
 *
 * This controller replaces the previous dual system with a unified approach:
 * - Single Message model handles both system messages and bell notifications
 * - Maintains the same user experience and API endpoints
 * - Simplifies state management and eliminates synchronization issues
 *
 * User Experience Features:
 * - Bell Notifications: Quick dismissible notifications in dropdown
 * - System Messages: Full message management page
 * - Unified state: Reading in either place affects both appropriately
 */

export class UnifiedMessageController {
  // ============================================
  // SYSTEM MESSAGES API (for System Messages Page)
  // ============================================

  /**
   * Get system messages for current user
   * Used by: System Messages page (/dashboard/system-messages)
   */
  static async getSystemMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Build query filters
      const filters: any = {
        isActive: true,
        [`userStates.${userId}`]: { $exists: true }, // Only messages where user exists in userStates
        [`userStates.${userId}.isDeletedFromSystem`]: { $ne: true },
      };

      if (type) {
        filters.type = type;
      }

      // Get messages with pagination
      const skip = (page - 1) * limit;
      const messages = await Message.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalCount = await Message.countDocuments(filters);

      // Transform for frontend
      const transformedMessages = messages.map((message) => {
        const userState = message.getUserState(userId);
        return {
          id: message._id,
          title: message.title,
          content: message.content,
          type: message.type,
          priority: message.priority,
          creator: message.creator,
          createdAt: message.createdAt,
          isRead: userState.isReadInSystem,
          readAt: userState.readInSystemAt,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          messages: transformedMessages,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page * limit < totalCount,
            hasPrev: page > 1,
          },
          unreadCount: transformedMessages.filter((msg) => !msg.isRead).length,
        },
      });
    } catch (error) {
      console.error("Error in getSystemMessages:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Create new system message (Admin only)
   * Automatically creates bell notifications for all users
   */
  static async createSystemMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { title, content, type, priority, targetRoles } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Get creator information
      const creator = await User.findById(userId).select(
        "firstName lastName username avatar gender roleInAtCloud role"
      );

      if (!creator) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Check permissions (non-Participant can create)
      if (creator.role === "Participant") {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to create system messages",
        });
        return;
      }

      // Get all users to initialize states
      const allUsers = await User.find({}, "_id");
      const userIds = allUsers.map((user: any) => user._id.toString()); // Create message with all user states initialized
      const messageData = {
        title,
        content,
        type: type || "announcement",
        priority: priority || "medium",
        creator: {
          id: (creator as any)._id.toString(),
          firstName: creator.firstName,
          lastName: creator.lastName,
          username: creator.username,
          avatar: creator.avatar,
          gender: creator.gender,
          roleInAtCloud: creator.roleInAtCloud,
          authLevel: creator.role, // Using role property from User model
        },
        targetRoles,
        isActive: true,
        createdBy: (creator as any)._id, // Add createdBy field for test compatibility
      };

      const message = await Message.createForAllUsers(messageData, userIds);

      // Emit real-time notification to all users
      const messageForBroadcast = {
        id: message._id,
        title: message.title,
        content: message.content,
        type: message.type,
        priority: message.priority,
        creator: message.creator,
        createdAt: message.createdAt,
      };

      socketService.emitNewSystemMessageToAll(messageForBroadcast);

      // Emit unread count updates to all users since they all received a new message
      for (const userId of userIds) {
        try {
          const updatedCounts = await Message.getUnreadCountsForUser(userId);
          socketService.emitUnreadCountUpdate(userId, updatedCounts);
        } catch (error) {
          console.error(
            `Failed to emit unread count update for user ${userId}:`,
            error
          );
        }
      }

      res.status(201).json({
        success: true,
        message: "System message created successfully",
        data: {
          message: {
            id: message._id,
            title: message.title,
            content: message.content,
            type: message.type,
            priority: message.priority,
            creator: message.creator,
            createdBy: message.createdBy, // Include createdBy in response
            createdAt: message.createdAt,
            recipientCount: userIds.length,
          },
        },
      });
    } catch (error) {
      console.error("Error in createSystemMessage:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Mark system message as read
   * Also marks corresponding bell notification as read for consistency
   */
  static async markSystemMessageAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { messageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({
          success: false,
          message: "Message not found",
        });
        return;
      }

      // Mark as read in both system messages and bell notifications for consistency
      message.markAsReadEverywhere(userId);
      await message.save();

      // Get updated unread counts
      const updatedCounts = await Message.getUnreadCountsForUser(userId);

      // Emit real-time updates
      socketService.emitSystemMessageUpdate(userId, "message_read", {
        messageId: message._id,
        isRead: true,
        readAt: new Date(),
      });

      socketService.emitBellNotificationUpdate(userId, "notification_read", {
        messageId: message._id,
        isRead: true,
        readAt: new Date(),
      });

      // Emit unread count update for real-time bell count updates
      socketService.emitUnreadCountUpdate(userId, updatedCounts);

      res.status(200).json({
        success: true,
        message: "Message marked as read",
      });
    } catch (error) {
      console.error("Error in markSystemMessageAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Delete system message for current user
   * Removes from system messages but keeps in bell notifications unless already removed
   */
  static async deleteSystemMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { messageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({
          success: false,
          message: "Message not found",
        });
        return;
      }

      // Check if message was unread before deletion
      const userState = message.getUserState(userId);
      const wasUnreadInSystem = !userState.isReadInSystem;
      const wasUnreadInBell = !userState.isReadInBell;

      // Delete from system messages view only
      message.deleteFromSystem(userId);
      await message.save();

      // Emit real-time updates
      socketService.emitSystemMessageUpdate(userId, "message_deleted", {
        messageId: message._id,
      });

      // Also emit bell notification update since it affects both views
      socketService.emitBellNotificationUpdate(userId, "notification_removed", {
        messageId: message._id,
      });

      // Update unread counts if the message was unread
      if (wasUnreadInSystem || wasUnreadInBell) {
        const unreadCounts = await Message.getUnreadCountsForUser(userId);
        socketService.emitUnreadCountUpdate(userId, unreadCounts);
      }

      res.status(200).json({
        success: true,
        message: "Message deleted from system messages",
      });
    } catch (error) {
      console.error("Error in deleteSystemMessage:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ============================================
  // BELL NOTIFICATIONS API (for Bell Dropdown)
  // ============================================

  /**
   * Get bell notifications for current user
   * Used by: Bell notification dropdown
   */
  static async getBellNotifications(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Get messages that should appear in bell notifications
      const messages = await Message.find({
        isActive: true,
        [`userStates.${userId}`]: { $exists: true }, // Only messages where user exists in userStates
        [`userStates.${userId}.isRemovedFromBell`]: { $ne: true },
      }).sort({ createdAt: -1 });

      // Transform for bell notification display
      const notifications = messages.map((message) => {
        const userState = message.getUserState(userId);
        return {
          id: message._id,
          title: message.getBellDisplayTitle(),
          content: message.content,
          type: message.type,
          priority: message.priority,
          createdAt: message.createdAt,
          isRead: userState.isReadInBell,
          readAt: userState.readInBellAt,
          showRemoveButton: message.canRemoveFromBell(userId),
          // REQ 4: Include "From" information for bell notifications
          creator: {
            firstName: message.creator.firstName,
            lastName: message.creator.lastName,
            authLevel: message.creator.authLevel,
            roleInAtCloud: message.creator.roleInAtCloud,
          },
        };
      });

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      res.status(200).json({
        success: true,
        data: {
          notifications,
          unreadCount,
        },
      });
    } catch (error) {
      console.error("Error in getBellNotifications:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Mark bell notification as read
   * Also marks corresponding system message as read for consistency
   */
  static async markBellNotificationAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { messageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

      // Mark as read in both bell notifications and system messages for consistency
      message.markAsReadEverywhere(userId);
      await message.save();

      // Get updated unread counts
      const updatedCounts = await Message.getUnreadCountsForUser(userId);

      // Emit real-time updates
      socketService.emitBellNotificationUpdate(userId, "notification_read", {
        messageId: message._id,
        isRead: true,
        readAt: new Date(),
      });

      socketService.emitSystemMessageUpdate(userId, "message_read", {
        messageId: message._id,
        isRead: true,
        readAt: new Date(),
      });

      // Emit unread count update for real-time bell count updates
      socketService.emitUnreadCountUpdate(userId, updatedCounts);

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Error in markBellNotificationAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Mark all bell notifications as read
   */
  static async markAllBellNotificationsAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Find all active messages that are unread in bell notifications
      const messages = await Message.find({
        isActive: true,
        [`userStates.${userId}`]: { $exists: true }, // Only messages where user exists in userStates
        [`userStates.${userId}.isRemovedFromBell`]: { $ne: true },
        [`userStates.${userId}.isReadInBell`]: { $ne: true },
      });

      let markedCount = 0;
      for (const message of messages) {
        message.markAsReadEverywhere(userId);
        await message.save();
        markedCount++;

        // Emit real-time updates for each message
        socketService.emitBellNotificationUpdate(userId, "notification_read", {
          messageId: message._id,
          isRead: true,
          readAt: new Date(),
        });

        socketService.emitSystemMessageUpdate(userId, "message_read", {
          messageId: message._id,
          isRead: true,
          readAt: new Date(),
        });
      }

      // Get updated unread counts after marking all as read
      const updatedCounts = await Message.getUnreadCountsForUser(userId);

      // Emit unread count update for real-time bell count updates
      socketService.emitUnreadCountUpdate(userId, updatedCounts);

      res.status(200).json({
        success: true,
        message: `All bell notifications marked as read`,
        data: {
          markedCount,
        },
      });
    } catch (error) {
      console.error("Error in markAllBellNotificationsAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Remove bell notification
   * Hides from bell dropdown but keeps in system messages
   */
  static async removeBellNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const { messageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

      // Remove from bell notifications only
      message.removeFromBell(userId);
      await message.save();

      // Emit real-time update
      socketService.emitBellNotificationUpdate(userId, "notification_removed", {
        messageId: message._id,
      });

      res.status(200).json({
        success: true,
        message: "Notification removed from bell",
      });
    } catch (error) {
      console.error("Error in removeBellNotification:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Get unread counts for both bell notifications and system messages
   */
  static async getUnreadCounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const counts = await Message.getUnreadCountsForUser(userId);

      res.status(200).json({
        success: true,
        data: counts,
      });
    } catch (error) {
      console.error("Error in getUnreadCounts:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Clean up expired messages
   */
  static async cleanupExpiredMessages(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const now = new Date();

      // Mark expired messages as inactive
      const result = await Message.updateMany(
        {
          isActive: true,
          expiresAt: { $lte: now },
        },
        {
          isActive: false,
        }
      );

      res.status(200).json({
        success: true,
        message: "Expired messages cleaned up",
        data: {
          expiredCount: result.modifiedCount,
        },
      });
    } catch (error) {
      console.error("Error in cleanupExpiredMessages:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Welcome message status check (for onboarding)
   */
  static async checkWelcomeMessageStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const user = await User.findById(userId).select(
        "hasReceivedWelcomeMessage"
      );

      res.status(200).json({
        success: true,
        data: {
          hasReceivedWelcomeMessage: user?.hasReceivedWelcomeMessage || false,
        },
      });
    } catch (error) {
      console.error("Error in checkWelcomeMessageStatus:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Send welcome notification to new user (first login)
   */
  static async sendWelcomeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Check if user already received welcome message
      if (user.hasReceivedWelcomeMessage) {
        res.status(200).json({
          success: true,
          message: "Welcome message already sent",
          data: { alreadySent: true },
        });
        return;
      }

      // Create welcome message for the specific user
      const welcomeMessage = new Message({
        title: "🎉 Welcome to @Cloud Event Management System!",
        content: `Hello ${user.firstName}! Welcome to the @Cloud Event Management System. We're excited to have you join our community! Here you can discover upcoming events, connect with other members, and participate in exciting activities. Feel free to explore the platform and don't hesitate to reach out if you need any assistance. Happy networking!`,
        type: "announcement",
        priority: "high",
        creator: {
          id: "system",
          firstName: "System",
          lastName: "Administrator",
          username: "system",
          gender: "male", // Required field for system messages
          authLevel: "Super Admin",
          roleInAtCloud: "System",
        },
        isActive: true,
        userStates: new Map(),
      });

      // Initialize user state for the target user only
      const userState = {
        isReadInSystem: false,
        isReadInBell: false,
        isRemovedFromBell: false,
        isDeletedFromSystem: false,
        readInSystemAt: undefined,
        readInBellAt: undefined,
        removedFromBellAt: undefined,
        deletedFromSystemAt: undefined,
        lastInteractionAt: undefined,
      };

      welcomeMessage.userStates.set(userId, userState);
      await welcomeMessage.save();

      // Mark user as having received welcome message
      user.hasReceivedWelcomeMessage = true;
      await user.save();

      // Emit real-time notification
      socketService.emitSystemMessageUpdate(userId, "message_created", {
        message: welcomeMessage.toJSON(),
      });

      socketService.emitBellNotificationUpdate(userId, "notification_added", {
        messageId: welcomeMessage._id,
        title: welcomeMessage.getBellDisplayTitle(),
        content: welcomeMessage.content,
        type: welcomeMessage.type,
        priority: welcomeMessage.priority,
        createdAt: welcomeMessage.createdAt,
        isRead: false,
      });

      res.status(201).json({
        success: true,
        message: "Welcome notification sent successfully",
        data: {
          messageId: welcomeMessage._id,
          title: welcomeMessage.title,
          sent: true,
        },
      });
    } catch (error) {
      console.error("Error in sendWelcomeNotification:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send welcome notification",
      });
    }
  }

  /**
   * Create targeted system message for specific users
   * Used for: Co-organizer assignments, role-specific notifications
   */
  static async createTargetedSystemMessage(
    messageData: {
      title: string;
      content: string;
      type?: string;
      priority?: string;
    },
    targetUserIds: string[],
    creator?: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      gender: string;
      authLevel: string;
      roleInAtCloud?: string;
    }
  ): Promise<any> {
    try {
      // Use system creator if none provided
      const messageCreator = creator || {
        id: "system",
        firstName: "System",
        lastName: "Administrator",
        username: "system",
        gender: "male",
        authLevel: "Super Admin",
        roleInAtCloud: "System",
      };

      // Create targeted message
      const targetedMessage = new Message({
        title: messageData.title,
        content: messageData.content,
        type: messageData.type || "assignment",
        priority: messageData.priority || "high",
        creator: messageCreator,
        isActive: true,
        userStates: new Map(),
      });

      // Initialize user states for target users only
      for (const userId of targetUserIds) {
        const userState = {
          isReadInSystem: false,
          isReadInBell: false,
          isRemovedFromBell: false,
          isDeletedFromSystem: false,
          readInSystemAt: undefined,
          readInBellAt: undefined,
          removedFromBellAt: undefined,
          deletedFromSystemAt: undefined,
          lastInteractionAt: undefined,
        };
        targetedMessage.userStates.set(userId, userState);
      }

      await targetedMessage.save();

      // Emit real-time notifications only to target users
      for (const userId of targetUserIds) {
        socketService.emitSystemMessageUpdate(userId, "message_created", {
          message: targetedMessage.toJSON(),
        });

        socketService.emitBellNotificationUpdate(userId, "notification_added", {
          messageId: targetedMessage._id,
          title: targetedMessage.getBellDisplayTitle(),
          content: targetedMessage.content,
          type: targetedMessage.type,
          priority: targetedMessage.priority,
          createdAt: targetedMessage.createdAt,
          isRead: false,
        });

        // Update unread counts for target user
        try {
          const updatedCounts = await Message.getUnreadCountsForUser(userId);
          socketService.emitUnreadCountUpdate(userId, updatedCounts);
        } catch (error) {
          console.error(
            `Failed to emit unread count update for user ${userId}:`,
            error
          );
        }
      }

      return targetedMessage;
    } catch (error) {
      console.error("Error creating targeted system message:", error);
      throw error;
    }
  }

  /**
   * Mark system message as read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user.id;

      if (!Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID" });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      // Use markAsReadEverywhere for auto-sync behavior (REQ 8)
      message.markAsReadEverywhere(userId);
      await message.save();

      res.status(200).json({ message: "Message marked as read" });
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  }

  /**
   * Delete system message for user (soft delete)
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user.id;

      if (!Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ message: "Invalid message ID" });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      // Check if message was unread before deletion
      const userState = message.getUserState(userId);
      const wasUnreadInSystem = !userState.isReadInSystem;
      const wasUnreadInBell = !userState.isReadInBell;

      message.deleteFromSystem(userId);
      await message.save();

      // Emit real-time updates
      socketService.emitSystemMessageUpdate(userId, "message_deleted", {
        messageId: message._id,
      });

      // Also emit bell notification update since it affects both views
      socketService.emitBellNotificationUpdate(userId, "notification_removed", {
        messageId: message._id,
      });

      // Update unread counts if the message was unread
      if (wasUnreadInSystem || wasUnreadInBell) {
        const unreadCounts = await Message.getUnreadCountsForUser(userId);
        socketService.emitUnreadCountUpdate(userId, unreadCounts);
      }

      res.status(200).json({ message: "Message deleted" });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  }

  /**
   * Clean up expired messages
   */
  static async cleanupExpiredItems(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();

      // Find expired messages and mark them as inactive
      const expiredMessages = await Message.updateMany(
        {
          isActive: true,
          expiresAt: { $lt: now },
        },
        {
          $set: { isActive: false },
        }
      );

      res.status(200).json({
        success: true,
        message: "Cleanup completed",
        data: {
          expiredMessages: expiredMessages.modifiedCount,
        },
      });
    } catch (error) {
      console.error("Error cleaning up expired items:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup expired items",
      });
    }
  }
}
