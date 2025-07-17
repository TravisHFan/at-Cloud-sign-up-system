import { Request, Response } from "express";
import { User } from "../models";
import mongoose from "mongoose";

/**
 * Hybrid Chat Controller
 *
 * This controller implements a hybrid approach for user-to-user messaging:
 * 1. User-centric storage for conversation summaries and recent messages
 * 2. Central collection for complete message history (for search, backup)
 * 3. Performance optimization through message caching
 *
 * Benefits:
 * - Fast conversation loading (cached in user documents)
 * - Complete message history preservation
 * - User-scoped data access for privacy
 * - Efficient real-time updates
 */

// Create a central Message collection for complete history
const centralMessageSchema = new mongoose.Schema(
  {
    fromUserId: { type: String, required: true, index: true },
    toUserId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 10000 },
    messageType: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    attachments: [
      {
        type: { type: String, enum: ["image", "file", "link"] },
        url: String,
        name: String,
        size: Number,
      },
    ],
    reactions: [
      {
        userId: String,
        emoji: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    readAt: Date,
    deliveredAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
centralMessageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
centralMessageSchema.index({ fromUserId: 1, createdAt: -1 });
centralMessageSchema.index({ toUserId: 1, createdAt: -1 });
centralMessageSchema.index({ isDeleted: 1, createdAt: -1 });

const CentralMessage = mongoose.model("CentralMessage", centralMessageSchema);

export class HybridChatController {
  // Get user's conversation list
  static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await User.findById(userId).select("chatConversations");

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Sort conversations: pinned first, then by last message time
      const sortedConversations = user.chatConversations
        .filter((conv: any) => !conv.isArchived)
        .sort((a: any, b: any) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (
            new Date(b.lastMessageTime).getTime() -
            new Date(a.lastMessageTime).getTime()
          );
        });

      res.json({
        success: true,
        data: { conversations: sortedConversations },
      });
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch conversations",
      });
    }
  }

  // Get messages for a specific conversation
  static async getConversationMessages(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { partnerId } = req.params;
      const userId = (req as any).user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Get recent messages from user cache first
      const recentMessages = user.getRecentMessages(partnerId, limit);

      let messages = recentMessages;

      // If we need more messages or this is a deep history request, fetch from central collection
      if (recentMessages.length < limit || page > 1) {
        const skip = (page - 1) * limit;

        const centralMessages = await CentralMessage.find({
          $or: [
            { fromUserId: userId, toUserId: partnerId },
            { fromUserId: partnerId, toUserId: userId },
          ],
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        // Transform central messages to match user cache format
        const transformedMessages = centralMessages
          .map((msg: any) => ({
            conversationId: partnerId,
            messageId: msg._id.toString(),
            content: msg.content,
            senderId: msg.fromUserId,
            senderName:
              msg.fromUserId === userId ? user.getDisplayName() : "Partner", // You might want to fetch partner name
            senderUsername:
              msg.fromUserId === userId ? user.username : "partner",
            senderAvatar: msg.fromUserId === userId ? user.avatar : null,
            isFromMe: msg.fromUserId === userId,
            messageType: msg.messageType,
            attachments: msg.attachments || [],
            reactions: msg.reactions || [],
            isEdited: msg.isEdited,
            editedAt: msg.editedAt,
            isDeleted: msg.isDeleted,
            deletedAt: msg.deletedAt,
            readAt: msg.readAt,
            deliveredAt: msg.deliveredAt,
            timestamp: msg.createdAt,
            createdAt: msg.createdAt,
          }))
          .reverse(); // Reverse to get chronological order

        messages = transformedMessages;
      }

      // Mark conversation as read
      user.markConversationAsRead(partnerId);
      await user.save();

      res.json({
        success: true,
        data: {
          messages,
          partnerId,
          hasMore: messages.length === limit, // Simple check, could be more sophisticated
        },
      });
    } catch (error) {
      console.error("Get conversation messages error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch conversation messages",
      });
    }
  }

  // Send a new message
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const {
        toUserId,
        content,
        messageType = "text",
        attachments = [],
      } = req.body;
      const fromUserId = (req as any).user?.id;

      if (!fromUserId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!content || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Message content is required",
        });
        return;
      }

      if (!toUserId) {
        res.status(400).json({
          success: false,
          message: "Recipient user ID is required",
        });
        return;
      }

      // Get sender and recipient data
      const [sender, recipient] = await Promise.all([
        User.findById(fromUserId),
        User.findById(toUserId),
      ]);

      if (!sender || !recipient) {
        res.status(404).json({
          success: false,
          message: "Sender or recipient not found",
        });
        return;
      }

      if (!sender.isActive || !recipient.isActive) {
        res.status(400).json({
          success: false,
          message: "Cannot send message to inactive user",
        });
        return;
      }

      const messageId = new mongoose.Types.ObjectId().toString();
      const timestamp = new Date();

      // 1. Save to central collection for complete history
      const centralMessage = new CentralMessage({
        fromUserId,
        toUserId,
        content: content.trim(),
        messageType,
        attachments,
        deliveredAt: timestamp,
      });

      await centralMessage.save();

      // 2. Add to sender's recent messages cache
      const senderMessageData = {
        conversationId: toUserId,
        messageId,
        content: content.trim(),
        senderId: fromUserId,
        senderName: sender.getDisplayName(),
        senderUsername: sender.username,
        senderAvatar: sender.avatar,
        isFromMe: true,
        messageType,
        attachments,
        timestamp,
        deliveredAt: timestamp,
      };

      sender.addRecentMessage(senderMessageData);

      // 3. Add to recipient's recent messages cache
      const recipientMessageData = {
        conversationId: fromUserId,
        messageId,
        content: content.trim(),
        senderId: fromUserId,
        senderName: sender.getDisplayName(),
        senderUsername: sender.username,
        senderAvatar: sender.avatar,
        isFromMe: false,
        messageType,
        attachments,
        timestamp,
        deliveredAt: timestamp,
      };

      recipient.addRecentMessage(recipientMessageData);

      // 4. Update conversation summaries
      const truncatedContent =
        content.length > 97 ? content.substring(0, 97) + "..." : content;

      // Update sender's conversation
      sender.addChatConversation(toUserId, {
        partnerName: recipient.getDisplayName(),
        username: recipient.username,
        partnerAvatar: recipient.avatar,
        partnerGender: recipient.gender,
        lastMessageId: messageId,
        lastMessageContent: truncatedContent,
        lastMessageTime: timestamp,
        lastMessageFromMe: true,
      });

      // Update recipient's conversation
      recipient.addChatConversation(fromUserId, {
        partnerName: sender.getDisplayName(),
        username: sender.username,
        partnerAvatar: sender.avatar,
        partnerGender: sender.gender,
        lastMessageId: messageId,
        lastMessageContent: truncatedContent,
        lastMessageTime: timestamp,
        lastMessageFromMe: false,
        unreadCount:
          (recipient.getChatConversation(fromUserId)?.unreadCount || 0) + 1,
      });

      // Save both users
      await Promise.all([sender.save(), recipient.save()]);

      // 5. Send real-time updates via Socket.IO
      const socketManager = (req as any).app.get("socketManager");
      if (socketManager) {
        // Send to recipient for real-time chat updates
        socketManager.sendDirectMessageBetweenUsers(fromUserId, toUserId, {
          messageId,
          conversationId: fromUserId,
          content: content.trim(),
          senderId: fromUserId,
          senderName: sender.getDisplayName(),
          senderUsername: sender.username,
          senderAvatar: sender.avatar,
          isFromMe: false,
          messageType,
          attachments,
          timestamp,
          fromUser: {
            id: fromUserId,
            firstName: sender.firstName,
            lastName: sender.lastName,
            username: sender.username,
            avatar: sender.avatar,
            gender: sender.gender,
          },
        });

        // Also send notification to recipient
        socketManager.sendNotificationToUser(toUserId, {
          id: messageId,
          type: "CHAT_MESSAGE",
          category: "chat",
          title: `New message from ${sender.getDisplayName()}`,
          message: truncatedContent,
          isRead: false,
          createdAt: timestamp.toISOString(),
          fromUser: {
            id: fromUserId,
            firstName: sender.firstName,
            lastName: sender.lastName,
            username: sender.username,
            avatar: sender.avatar,
            gender: sender.gender,
          },
        });
      }

      res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: {
          messageId,
          timestamp,
          conversationId: toUserId,
        },
      });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  }

  // Delete a message (mark as deleted)
  static async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Delete from user's cache
      const deleted = user.deleteMessage(messageId);

      if (deleted) {
        await user.save();

        // Also mark as deleted in central collection
        await CentralMessage.findByIdAndUpdate(messageId, {
          isDeleted: true,
          deletedAt: new Date(),
        });

        res.json({
          success: true,
          message: "Message deleted successfully",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }
    } catch (error) {
      console.error("Delete message error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete message",
      });
    }
  }

  // Manage conversation (mute, archive, pin)
  static async manageConversation(req: Request, res: Response): Promise<void> {
    try {
      const { partnerId } = req.params;
      const { action, value } = req.body; // action: 'mute'|'archive'|'pin', value: boolean
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      switch (action) {
        case "mute":
          user.muteConversation(partnerId, value);
          break;
        case "archive":
          user.archiveConversation(partnerId, value);
          break;
        case "pin":
          user.pinConversation(partnerId, value);
          break;
        default:
          res.status(400).json({
            success: false,
            message: "Invalid action. Use 'mute', 'archive', or 'pin'",
          });
          return;
      }

      await user.save();

      res.json({
        success: true,
        message: `Conversation ${action}${
          value ? "ed" : " removed"
        } successfully`,
      });
    } catch (error) {
      console.error("Manage conversation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to manage conversation",
      });
    }
  }

  // Search messages (uses central collection)
  static async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const { query, partnerId } = req.query;
      const userId = (req as any).user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Search query is required",
        });
        return;
      }

      const searchFilter: any = {
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        content: { $regex: query.trim(), $options: "i" },
        isDeleted: false,
      };

      // If partnerId is specified, search only in that conversation
      if (partnerId) {
        searchFilter.$or = [
          { fromUserId: userId, toUserId: partnerId },
          { fromUserId: partnerId, toUserId: userId },
        ];
      }

      const skip = (page - 1) * limit;

      const [messages, totalCount] = await Promise.all([
        CentralMessage.find(searchFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CentralMessage.countDocuments(searchFilter),
      ]);

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalMessages: totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Search messages error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search messages",
      });
    }
  }
}
