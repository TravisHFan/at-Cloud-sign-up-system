import { Request, Response } from "express";
import Message from "../../models/Message";
import type { IMessage } from "../../models/Message";
import User from "../../models/User";
import { socketService } from "../../services/infrastructure/SocketService";
import { CachePatterns } from "../../services/infrastructure/CacheService";

// Minimal runtime shapes to reduce explicit any usage without changing behavior
type UnreadCounts = {
  bellNotifications: number;
  systemMessages: number;
  total: number;
};

const MessageModel = Message as unknown as {
  getUnreadCountsForUser: (userId: string) => Promise<UnreadCounts>;
};

/**
 * Targeted System Messages Controller
 * Handles creating system messages for specific users
 */
export default class TargetedSystemMessagesController {
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
      targetRoles?: string[];
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

      const targetUserIdsForMessage =
        messageData.targetRoles && messageData.targetRoles.length > 0
          ? await TargetedSystemMessagesController.filterTargetUsersByRole(
              targetUserIds,
              messageData.targetRoles
            )
          : targetUserIds;

      // Create targeted message
      const targetedMessage = new Message({
        title: messageData.title,
        content: messageData.content,
        type: messageData.type || "assignment",
        priority: messageData.priority || "high",
        hideCreator: messageData.hideCreator === true,
        creator: messageCreator,
        isActive: true,
        targetRoles: messageData.targetRoles,
        metadata: messageData.metadata,
        // For single-recipient messages that target specific users, persist the target for frontend filtering
        targetUserId:
          (messageData.type === "auth_level_change" ||
            messageData.type === "event_role_change") &&
          targetUserIdsForMessage.length === 1
            ? targetUserIdsForMessage[0]
            : undefined,
        userStates: new Map(),
      });

      // Initialize user states for target users only
      for (const userId of targetUserIdsForMessage) {
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
      for (const userId of targetUserIdsForMessage) {
        await CachePatterns.invalidateUserCache(userId);
      }

      // Emit real-time notifications only to target users
      for (const userId of targetUserIdsForMessage) {
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

  private static async filterTargetUsersByRole(
    targetUserIds: string[],
    targetRoles: string[]
  ): Promise<string[]> {
    if (targetUserIds.length === 0) {
      return [];
    }

    const allowedUsers = await User.find({
      _id: { $in: targetUserIds },
      role: { $in: targetRoles },
    }).select("_id");
    const allowedUserIds = new Set(
      allowedUsers.map((user) => user._id.toString())
    );

    return targetUserIds.filter((userId) => allowedUserIds.has(userId));
  }
}
