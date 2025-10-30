import { Request, Response } from "express";
import Message from "../../models/Message";

/**
 * Legacy Message Cleanup Controller
 * Handles cleanup of expired items (legacy endpoint)
 */
export default class LegacyMessageCleanupController {
  /**
   * Clean up expired messages
   */
  static async cleanupExpiredItems(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();

      // Find expired messages and mark them as inactive
      const expiredMessages = await Message.updateMany(
        {
          isActive: true,
          expiresAt: { $lt: now },
        },
        {
          $set: { isActive: false },
        }
      );

      res.status(200).json({
        success: true,
        message: "Cleanup completed",
        data: {
          expiredMessages: expiredMessages.modifiedCount,
        },
      });
    } catch (error) {
      console.error("Error cleaning up expired items:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup expired items",
      });
    }
  }
}
