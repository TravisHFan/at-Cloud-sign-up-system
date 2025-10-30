import { Request, Response } from "express";
import { Types } from "mongoose";
import Message from "../../models/Message";
import { socketService } from "../../services/infrastructure/SocketService";

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
 * Legacy Message Deletion Controller
 * Handles deletion of messages (legacy endpoint)
 */
export default class LegacyMessageDeletionController {
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
}
