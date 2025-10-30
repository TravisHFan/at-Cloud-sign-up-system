import { Request, Response } from "express";
import Message from "../../models/Message";
import { CachePatterns } from "../../services";

/**
 * Message Cleanup Controller
 * Handles cleanup of expired messages
 */
export default class MessageCleanupController {
  /**
   * Clean up expired messages
   */
  static async cleanupExpiredMessages(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const now = new Date();

      // Mark expired messages as inactive
      const result = await Message.updateMany(
        {
          isActive: true,
          expiresAt: { $lte: now },
        },
        {
          isActive: false,
        }
      );

      // Invalidate all user sessions cache since we can't determine which users were affected
      if (result.modifiedCount > 0) {
        await CachePatterns.invalidateAllUserCaches();
      }

      res.status(200).json({
        success: true,
        message: "Expired messages cleaned up",
        data: {
          expiredCount: result.modifiedCount,
        },
      });
    } catch (error) {
      console.error("Error in cleanupExpiredMessages:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
