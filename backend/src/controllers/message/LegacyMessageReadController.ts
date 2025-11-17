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
 * Legacy Message Read Controller
 * Handles marking messages as read (legacy endpoint)
 */
export default class LegacyMessageReadController {
  /**
   * Mark system message as read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as unknown as { user: { id: string } }).user.id;

      if (!Types.ObjectId.isValid(messageId)) {
        res.status(400).json({ success: false, message: "Invalid message ID" });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({ success: false, message: "Message not found" });
        return;
      }

      // Use markAsReadEverywhere for auto-sync behavior (REQ 8)
      message.markAsReadEverywhere(userId);
      await message.save();

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

      // Emit unread count update for real-time updates
      socketService.emitUnreadCountUpdate(userId, updatedCounts);

      res
        .status(200)
        .json({ success: true, message: "Message marked as read" });
    } catch (error) {
      console.error("Error marking message as read:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to mark message as read" });
    }
  }
}
