import { Request, Response } from "express";
import { Message, User, Notification } from "../models";

export class RefactoredMessageController {
  // Get messages with improved query handling
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { chatRoomId, eventId, receiverId } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      let query: any = { isDeleted: false };

      // Determine query type with improved logic
      if (chatRoomId) {
        query.chatRoomId = chatRoomId;
      } else if (eventId) {
        query.eventId = eventId;
      } else if (receiverId) {
        // Direct messages between two specific users
        query.$or = [
          { senderId: userId, receiverId: receiverId },
          { senderId: receiverId, receiverId: userId },
        ];
      } else {
        // ✅ FIXED: Get all direct messages for the current user
        query.$or = [
          { senderId: userId, receiverId: { $exists: true, $ne: null } },
          { receiverId: userId, senderId: { $exists: true, $ne: null } },
        ];
        // Exclude group chat messages
        query.chatRoomId = { $exists: false };
        query.eventId = { $exists: false };

        console.log(`📨 Getting all direct messages for user: ${userId}`);
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const totalMessages = await Message.countDocuments(query);
      const totalPages = Math.ceil(totalMessages / limit);

      // Mark messages as read by current user (only for specific conversations)
      if (chatRoomId || eventId || receiverId) {
        await Message.updateMany(
          {
            ...query,
            senderId: { $ne: userId },
            "readBy.userId": { $ne: userId },
          },
          {
            $push: {
              readBy: {
                userId: userId,
                readAt: new Date(),
              },
            },
          }
        );
      }

      res.json({
        success: true,
        data: {
          messages: messages.reverse(), // Return in chronological order
          pagination: {
            currentPage: page,
            totalPages,
            totalMessages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch messages",
      });
    }
  }

  // Enhanced send message with notification integration
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const {
        content,
        chatRoomId,
        eventId,
        receiverId,
        messageType = "text",
        parentMessageId,
        mentions = [],
        attachments = [],
        priority = "normal",
        tags = [],
      } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!content || content.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: "Message content is required",
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

      // Create message
      const message = new Message({
        content: content.trim(),
        senderId: userId,
        senderUsername: user.username,
        senderName: `${user.firstName} ${user.lastName}`,
        senderAvatar: user.avatar,
        chatRoomId,
        eventId,
        receiverId,
        messageType,
        parentMessageId,
        mentions,
        attachments,
        priority,
        tags,
      });

      await message.save();

      // ✅ ENHANCED: Create unified notification for direct messages
      if (receiverId && receiverId !== userId) {
        const notification = new Notification({
          userId: receiverId,
          type: "CHAT_MESSAGE",
          category: "chat",
          title: `New message from ${user.firstName} ${user.lastName}`,
          message:
            content.length > 100 ? content.substring(0, 100) + "..." : content,
          metadata: {
            fromUserId: userId,
            messageId: message._id,
          },
          deliveryChannels: ["in-app"],
          priority: priority as any,
        });

        await notification.save();
        await notification.markAsDelivered();
      }

      // Broadcast message via Socket.IO for real-time updates
      const socketManager = (req as any).app.get("socketManager");
      if (socketManager) {
        if (receiverId) {
          // Send direct message to specific user
          const messageData = {
            id: message._id,
            fromUserId: message.senderId,
            toUserId: message.receiverId,
            message: message.content,
            content: message.content,
            sender: {
              _id: message.senderId,
              username: message.senderUsername,
              firstName: user.firstName,
              lastName: user.lastName,
              avatar: message.senderAvatar,
              gender: user.gender,
            },
            messageType: message.messageType,
            attachments: message.attachments,
            createdAt: message.createdAt,
            timestamp: message.createdAt,
            mentions: message.mentions,
            tags: message.tags,
            priority: message.priority,
          };

          console.log(
            `📤 Emitting direct message to user ${receiverId}:`,
            messageData
          );
          socketManager.sendDirectMessageToUser(receiverId, messageData);
        }
        // Handle chatRoom and event messages as before...
      }

      res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: { message },
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  }

  // Get conversation between two users
  static async getDirectConversation(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { userId: otherUserId } = req.params;
      const currentUserId = (req as any).user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!currentUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const messages = await Message.find({
        $or: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      // Mark messages as read
      await Message.updateMany(
        {
          senderId: otherUserId,
          receiverId: currentUserId,
          "readBy.userId": { $ne: currentUserId },
        },
        {
          $push: {
            readBy: {
              userId: currentUserId,
              readAt: new Date(),
            },
          },
        }
      );

      res.json({
        success: true,
        data: {
          messages: messages.reverse(),
          otherUserId,
        },
      });
    } catch (error) {
      console.error("Error fetching direct conversation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch conversation",
      });
    }
  }

  // Get all conversations for a user (conversation list)
  static async getUserConversations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Get all direct messages for the user and group by conversation partner
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { senderId: userId, receiverId: { $exists: true, $ne: null } },
              { receiverId: userId, senderId: { $exists: true, $ne: null } },
            ],
            isDeleted: false,
            chatRoomId: { $exists: false },
            eventId: { $exists: false },
          },
        },
        {
          $addFields: {
            partnerId: {
              $cond: [
                { $eq: ["$senderId", userId] },
                "$receiverId",
                "$senderId",
              ],
            },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: "$partnerId",
            lastMessage: { $first: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$senderId", userId] },
                      { $not: { $in: [userId, "$readBy.userId"] } },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "partner",
          },
        },
        {
          $unwind: "$partner",
        },
        {
          $project: {
            partnerId: "$_id",
            partner: {
              _id: "$partner._id",
              firstName: "$partner.firstName",
              lastName: "$partner.lastName",
              username: "$partner.username",
              avatar: "$partner.avatar",
              gender: "$partner.gender",
            },
            lastMessage: "$lastMessage",
            unreadCount: "$unreadCount",
          },
        },
        {
          $sort: { "lastMessage.createdAt": -1 },
        },
      ]);

      res.json({
        success: true,
        data: { conversations },
      });
    } catch (error) {
      console.error("Error fetching user conversations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch conversations",
      });
    }
  }
}
