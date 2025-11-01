/**
 * PasswordResetController
 * Handles password reset request and reset operations
 * Extracted from authController.ts
 */

import { Request, Response } from "express";
import { User } from "../../models";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { CachePatterns } from "../../services";
import { UnifiedMessageController } from "../unifiedMessageController";
import { UserDocLike, toIdString } from "./types";

export default class PasswordResetController {
  // Request password reset
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email address is required.",
        });
        return;
      }

      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });

      // Always return success to prevent email enumeration
      const successMessage =
        "If that email address is in our system, you will receive a password reset email shortly.";

      if (!user) {
        res.status(200).json({
          success: true,
          message: successMessage,
        });
        return;
      }

      // Generate password reset token
      const resetToken = (
        user as unknown as { generatePasswordResetToken: () => string }
      ).generatePasswordResetToken();
      await user.save();

      // Send password reset email
      const emailSent = await EmailService.sendPasswordResetEmail(
        user.email,
        user.firstName || user.username,
        resetToken
      );

      if (!emailSent) {
        console.warn("Failed to send password reset email to:", user.email);
      }

      // Create system message and bell notification for password reset
      try {
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: "Password Reset Requested",
            content: `A password reset link has been sent to your email. Please check your inbox and follow the instructions to reset your password.`,
            // Use a valid type in the Message schema
            type: "warning",
            priority: "high",
            hideCreator: true,
          },
          [toIdString((user as unknown as UserDocLike)._id)],
          {
            id: "system",
            firstName: "System",
            lastName: "Administrator",
            username: "system",
            avatar: "/default-avatar-male.jpg",
            gender: "male",
            authLevel: "Super Admin",
            roleInAtCloud: "System",
          }
        );
      } catch (error: unknown) {
        console.warn("Failed to create password reset system message:", error);
      }

      res.status(200).json({
        success: true,
        message: successMessage,
      });
    } catch (error: unknown) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset request failed.",
      });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { newPassword, confirmPassword } = req.body;

      if (!newPassword || !confirmPassword) {
        res.status(400).json({
          success: false,
          message: "New password and confirmation are required.",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: "Passwords do not match.",
        });
        return;
      }

      if (!req.user) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired reset token.",
        });
        return;
      }

      const user = req.user as unknown as UserDocLike;

      // Update password and clear reset token
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      // Invalidate user cache after password reset
      await CachePatterns.invalidateUserCache(toIdString(user._id));

      // Create success trio notification for password reset
      try {
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: "Password Reset Successful",
            content: `Your password has been successfully reset. If you did not make this change, please contact support immediately.`,
            type: "update", // Changed from "warning" to "update" for positive confirmation
            priority: "high",
            hideCreator: true,
          },
          [user._id.toString()],
          {
            id: "system",
            firstName: "System",
            lastName: "Administrator",
            username: "system",
            avatar: "/default-avatar-male.jpg",
            gender: "male",
            authLevel: "Super Admin",
            roleInAtCloud: "System",
          }
        );

        // Send password reset success email
        await EmailService.sendPasswordResetSuccessEmail(
          user.email,
          (user.firstName || user.username || "User") as string
        );
      } catch (error: unknown) {
        console.warn(
          "Failed to send password reset success notifications:",
          error
        );
      }

      res.status(200).json({
        success: true,
        message: "Password reset successfully!",
      });
    } catch (error: unknown) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset failed.",
      });
    }
  }
}
