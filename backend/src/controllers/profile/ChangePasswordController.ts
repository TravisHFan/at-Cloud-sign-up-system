import { Request, Response } from "express";
import { User } from "../../models";

export default class ChangePasswordController {
  /**
   * Change password
   * POST /api/users/:id/change-password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const requestingUserId = req.user?._id?.toString();

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        res.status(400).json({
          success: false,
          error:
            "Current password, new password, and confirmation are required",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          error: "New password and confirmation do not match",
        });
        return;
      }

      // Password strength validation
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          error: "New password must be at least 8 characters long",
        });
        return;
      }

      // Users can only change their own password
      if (id !== requestingUserId) {
        res.status(403).json({
          success: false,
          error: "You can only change your own password",
        });
        return;
      }

      // Find user (include password field for comparison)
      const user = await User.findById(id).select("+password");
      if (!user) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      // Verify current password
      let isCurrentPasswordValid = false;
      try {
        isCurrentPasswordValid = await user.comparePassword(currentPassword);
      } catch (error) {
        console.error("Password comparison error:", error);
        res.status(500).json({
          success: false,
          error: "Password verification failed",
        });
        return;
      }

      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
        return;
      }

      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      await user.save();

      res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error: unknown) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to change password",
      });
    }
  }
}
