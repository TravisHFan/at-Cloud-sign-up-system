import { Request, Response } from "express";
import { User } from "../models";
import { hasPermission, PERMISSIONS } from "../utils/roleUtils";

/**
 * UserAnalyticsController
 * Handles user analytics and statistics operations
 * - User statistics aggregation
 */
export class UserAnalyticsController {
  /**
   * Get user statistics (admin only)
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.VIEW_SYSTEM_ANALYTICS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to view user statistics.",
        });
        return;
      }

      type UserModelWithStats = typeof User & {
        getUserStats: () => Promise<unknown>;
      };
      const UserWithStats = User as unknown as UserModelWithStats;
      const stats = await UserWithStats.getUserStats();

      res.status(200).json({
        success: true,
        data: { stats },
      });
    } catch (error: unknown) {
      console.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user statistics.",
      });
    }
  }
}
