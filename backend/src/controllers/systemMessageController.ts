import { Request, Response } from "express";
import SystemMessage, { ISystemMessage } from "../models/SystemMessage";

export class SystemMessageController {
  // Get all system messages for current user
  static async getSystemMessages(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      // Get all active system messages
      const messages = await SystemMessage.find({
        isActive: true,
        $or: [
          { targetUserId: { $exists: false } }, // Global messages
          { targetUserId: user.id }, // Messages targeted to this user
        ],
      }).sort({ createdAt: -1 });

      // Transform messages to include isRead status for this user
      const transformedMessages = messages.map((message) => {
        const messageObj = message.toObject();
        const isRead = message.readByUsers.some(
          (userId) => userId.toString() === user.id
        );

        return {
          ...messageObj,
          isRead,
          // Remove readByUsers array from response for privacy
          readByUsers: undefined,
        };
      });

      res.status(200).json({
        success: true,
        data: { systemMessages: transformedMessages },
        message: "System messages retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting system messages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get system messages",
        error: error.message,
      });
    }
  }

  // Mark system message as read
  static async markAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { messageId } = req.params;

      const message = await SystemMessage.findByIdAndUpdate(
        messageId,
        { $addToSet: { readByUsers: user.id } }, // Add user to readByUsers if not already present
        { new: true }
      );

      if (!message) {
        res.status(404).json({
          success: false,
          message: "System message not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "System message marked as read",
      });
    } catch (error: any) {
      console.error("Error marking system message as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark system message as read",
        error: error.message,
      });
    }
  }

  // Mark all system messages as read
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      // Get all active system messages that this user can see
      const messages = await SystemMessage.find({
        isActive: true,
        $or: [
          { targetUserId: { $exists: false } }, // Global messages
          { targetUserId: user.id }, // Messages targeted to this user
        ],
      });

      // Update all messages to include this user in readByUsers
      await Promise.all(
        messages.map((message) =>
          SystemMessage.findByIdAndUpdate(message._id, {
            $addToSet: { readByUsers: user.id },
          })
        )
      );

      res.status(200).json({
        success: true,
        message: "All system messages marked as read",
      });
    } catch (error: any) {
      console.error("Error marking all system messages as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark all system messages as read",
        error: error.message,
      });
    }
  }

  // Create a new system message (admin only)
  static async createSystemMessage(req: Request, res: Response) {
    try {
      const {
        title,
        content,
        type,
        priority,
        targetUserId,
        creator,
        expiresAt,
      } = req.body;

      const message = new SystemMessage({
        title,
        content,
        type,
        priority,
        targetUserId,
        creator,
        expiresAt,
        isActive: true,
        readByUsers: [],
      });

      await message.save();

      res.status(201).json({
        success: true,
        data: { systemMessage: message },
        message: "System message created successfully",
      });
    } catch (error: any) {
      console.error("Error creating system message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create system message",
        error: error.message,
      });
    }
  }

  // Delete/deactivate a system message (admin only)
  static async deleteSystemMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params;

      const message = await SystemMessage.findByIdAndUpdate(
        messageId,
        { isActive: false },
        { new: true }
      );

      if (!message) {
        res.status(404).json({
          success: false,
          message: "System message not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "System message deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting system message:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete system message",
        error: error.message,
      });
    }
  }

  // Get unread count for system messages
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      const messages = await SystemMessage.find({
        isActive: true,
        $or: [
          { targetUserId: { $exists: false } }, // Global messages
          { targetUserId: user.id }, // Messages targeted to this user
        ],
        readByUsers: { $ne: user.id }, // Not read by this user
      });

      res.status(200).json({
        success: true,
        data: { unreadCount: messages.length },
        message: "Unread count retrieved successfully",
      });
    } catch (error: any) {
      console.error("Error getting unread count:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get unread count",
        error: error.message,
      });
    }
  }
}
