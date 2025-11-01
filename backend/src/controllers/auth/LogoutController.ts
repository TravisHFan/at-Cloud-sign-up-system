/**
 * LogoutController
 * Handles user logout operations
 * Extracted from authController.ts
 */

import { Request, Response } from "express";

export default class LogoutController {
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Clear the refresh token cookie
      res.clearCookie("refreshToken");

      res.status(200).json({
        success: true,
        message: "Logged out successfully!",
      });
    } catch (error: unknown) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed.",
      });
    }
  }
}
