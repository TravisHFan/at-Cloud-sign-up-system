/**
 * PasswordChangeController
 * Handles authenticated password change operations (request and complete)
 * Extracted from authController.ts
 */

import { Request, Response } from "express";
import { User } from "../../models";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { CachePatterns } from "../../services";
import { UnifiedMessageController } from "../unifiedMessageController";
import { UserDocLike, toIdString } from "./types";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export default class PasswordChangeController {
  // Phase 1: Request password change - requires current password and new password
  static async requestPasswordChange(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = toIdString((req.user as unknown as UserDocLike)._id);

      // Validate required fields
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: "Current password and new password are required.",
        });
        return;
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long.",
        });
        return;
      }

      // Find user and verify current password
      const user = await User.findById(userId).select("+password");
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
        return;
      }

      // Generate password change token (10 minutes expiry)
      const passwordChangeToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(passwordChangeToken)
        .digest("hex");

      // Hash the new password for temporary storage
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Store pending password change
      user.passwordChangeToken = hashedToken;
      user.passwordChangeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      user.pendingPassword = hashedNewPassword; // Store hashed new password temporarily
      await user.save({ validateBeforeSave: false });

      // Send password change request trio
      try {
        console.log(
          "🔄 Starting trio notification for password change request..."
        );

        // Email notification
        console.log("📧 Sending email notification...");
        await EmailService.sendPasswordChangeRequestEmail(
          user.email,
          user.firstName || user.username,
          passwordChangeToken
        );
        console.log("✅ Email notification sent successfully");

        // System message
        console.log("📬 Creating system message...");
        const systemMessage =
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "Password Change Request",
              content: `A password change was requested for your account. Please check your email to confirm this change. This request expires in 10 minutes.`,
              // Use a valid type in the Message schema
              type: "warning",
              priority: "high",
              hideCreator: true,
            },
            [userId.toString()],
            {
              id: "system",
              firstName: "System",
              lastName: "",
              username: "system",
              // Use valid values per schema to avoid validation failures
              gender: "male",
              authLevel: "Super Admin",
              avatar: "",
            }
          );
        console.log(
          "✅ System message created successfully:",
          systemMessage?._id
        );

        console.log(
          `Password change request trio sent for user: ${user.email}`
        );
      } catch (error) {
        console.error(
          "❌ Failed to send password change request notifications:",
          error
        );
        if (error instanceof Error) {
          console.error("📋 Error stack:", error.stack);
        }
      }

      res.status(200).json({
        success: true,
        message:
          "Password change request sent. Please check your email to confirm.",
      });
    } catch (error: unknown) {
      console.error("Request password change error:", error);
      res.status(500).json({
        success: false,
        message: "Password change request failed.",
      });
    }
  }

  // Phase 2: Complete password change - verify token and apply new password
  static async completePasswordChange(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { token } = req.params;
      console.log("🔐 Starting password change completion for token:", token);

      if (!token) {
        console.log("❌ No token provided");
        res.status(400).json({
          success: false,
          message: "Password change token is required.",
        });
        return;
      }

      // Hash the provided token to match stored hash
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      console.log("🔑 Token processing:", {
        originalToken: token,
        hashedToken: hashedToken.substring(0, 10) + "...",
        currentTime: new Date(Date.now()),
      });

      // Find user with valid password change token
      const user = await User.findOne({
        passwordChangeToken: hashedToken,
        passwordChangeExpires: { $gt: Date.now() },
      }).select("+pendingPassword");

      console.log("👤 User lookup result:", {
        found: !!user,
        userId: user?._id?.toString(),
        email: user?.email,
        hasPasswordChangeToken: !!user?.passwordChangeToken,
        hasExpiration: !!user?.passwordChangeExpires,
        hasPendingPassword: !!user?.pendingPassword,
        tokenExpires: user?.passwordChangeExpires,
        currentTime: new Date(Date.now()),
        isExpired: user?.passwordChangeExpires
          ? Date.now() > user.passwordChangeExpires.getTime()
          : "N/A",
      });

      if (!user) {
        console.log("❌ Password change failed: Token invalid or expired");
        res.status(400).json({
          success: false,
          message: "Password change token is invalid or has expired.",
        });
        return;
      }

      if (!user.pendingPassword) {
        console.log("❌ Password change failed: No pending password found");
        res.status(400).json({
          success: false,
          message: "No pending password change found.",
        });
        return;
      }

      console.log("🔒 User passwords before update:", {
        currentPasswordLength: user.password ? user.password.length : 0,
        pendingPasswordLength: user.pendingPassword
          ? user.pendingPassword.length
          : 0,
        currentPasswordStart: user.password
          ? user.password.substring(0, 10)
          : "none",
        pendingPasswordStart: user.pendingPassword
          ? user.pendingPassword.substring(0, 10)
          : "none",
      });

      // Apply the new password using direct update to avoid double hashing
      // The pendingPassword is already hashed, so we update directly without triggering pre-save hooks
      const updateResult = await User.updateOne(
        { _id: user._id },
        {
          $set: {
            password: user.pendingPassword,
            passwordChangedAt: new Date(),
          },
          $unset: {
            passwordChangeToken: 1,
            passwordChangeExpires: 1,
            pendingPassword: 1,
          },
        }
      );

      // Invalidate user cache after password update
      await CachePatterns.invalidateUserCache(toIdString(user._id));

      console.log("📝 Database update result:", {
        acknowledged: updateResult.acknowledged,
        modifiedCount: updateResult.modifiedCount,
        matchedCount: updateResult.matchedCount,
        upsertedCount: updateResult.upsertedCount,
      });

      // Verify the update by fetching the user again
      const updatedUser = await User.findById(user._id);
      console.log("✅ User after update:", {
        userId: updatedUser?._id?.toString(),
        passwordLength: updatedUser?.password ? updatedUser.password.length : 0,
        passwordStart: updatedUser?.password
          ? updatedUser.password.substring(0, 10)
          : "none",
        hasPasswordChangeToken: !!updatedUser?.passwordChangeToken,
        hasPendingPassword: !!updatedUser?.pendingPassword,
        passwordChangedAt: updatedUser?.passwordChangedAt,
      });

      // Send password change success trio
      try {
        console.log(
          "🔄 Starting trio notification for password change completion..."
        );

        // Email notification
        console.log("📧 Sending email notification...");
        await EmailService.sendPasswordResetSuccessEmail(
          user.email,
          user.firstName || user.username
        );
        console.log("✅ Email notification sent successfully");

        // System message
        console.log("📬 Creating system message...");
        const systemMessage =
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "Password Changed Successfully",
              content: `Your account password was changed successfully on ${new Date().toLocaleString()}. If you didn't make this change, please contact support immediately.`,
              // Use a valid type in the Message schema
              type: "update",
              priority: "medium",
              hideCreator: true,
            },
            [toIdString(user._id)],
            {
              id: "system",
              firstName: "System",
              lastName: "",
              username: "system",
              gender: "male",
              authLevel: "Super Admin",
              avatar: "",
            }
          );
        console.log(
          "✅ System message created successfully:",
          systemMessage?._id
        );

        console.log(
          `Password change success trio sent for user: ${user.email}`
        );
      } catch (error) {
        console.error(
          "❌ Failed to send password change success notifications:",
          error
        );
        if (error instanceof Error) {
          console.error("📋 Error stack:", error.stack);
        }
      }

      res.status(200).json({
        success: true,
        message: "Password changed successfully!",
      });
    } catch (error: unknown) {
      console.error("Complete password change error:", error);
      res.status(500).json({
        success: false,
        message: "Password change completion failed.",
      });
    }
  }
}
