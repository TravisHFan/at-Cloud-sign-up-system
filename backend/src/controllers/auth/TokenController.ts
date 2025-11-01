/**
 * TokenController
 * Handles JWT token refresh operations
 * Extracted from authController.ts
 */

import { Request, Response } from "express";
import { User } from "../../models";
import { TokenService } from "../../middleware/auth";

export default class TokenController {
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: "Refresh token not provided.",
        });
        return;
      }

      // Verify the refresh token
      const decoded = TokenService.verifyRefreshToken(refreshToken);

      if (!decoded || !decoded.userId) {
        res.status(401).json({
          success: false,
          message: "Invalid refresh token.",
        });
        return;
      }

      // Get user to ensure they still exist and are active
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: "User not found or inactive.",
        });
        return;
      }

      // Generate new access token
      const newTokens = TokenService.generateTokenPair(user);

      // Set new refresh token in cookie
      const refreshExpireMs = TokenService.parseTimeToMs(
        process.env.JWT_REFRESH_EXPIRE || "7d"
      );

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        maxAge: refreshExpireMs,
      };

      res.cookie("refreshToken", newTokens.refreshToken, cookieOptions);

      res.status(200).json({
        success: true,
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
        message: "Token refreshed successfully.",
      });
    } catch (error: unknown) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        success: false,
        message: "Token refresh failed.",
      });
    }
  }
}
