import { Request, Response } from "express";
import { SystemMessage, User } from "../models";
import mongoose from "mongoose";

export class SystemMessageController {
  /**
   * Get system messages for current user (Requirement 1)
   * Shows user's personalized view with read/unread status
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

      // Get user with their system message states
      const user = await User.findById(userId).select(
        "systemMessageStates role"
      );
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Build query for active system messages
      const messageQuery: any = { isActive: true };
      if (type) {
        messageQuery.type = type;
      }

      // Get active system messages
      const totalMessages = await SystemMessage.countDocuments(messageQuery);
      const systemMessages = await SystemMessage.find(messageQuery)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      // Combine messages with user states
      const messagesWithStates = systemMessages
        .map((message) => {
          const userState = user.systemMessageStates.find(
            (state: any) => state.messageId === (message as any)._id.toString()
          );

          return {
            id: (message as any)._id,
            title: message.title,
            content: message.content,
            type: message.type,
            priority: message.priority,
            creator: message.creator,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            expiresAt: message.expiresAt,
            // User-specific state
            isRead: userState?.isRead || false,
            readAt: userState?.readAt,
            isDeleted: userState?.isDeleted || false,
          };
        })
        .filter((message) => !message.isDeleted); // Don't show deleted messages

      res.status(200).json({
        success: true,
        data: {
          messages: messagesWithStates,
          pagination: {
            current: page,
            pages: Math.ceil(totalMessages / limit),
            total: totalMessages,
            limit,
          },
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
   * Check if welcome message has been sent (for frontend checks)
   */
  static async checkWelcomeMessageStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // For now, always return that welcome message checking is not required
      // This can be expanded later if needed for specific welcome message logic
      res.status(200).json({
        success: true,
        data: {
          hasWelcomeMessage: false,
          message: "Welcome message status check completed",
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
   * Create new system message (Requirement 4)
   * Only non-Participant users can create messages
   */
  static async createSystemMessage(req: Request, res: Response): Promise<void> {
    try {
      const creatorId = req.user?.id;
      const { title, content, type, priority, expiresAt } = req.body;

      if (!creatorId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Get creator details
      const creator = await User.findById(creatorId).select(
        "firstName lastName username avatar gender roleInAtCloud role"
      );

      if (!creator) {
        res.status(404).json({
          success: false,
          message: "Creator not found",
        });
        return;
      }

      // Check authorization (Requirement 4: except Participant)
      if (creator.role === "Participant") {
        res.status(403).json({
          success: false,
          message: "Participants cannot create system messages",
        });
        return;
      }

      // Create system message
      const systemMessage = new SystemMessage({
        title,
        content,
        type,
        priority: priority || "medium",
        creator: {
          id: (creator as any)._id.toString(),
          firstName: creator.firstName || "",
          lastName: creator.lastName || "",
          username: creator.username,
          avatar: creator.avatar,
          gender: creator.gender || "male",
          roleInAtCloud: creator.roleInAtCloud,
          authLevel: creator.role, // For "From xxx, Super Admin" display
        },
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      await systemMessage.save();

      // Send to all users (Requirement 4: "Send to All")
      const allUsers = await User.find({ isActive: true }).select("_id");

      // Add system message state and bell notification state for all users
      const bulkOps = allUsers.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $addToSet: {
              systemMessageStates: {
                messageId: (systemMessage as any)._id.toString(),
                isRead: false,
                isDeleted: false,
              },
              bellNotificationStates: {
                messageId: (systemMessage as any)._id.toString(),
                isRead: false,
                isRemoved: false,
              },
            },
          },
        },
      }));

      if (bulkOps.length > 0) {
        await User.bulkWrite(bulkOps);
      }

      res.status(201).json({
        success: true,
        message: "System message created and sent to all users",
        data: {
          id: (systemMessage as any)._id,
          title: systemMessage.title,
          type: systemMessage.type,
          recipientCount: allUsers.length,
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
   * Mark system message as read (Requirement 1)
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
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

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Mark as read (this also syncs with bell notification per Requirement 8)
      const success = user.markSystemMessageAsRead(messageId);

      if (success) {
        await user.save();
        res.status(200).json({
          success: true,
          message: "Message marked as read",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Message not found or already read",
        });
      }
    } catch (error) {
      console.error("Error in markAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Delete system message for current user (Requirement 2)
   * This only affects the current user's view
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
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

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      const success = user.deleteSystemMessage(messageId);

      if (success) {
        await user.save();
        res.status(200).json({
          success: true,
          message: "Message deleted from your view",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Message not found or already deleted",
        });
      }
    } catch (error) {
      console.error("Error in deleteMessage:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get bell notifications for current user (Requirement 5)
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

      const user = await User.findById(userId).select("bellNotificationStates");
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Get system messages for user's bell notifications
      const messageIds = user.bellNotificationStates
        .filter((state: any) => !state.isRemoved)
        .map((state: any) => state.messageId);

      const systemMessages = await SystemMessage.find({
        _id: { $in: messageIds },
        isActive: true,
      }).sort({ createdAt: -1 });

      // Combine with user states
      const notifications = systemMessages.map((message) => {
        const userState = user.bellNotificationStates.find(
          (state: any) => state.messageId === (message as any)._id.toString()
        );

        return {
          id: (message as any)._id,
          title: `From ${message.creator.firstName} ${message.creator.lastName}, ${message.creator.authLevel}`,
          content: message.content,
          type: message.type,
          priority: message.priority,
          createdAt: message.createdAt,
          // User-specific state
          isRead: userState?.isRead || false,
          readAt: userState?.readAt,
          showRemoveButton: userState?.isRead || false, // Show remove button only when read (Requirement 5)
        };
      });

      res.status(200).json({
        success: true,
        data: {
          notifications,
          unreadCount: notifications.filter((n) => !n.isRead).length,
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
   * Mark bell notification as read (Requirement 5)
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

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      const success = user.markBellNotificationAsRead(messageId);

      if (success) {
        await user.save();
        res.status(200).json({
          success: true,
          message: "Bell notification marked as read",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Notification not found or already read",
        });
      }
    } catch (error) {
      console.error("Error in markBellNotificationAsRead:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Remove bell notification (Requirement 6)
   * This only removes from bell notifications, not from system messages
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

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      const success = user.removeBellNotification(messageId);

      if (success) {
        await user.save();
        res.status(200).json({
          success: true,
          message: "Bell notification removed",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Notification not found or already removed",
        });
      }
    } catch (error) {
      console.error("Error in removeBellNotification:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
