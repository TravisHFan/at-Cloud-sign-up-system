import Notification from "../../models/Notification";
import SystemMessage from "../../models/SystemMessage";
import { User } from "../../models";
import { SocketManager } from "../infrastructure/socketManager";

export interface CreateNotificationParams {
  userId: string;
  type: "SYSTEM_MESSAGE" | "CHAT_MESSAGE" | "USER_ACTION" | "EVENT_UPDATE";
  category: string;
  title: string;
  message: string;
  priority?: "high" | "medium" | "low";
  metadata?: Record<string, any>;
  expiresAt?: Date;
  autoDelete?: boolean;
}

export interface CreateSystemMessageParams {
  title: string;
  content: string;
  type:
    | "announcement"
    | "maintenance"
    | "update"
    | "warning"
    | "auth_level_change";
  priority: "high" | "medium" | "low";
  creatorId: string;
  targetUserId?: string;
  expiresAt?: Date;
}

export class UnifiedNotificationService {
  constructor(private socketManager: SocketManager) {}

  /**
   * Create a unified notification that appears in the bell dropdown
   */
  async createNotification(params: CreateNotificationParams): Promise<any> {
    try {
      // Validate user exists
      const user = await User.findById(params.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Create notification
      const notification = new Notification({
        userId: params.userId,
        type: params.type,
        category: params.category,
        title: params.title,
        message: params.message,
        priority: params.priority || "medium",
        metadata: params.metadata || {},
        deliveryChannels: ["in-app"],
        expiresAt: params.expiresAt,
      });

      await notification.save();
      await notification.markAsDelivered();

      // Send real-time notification
      const notificationData = {
        id: (notification._id as any).toString(),
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        metadata: notification.metadata,
        isRead: false,
        createdAt: notification.createdAt,
      };

      // Populate sender info for chat messages
      if (params.type === "CHAT_MESSAGE" && params.metadata?.fromUserId) {
        const sender = await User.findById(params.metadata.fromUserId)
          .select("firstName lastName username avatar gender")
          .lean();

        if (sender) {
          const currentMetadata = notificationData.metadata || {};
          const currentAdditionalInfo = currentMetadata.additionalInfo || {};

          notificationData.metadata = {
            ...currentMetadata,
            additionalInfo: {
              ...currentAdditionalInfo,
              senderInfo: {
                id: (sender._id as any).toString(),
                firstName: sender.firstName,
                lastName: sender.lastName,
                username: sender.username,
                avatar: sender.avatar,
                gender: sender.gender,
              },
            },
          };
        }
      }

      this.socketManager.sendNotificationToUser(
        params.userId,
        notificationData
      );

      // Auto-delete low priority notifications after 24 hours if enabled
      if (params.autoDelete && params.priority === "low") {
        setTimeout(async () => {
          try {
            await Notification.findByIdAndDelete(notification._id);
          } catch (error) {
            console.error("Failed to auto-delete notification:", error);
          }
        }, 24 * 60 * 60 * 1000); // 24 hours
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Create a system message and corresponding notification
   */
  async createSystemMessage(params: CreateSystemMessageParams): Promise<any> {
    try {
      // Validate creator exists and has proper role
      const creator = await User.findById(params.creatorId);
      if (!creator) {
        throw new Error("Creator not found");
      }

      // Check role permissions
      const allowedRoles = ["Admin", "Moderator"];
      if (!allowedRoles.includes(creator.roleInAtCloud || "")) {
        throw new Error("Insufficient permissions to create system messages");
      }

      // Validate target user if specified
      if (params.targetUserId) {
        const targetUser = await User.findById(params.targetUserId);
        if (!targetUser) {
          throw new Error("Target user not found");
        }
      }

      // Create system message
      const systemMessage = new SystemMessage({
        title: params.title,
        content: params.content,
        type: params.type,
        priority: params.priority,
        creator: params.creatorId,
        targetUserId: params.targetUserId,
        expiresAt: params.expiresAt,
        isActive: true,
        readByUsers: [],
      });

      await systemMessage.save();

      // Populate creator info
      await systemMessage.populate(
        "creator",
        "firstName lastName roleInAtCloud"
      );

      // Determine recipient(s)
      const recipients = params.targetUserId
        ? [params.targetUserId]
        : await this.getAllActiveUserIds();

      // Create notifications for each recipient
      const notifications = await Promise.all(
        recipients.map(async (userId) => {
          return this.createNotification({
            userId,
            type: "SYSTEM_MESSAGE",
            category: "system",
            title: params.title,
            message: params.content,
            priority: params.priority,
            metadata: {
              additionalInfo: {
                systemMessageId: (systemMessage._id as any).toString(),
                systemMessageType: params.type,
                creatorName: `${creator.firstName} ${creator.lastName}`,
                creatorRole: creator.roleInAtCloud,
              },
            },
            expiresAt: params.expiresAt,
          });
        })
      );

      return {
        systemMessage,
        notifications,
      };
    } catch (error) {
      console.error("Error creating system message:", error);
      throw error;
    }
  }

  /**
   * Create a chat message notification (only if recipient is not in active chat)
   */
  async createChatMessageNotification(
    fromUserId: string,
    toUserId: string,
    message: string,
    conversationId?: string
  ): Promise<any> {
    try {
      // Get sender info
      const sender = await User.findById(fromUserId)
        .select("firstName lastName username avatar gender")
        .lean();

      if (!sender) {
        throw new Error("Sender not found");
      }

      // Check if recipient is currently in active chat with sender
      // This should be implemented based on your active chat tracking logic
      const isInActiveChat = false; // TODO: Implement active chat detection

      if (isInActiveChat) {
        console.log("Recipient is in active chat, skipping notification");
        return null;
      }

      const senderName = `${sender.firstName} ${sender.lastName}`.trim();
      const truncatedMessage =
        message.length > 80 ? `${message.substring(0, 80)}...` : message;

      return this.createNotification({
        userId: toUserId,
        type: "CHAT_MESSAGE",
        category: "chat",
        title: `New message from ${senderName}`,
        message: truncatedMessage,
        priority: "medium",
        metadata: {
          fromUserId,
          conversationId,
          fromUser: {
            id: sender._id.toString(),
            firstName: sender.firstName,
            lastName: sender.lastName,
            username: sender.username,
            avatar: sender.avatar,
            gender: sender.gender,
          },
        },
        autoDelete: true, // Auto-delete after 24 hours
      });
    } catch (error) {
      console.error("Error creating chat message notification:", error);
      throw error;
    }
  }

  /**
   * Create auth level change notification
   */
  async createAuthLevelChangeNotification(
    targetUserId: string,
    actorUserId: string,
    fromLevel: string,
    toLevel: string
  ): Promise<any> {
    try {
      const actor = await User.findById(actorUserId)
        .select("firstName lastName roleInAtCloud")
        .lean();

      if (!actor) {
        throw new Error("Actor not found");
      }

      const actorName = `${actor.firstName} ${actor.lastName}`.trim();

      // Create system message
      const systemMessageResult = await this.createSystemMessage({
        title: "System Authorization Level Updated",
        content: `Your system authorization level has been changed from "${fromLevel}" to "${toLevel}" by ${actorName}.`,
        type: "auth_level_change",
        priority: "high",
        creatorId: actorUserId,
        targetUserId, // Targeted to specific user
      });

      return systemMessageResult;
    } catch (error) {
      console.error("Error creating auth level change notification:", error);
      throw error;
    }
  }

  /**
   * Get all active user IDs for broadcasting
   */
  private async getAllActiveUserIds(): Promise<string[]> {
    try {
      const users = await User.find({ isActive: true }).select("_id").lean();
      return users.map((user) => user._id.toString());
    } catch (error) {
      console.error("Error getting active user IDs:", error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(
    userId: string,
    notificationId: string
  ): Promise<void> {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        userId,
      });

      if (notification && !notification.isRead) {
        await notification.markAsRead();
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark system message as read
   */
  async markSystemMessageAsRead(
    userId: string,
    messageId: string
  ): Promise<void> {
    try {
      await SystemMessage.findByIdAndUpdate(
        messageId,
        { $addToSet: { readByUsers: userId } },
        { new: true }
      );
    } catch (error) {
      console.error("Error marking system message as read:", error);
      throw error;
    }
  }

  /**
   * Get notifications for user (unified view for bell dropdown)
   */
  async getNotificationsForUser(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      includeRead?: boolean;
    } = {}
  ): Promise<any> {
    try {
      const { page = 1, limit = 50, includeRead = true } = options;

      // Build filter
      const filter: any = {
        userId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      };

      if (!includeRead) {
        filter.isRead = false;
      }

      const skip = (page - 1) * limit;

      // Get notifications
      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Populate sender info for chat messages
      const populatedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          if (
            notification.type === "CHAT_MESSAGE" &&
            notification.metadata?.fromUserId
          ) {
            const sender = await User.findById(notification.metadata.fromUserId)
              .select("firstName lastName username avatar gender")
              .lean();

            if (sender) {
              return {
                ...notification,
                fromUser: {
                  id: sender._id.toString(),
                  firstName: sender.firstName,
                  lastName: sender.lastName,
                  username: sender.username,
                  avatar: sender.avatar,
                  gender: sender.gender,
                },
              };
            }
          }

          // For system messages, get system message details
          if (
            notification.type === "SYSTEM_MESSAGE" &&
            notification.metadata?.additionalInfo?.systemMessageId
          ) {
            const systemMessage = await SystemMessage.findById(
              notification.metadata.additionalInfo.systemMessageId
            )
              .populate("creator", "firstName lastName roleInAtCloud")
              .lean();

            if (systemMessage) {
              return {
                ...notification,
                systemMessage: {
                  id: (systemMessage._id as any).toString(),
                  type: systemMessage.type,
                  creator: systemMessage.creator,
                },
              };
            }
          }

          return notification;
        })
      );

      const totalCount = await Notification.countDocuments(filter);
      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      return {
        notifications: populatedNotifications,
        totalCount,
        unreadCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: skip + populatedNotifications.length < totalCount,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error("Error getting notifications for user:", error);
      throw error;
    }
  }
}
