import { Request, Response } from "express";
import { Types } from "mongoose";
import Message from "../models/Message";
import type { IMessage } from "../models/Message";
import User from "../models/User";
import { socketService } from "../services/infrastructure/SocketService";
import { CachePatterns } from "../services";

// Minimal runtime shapes to reduce explicit any usage without changing behavior
type UnreadCounts = {
  bellNotifications: number;
  systemMessages: number;
  total: number;
};

type UserStateRecord = {
  isReadInSystem?: boolean;
  isReadInBell?: boolean;
  isRemovedFromBell?: boolean;
  isDeletedFromSystem?: boolean;
  readInSystemAt?: unknown;
  readInBellAt?: unknown;
  removedFromBellAt?: unknown;
  deletedFromSystemAt?: unknown;
  lastInteractionAt?: unknown;
};

type MessageDocLike = {
  _id: unknown;
  title: string;
  content: string;
  type: string;
  priority: string;
  creator: {
    firstName?: string;
    lastName?: string;
    authLevel?: string;
    roleInAtCloud?: string;
  };
  userStates: Map<string, UserStateRecord> | Record<string, UserStateRecord>;
  createdAt: unknown;
  getBellDisplayTitle?: () => string;
  canRemoveFromBell?: (userId: string) => boolean;
  toJSON?: () => unknown;
  metadata?: unknown;
  hideCreator?: boolean;
  createdBy?: unknown;
  targetUserId?: string;
};

const MessageModel = Message as unknown as {
  getUnreadCountsForUser: (userId: string) => Promise<UnreadCounts>;
};

function getUserState(
  message: MessageDocLike,
  userId: string
): UserStateRecord | undefined {
  const states = message.userStates as MessageDocLike["userStates"] | undefined;
  if (!states) return undefined;
  if (states instanceof Map) {
    return states.get(userId);
  }
  return (states as Record<string, UserStateRecord>)[userId];
}

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

      // Build query filters - Fixed for Mongoose Map compatibility
      const filters: Record<string, unknown> = {
        isActive: true,
        // For Mongoose Maps, we need to query differently
        userStates: { $exists: true },
      };

      if (type) {
        filters.type = type;
      }

      // Get messages with pagination - we'll filter in-memory for Map compatibility
      const skip = (page - 1) * limit;
      const allMessages = await Message.find(filters).sort({ createdAt: -1 });

      console.log(
        `Found ${allMessages.length} total messages for user ${userId}`
      );

      // Filter messages that have the user in userStates and are not deleted
      const userMessages = allMessages.filter((message) => {
        if (!message.userStates) {
          return false;
        }

        // Handle both Map and Object userStates
        let userState;
        if (message.userStates instanceof Map) {
          if (!message.userStates.has(userId)) {
            return false;
          }
          userState = message.userStates.get(userId);
        } else {
          // userStates is a plain object
          if (!message.userStates[userId]) {
            return false;
          }
          userState = message.userStates[userId];
        }

        const hasValidUserState = userState && !userState.isDeletedFromSystem;
        return hasValidUserState;
      });
      console.log(
        `After filtering, found ${userMessages.length} messages for user ${userId}`
      );

      // Apply pagination to filtered results
      const paginatedMessages = userMessages.slice(skip, skip + limit);
      const totalCount = userMessages.length;

      // Transform for frontend
      const transformedMessages = paginatedMessages.map((message) => {
        const m = message as unknown as MessageDocLike;
        const userState = getUserState(m, userId) as
          | UserStateRecord
          | undefined;

        // Infer targetUserId for legacy messages that missed this field
        let targetUserId = m.targetUserId;
        if (
          !targetUserId &&
          (m.type === "auth_level_change" || m.type === "event_role_change")
        ) {
          try {
            const states = m.userStates;
            if (states instanceof Map) {
              if (states.size === 1) {
                const [onlyKey] = Array.from(states.keys());
                targetUserId = onlyKey;
              }
            } else if (states && typeof states === "object") {
              const keys = Object.keys(states as Record<string, unknown>);
              if (keys.length === 1) {
                targetUserId = keys[0];
              }
            }
          } catch (_) {
            // Ignore inference errors; targetUserId will remain undefined
          }
        }

        return {
          id: m._id,
          title: m.title,
          content: m.content,
          type: m.type,
          priority: m.priority,
          // Include metadata so clients can render contextual CTAs (e.g., View Event Details)
          metadata: m.metadata,
          // Hide creator in API response when hideCreator flag is set
          creator: m.hideCreator ? undefined : m.creator,
          targetUserId, // Include targetUserId for frontend filtering (with legacy inference)
          createdAt: m.createdAt,
          isRead: Boolean(userState?.isReadInSystem),
          readAt: userState?.readInSystemAt,
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
            hasNext: skip + limit < totalCount,
            hasPrev: skip > 0,
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
      const { title, content, type, priority, targetRoles, excludeUserIds } =
        req.body as {
          title: string;
          content: string;
          type?: string;
          priority?: string;
          targetRoles?: unknown;
          excludeUserIds?: string[];
        };
      // Determine whether to include creator info in the message presentation
      // Accept both includeCreator (preferred from UI) and hideCreator (for flexibility)
      const includeCreatorFlagRaw = (req.body as Record<string, unknown>)[
        "includeCreator"
      ];
      const hideCreatorFlagRaw = (req.body as Record<string, unknown>)[
        "hideCreator"
      ];
      // Default is to include creator unless explicitly disabled
      const includeCreatorFlag =
        typeof includeCreatorFlagRaw === "boolean"
          ? includeCreatorFlagRaw
          : includeCreatorFlagRaw === "false"
          ? false
          : includeCreatorFlagRaw === "true"
          ? true
          : true;
      const hideCreator =
        typeof hideCreatorFlagRaw === "boolean"
          ? hideCreatorFlagRaw
          : hideCreatorFlagRaw === "true"
          ? true
          : hideCreatorFlagRaw === "false"
          ? false
          : !includeCreatorFlag;

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
      let userIds = allUsers.map((user) =>
        String((user as unknown as { _id: unknown })._id)
      );

      // Exclude specific users if excludeUserIds is provided
      if (excludeUserIds && Array.isArray(excludeUserIds)) {
        userIds = userIds.filter((id) => !excludeUserIds.includes(id));
        console.log(
          `📝 Excluding ${excludeUserIds.length} users from system message`
        );
      } // Create message with all user states initialized
      const messageData = {
        title,
        content,
        type: type || "announcement",
        priority: priority || "medium",
        creator: {
          id: String((creator as unknown as { _id: unknown })._id),
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
        createdBy: (creator as unknown as { _id: unknown })._id, // Add createdBy field for test compatibility
      };

      // ✅ MIGRATED: Using standardized createTargetedSystemMessage pattern
      // ⚠️ DEPRECATED: Message.createForAllUsers pattern
      // 📋 MIGRATION: Replace with UnifiedMessageController.createTargetedSystemMessage
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1
      // 📋 REFACTORING: Replaced deprecated Message.createForAllUsers with direct Message creation
      // 🔗 Reference: TRIO_SYSTEM_REFACTORING_BLUEPRINT.md - Phase 1

      // Create message using standardized pattern (same as createTargetedSystemMessage)
      // Note: We always store creator details for auditability, but respect hideCreator
      // at API and serialization layers so clients won't see creator when hidden.
      const message = new Message({
        title: messageData.title,
        content: messageData.content,
        type: messageData.type,
        priority: messageData.priority,
        creator: messageData.creator,
        hideCreator,
        isActive: true,
        userStates: new Map(),
      });

      // Initialize user states for all target users
      for (const userId of userIds) {
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
        message.userStates.set(userId, userState);
      }

      await message.save();

      // Invalidate user caches for message recipients
      for (const userId of userIds) {
        await CachePatterns.invalidateUserCache(userId);
      }

      // Emit real-time notifications to target users (standardized pattern)
      for (const userId of userIds) {
        socketService.emitSystemMessageUpdate(userId, "message_created", {
          message: message.toJSON(),
        });

        // ✅ REMOVED: Redundant bell_notification_update emission
        // Bell notifications are now created by frontend from system_message_update events
        // This eliminates duplicate processing and simplifies the architecture

        console.log(
          `🔔 Emitted system_message_update for user ${userId}: "${message.getBellDisplayTitle()}"`
        );

        // Update unread counts for target user
        try {
          const updatedCounts = await MessageModel.getUnreadCountsForUser(
            userId
          );
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
            // Hide creator in immediate response if requested
            creator: (message as unknown as MessageDocLike).hideCreator
              ? undefined
              : (message as unknown as MessageDocLike).creator,
            hideCreator: (message as unknown as MessageDocLike).hideCreator,
            createdBy: message.createdBy, // Include createdBy in response
            createdAt: message.createdAt,
            recipientCount: userIds.length,
          },
        },
      });
    } catch (error) {
      console.error("Error in createSystemMessage:", error);

      // Handle validation errors with appropriate status code
      if (error instanceof Error && error.name === "ValidationError") {
        res.status(400).json({
          success: false,
          message: "Title and content are required",
        });
        return;
      }

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

      // Invalidate user cache after message read
      await CachePatterns.invalidateUserCache(userId);

      // Get updated unread counts
      const updatedCounts = await MessageModel.getUnreadCountsForUser(userId);

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

      // Invalidate user cache after message deletion
      await CachePatterns.invalidateUserCache(userId);

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
        const unreadCounts = await MessageModel.getUnreadCountsForUser(userId);
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

      // Get messages that should appear in bell notifications - Fixed for Mongoose Map compatibility
      const allMessages = await Message.find({
        isActive: true,
        userStates: { $exists: true },
      }).sort({ createdAt: -1 });

      // Filter messages that have the user in userStates and are not removed from bell
      const userMessages = allMessages.filter((message) => {
        if (!message.userStates) {
          return false;
        }

        // Handle both Map and Object userStates
        let userState;
        if (message.userStates instanceof Map) {
          if (!message.userStates.has(userId)) {
            return false;
          }
          userState = message.userStates.get(userId);
        } else {
          // userStates is a plain object
          if (!message.userStates[userId]) {
            return false;
          }
          userState = message.userStates[userId];
        }

        return userState && !userState.isRemovedFromBell;
      });

      // Transform for bell notification display
      const notifications = userMessages.map((message) => {
        const m = message as unknown as MessageDocLike;
        const userState = getUserState(m, userId) as
          | UserStateRecord
          | undefined;
        return {
          id: m._id,
          title: m.getBellDisplayTitle ? m.getBellDisplayTitle() : m.title,
          content: m.content,
          type: m.type,
          priority: m.priority,
          createdAt: m.createdAt,
          isRead: Boolean(userState?.isReadInBell),
          readAt: userState?.readInBellAt,
          showRemoveButton: m.canRemoveFromBell
            ? m.canRemoveFromBell(userId)
            : true,
          // REQ 4: Include "From" information for bell notifications
          creator: {
            firstName: m.creator.firstName,
            lastName: m.creator.lastName,
            authLevel: m.creator.authLevel,
            roleInAtCloud: m.creator.roleInAtCloud,
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

      // Invalidate user cache after bell notification read
      await CachePatterns.invalidateUserCache(userId);

      // Get updated unread counts
      const updatedCounts = await MessageModel.getUnreadCountsForUser(userId);

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
        // Only mark as read in BELL, do not change System Messages read state
        message.markAsReadInBell(userId);
        await message.save();
        markedCount++;

        // Emit real-time updates for bell notifications only
        socketService.emitBellNotificationUpdate(userId, "notification_read", {
          messageId: message._id,
          isRead: true,
          readAt: new Date(),
        });
      }

      // Invalidate user cache after marking all as read
      if (markedCount > 0) {
        await CachePatterns.invalidateUserCache(userId);
      }

      // Get updated unread counts after marking all as read
      const updatedCounts = await MessageModel.getUnreadCountsForUser(userId);

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

      // Invalidate user cache after bell notification removal
      await CachePatterns.invalidateUserCache(userId);

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

      const counts = await MessageModel.getUnreadCountsForUser(userId);

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

      // Invalidate all user sessions cache since we can't determine which users were affected
      if (result.modifiedCount > 0) {
        await CachePatterns.invalidateAllUserCaches();
      }

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
        hideCreator: true,
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

      // Invalidate user cache after welcome message creation
      await CachePatterns.invalidateUserCache(userId);

      // Mark user as having received welcome message
      user.hasReceivedWelcomeMessage = true;
      await user.save();

      // Emit real-time notification
      socketService.emitSystemMessageUpdate(userId, "message_created", {
        message: welcomeMessage.toJSON(),
      });

      // ✅ REMOVED: Redundant bell_notification_update emission
      // Bell notifications are now created by frontend from system_message_update events
      // This eliminates duplicate processing and simplifies the architecture

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
      hideCreator?: boolean;
      metadata?: Record<string, unknown>;
    },
    targetUserIds: string[],
    creator?: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      avatar?: string;
      gender: string;
      authLevel: string;
      roleInAtCloud?: string;
    }
  ): Promise<IMessage> {
    try {
      // Use system creator if none provided
      const messageCreator = creator || {
        id: "system",
        firstName: "System",
        lastName: "Administrator",
        username: "system",
        avatar: "/default-avatar-male.jpg", // System default avatar
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
        hideCreator: messageData.hideCreator === true,
        creator: messageCreator,
        isActive: true,
        metadata: messageData.metadata,
        // For single-recipient messages that target specific users, persist the target for frontend filtering
        targetUserId:
          (messageData.type === "auth_level_change" ||
            messageData.type === "event_role_change") &&
          targetUserIds.length === 1
            ? targetUserIds[0]
            : undefined,
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

      // Invalidate user caches for targeted message recipients
      for (const userId of targetUserIds) {
        await CachePatterns.invalidateUserCache(userId);
      }

      // Emit real-time notifications only to target users
      for (const userId of targetUserIds) {
        socketService.emitSystemMessageUpdate(userId, "message_created", {
          message: {
            ...targetedMessage.toJSON(),
            metadata: targetedMessage.metadata,
          },
        });

        // ✅ REMOVED: Redundant bell_notification_update emission
        // Bell notifications are now created by frontend from system_message_update events
        // This eliminates duplicate processing and simplifies the architecture

        console.log(
          `🔔 Emitted system_message_update for user ${userId}: "${targetedMessage.getBellDisplayTitle()}"`
        );

        // Update unread counts for target user
        try {
          const updatedCounts = await MessageModel.getUnreadCountsForUser(
            userId
          );
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
      const userId = (req as unknown as { user: { id: string } }).user.id;

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
      const userId = (req as unknown as { user: { id: string } }).user.id;

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
        const unreadCounts = await MessageModel.getUnreadCountsForUser(userId);
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
