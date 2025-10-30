import { Request, Response } from "express";
import Message from "../../models/Message";
import { socketService } from "../../services/infrastructure/SocketService";
import { CachePatterns } from "../../services";

/**
 * Bell Notifications Removal Controller
 * Handles removing bell notifications from dropdown
 */
export default class BellNotificationsRemovalController {
  /**
   * Remove bell notification
   * Hides from bell dropdown but keeps in system messages
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

      const message = await Message.findById(messageId);
      if (!message) {
        res.status(404).json({
          success: false,
          message: "Notification not found",
        });
        return;
      }

      // Remove from bell notifications only
      message.removeFromBell(userId);
      await message.save();

      // Invalidate user cache after bell notification removal
      await CachePatterns.invalidateUserCache(userId);

      // Emit real-time update
      socketService.emitBellNotificationUpdate(userId, "notification_removed", {
        messageId: message._id,
      });

      res.status(200).json({
        success: true,
        message: "Notification removed from bell",
      });
    } catch (error) {
      console.error("Error in removeBellNotification:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
