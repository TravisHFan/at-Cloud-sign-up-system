import { Request, Response } from "express";
import Message from "../../models/Message";
import { socketService } from "../../services/infrastructure/SocketService";
import { CachePatterns } from "../../services";

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
 * System Messages Deletion Controller
 * Handles deletion of system messages (user perspective)
 */
export default class SystemMessagesDeletionController {
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
}
