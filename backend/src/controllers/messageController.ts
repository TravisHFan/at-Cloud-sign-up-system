import { Request, Response } from "express";
import { Message, ChatRoom, User, IUser } from "../models";
import { v4 as uuidv4 } from "uuid";
import { getFileUrl } from "../middleware/upload";

export class MessageController {
  // Get messages for a chat room or conversation
  static async getMessages(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const { chatRoomId, eventId, receiverId } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let query: any = { isDeleted: false };

      // Determine query type
      if (chatRoomId) {
        query.chatRoomId = chatRoomId;
      } else if (eventId) {
        query.eventId = eventId;
      } else if (receiverId) {
        // Direct messages between two users
        query.$or = [
          { senderId: userId, receiverId: receiverId },
          { senderId: receiverId, receiverId: userId },
        ];
      } else {
        return res.status(400).json({
          success: false,
          message: "Must specify chatRoomId, eventId, or receiverId",
        });
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const totalMessages = await Message.countDocuments(query);
      const totalPages = Math.ceil(totalMessages / limit);

      // Mark messages as read by current user
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

  // Send a new message
  static async sendMessage(
    req: Request,
    res: Response
  ): Promise<Response | void> {
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
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Message content is required",
        });
      }

      // Validate that user has permission to send to the specified target
      if (chatRoomId) {
        const chatRoom = await ChatRoom.findById(chatRoomId);
        if (!chatRoom) {
          return res.status(404).json({
            success: false,
            message: "Chat room not found",
          });
        }

        const isParticipant = chatRoom.participants.some(
          (p) => p.userId === userId
        );
        if (!isParticipant) {
          return res.status(403).json({
            success: false,
            message: "You are not a participant in this chat room",
          });
        }
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

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

      // Update chat room's last message and message count
      if (chatRoomId) {
        await ChatRoom.findByIdAndUpdate(chatRoomId, {
          lastMessage: {
            content:
              content.substring(0, 100) + (content.length > 100 ? "..." : ""),
            senderId: userId,
            senderName: `${user.firstName} ${user.lastName}`,
            sentAt: new Date(),
            messageType,
          },
          $inc: { messageCount: 1 },
        });
      }

      // Broadcast message via Socket.IO for real-time updates
      const socketManager = (req as any).app.get("socketManager");
      if (socketManager && chatRoomId) {
        socketManager.sendMessageToRoom(chatRoomId, {
          _id: message._id,
          content: message.content,
          senderId: message.senderId,
          senderUsername: message.senderUsername,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar,
          chatRoomId: message.chatRoomId,
          messageType: message.messageType,
          attachments: message.attachments,
          createdAt: message.createdAt,
          mentions: message.mentions,
          tags: message.tags,
          priority: message.priority,
        });
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

  // Edit a message
  static async editMessage(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Message content is required",
        });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }

      // Only sender can edit their message
      if (message.senderId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own messages",
        });
      }

      // Check if message is too old to edit (24 hours)
      const hoursSinceCreated =
        (new Date().getTime() - message.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated > 24) {
        return res.status(400).json({
          success: false,
          message: "Cannot edit messages older than 24 hours",
        });
      }

      message.content = content.trim();
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      res.json({
        success: true,
        message: "Message updated successfully",
        data: { message },
      });
    } catch (error) {
      console.error("Error editing message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to edit message",
      });
    }
  }

  // Delete a message
  static async deleteMessage(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }

      // Only sender can delete their message (or admins)
      if (
        message.senderId !== userId &&
        !["Super Admin", "Administrator"].includes(userRole)
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own messages",
        });
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = "[Message deleted]";
      await message.save();

      res.json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete message",
      });
    }
  }

  // Add reaction to a message
  static async addReaction(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!emoji) {
        return res.status(400).json({
          success: false,
          message: "Emoji is required",
        });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }

      // Remove existing reaction from this user if it exists
      message.reactions =
        message.reactions?.filter((r) => r.userId !== userId) || [];

      // Add new reaction
      message.reactions.push({
        userId: userId,
        emoji,
        createdAt: new Date(),
      });

      await message.save();

      res.json({
        success: true,
        message: "Reaction added successfully",
        data: { message },
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add reaction",
      });
    }
  }

  // Get chat rooms for current user
  static async getChatRooms(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const chatRooms = await ChatRoom.find({
        "participants.userId": userId,
        isArchived: false,
      }).sort({ updatedAt: -1 });

      res.json({
        success: true,
        data: { chatRooms },
      });
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch chat rooms",
      });
    }
  }

  // Create a new chat room
  static async createChatRoom(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const {
        name,
        description,
        type = "general",
        isPrivate = false,
        eventId,
        participantIds = [],
      } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Chat room name is required",
        });
      }

      // Get user info for participants
      const allParticipantIds = [userId, ...participantIds];
      const participants = await User.find({ _id: { $in: allParticipantIds } });

      const chatRoom = new ChatRoom({
        name: name.trim(),
        description,
        type,
        isPrivate,
        eventId,
        participants: participants.map((user) => ({
          userId: (user as any)._id.toString(),
          username: user.username,
          name: `${user.firstName} ${user.lastName}`,
          role: (user as any)._id.toString() === userId ? "admin" : "member",
          joinedAt: new Date(),
        })),
        createdBy: userId,
      });

      await chatRoom.save();

      res.status(201).json({
        success: true,
        message: "Chat room created successfully",
        data: { chatRoom },
      });
    } catch (error) {
      console.error("Error creating chat room:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create chat room",
      });
    }
  }

  // Upload message attachment
  static async uploadAttachment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
        return;
      }

      // Generate file URL
      const fileUrl = getFileUrl(req, `attachments/${req.file.filename}`);

      const attachmentData = {
        fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      };

      res.status(200).json({
        success: true,
        message: "Attachment uploaded successfully.",
        data: attachmentData,
      });
    } catch (error: any) {
      console.error("Upload attachment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload attachment.",
      });
    }
  }
}
