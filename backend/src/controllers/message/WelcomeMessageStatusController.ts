import { Request, Response } from "express";
import User from "../../models/User";

/**
 * Welcome Message Status Controller
 * Handles checking welcome message status for onboarding
 */
export default class WelcomeMessageStatusController {
  /**
   * Welcome message status check (for onboarding)
   */
  static async checkWelcomeMessageStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const user = await User.findById(userId).select(
        "hasReceivedWelcomeMessage"
      );

      res.status(200).json({
        success: true,
        data: {
          hasReceivedWelcomeMessage: user?.hasReceivedWelcomeMessage || false,
        },
      });
    } catch (error) {
      console.error("Error in checkWelcomeMessageStatus:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
