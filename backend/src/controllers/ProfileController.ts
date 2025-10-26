import { Request, Response } from "express";
import { User } from "../models";
import Program from "../models/Program";
import Message from "../models/Message";
import { getFileUrl } from "../middleware/upload";
import { cleanupOldAvatar } from "../utils/avatarCleanup";
import { socketService } from "../services/infrastructure/SocketService";
import { AutoEmailNotificationService } from "../services/infrastructure/autoEmailNotificationService";
import { CachePatterns } from "../services";
import { createLogger } from "../services/LoggerService";

const log = createLogger("ProfileController");

// Response helper utilities
class ResponseHelper {
  static success(
    res: Response,
    data?: unknown,
    message?: string,
    statusCode: number = 200
  ): void {
    const payload: Record<string, unknown> = { success: true };
    if (message) payload.message = message;
    if (typeof data !== "undefined") payload.data = data as unknown;
    res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    error?: unknown
  ): void {
    console.error(`Error (${statusCode}):`, message, error);
    // Structured log alongside console for observability (tests may assert console output)
    const asError = error instanceof Error ? error : undefined;
    try {
      log.error(
        `Response error ${statusCode}: ${message}`,
        asError,
        undefined,
        { statusCode }
      );
    } catch {
      // Avoid impacting response flow if logging throws for any reason
    }
    res.status(statusCode).json({
      success: false,
      message,
    });
  }

  static authRequired(res: Response): void {
    ResponseHelper.error(res, "Authentication required.", 401);
  }

  static serverError(res: Response, error?: unknown): void {
    ResponseHelper.error(res, "Internal server error.", 500, error);
  }
}

// Interface for updating profile (matches frontend profileSchema exactly)
interface UpdateProfileRequest {
  username?: string;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  email?: string;
  phone?: string;
  isAtCloudLeader?: boolean;
  roleInAtCloud?: string;
  homeAddress?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;
}

/**
 * ProfileController
 *
 * Handles user profile management operations:
 * - View profile
 * - Update profile information
 * - Upload avatar
 * - Change password
 */
export class ProfileController {
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseHelper.authRequired(res);
        return;
      }

      const userData = {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phone: req.user.phone,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        gender: req.user.gender,
        avatar: req.user.avatar,
        role: req.user.role,
        isAtCloudLeader: req.user.isAtCloudLeader,
        roleInAtCloud: req.user.roleInAtCloud,
        homeAddress: req.user.homeAddress,
        occupation: req.user.occupation,
        company: req.user.company,
        weeklyChurch: req.user.weeklyChurch,
        churchAddress: req.user.churchAddress,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
        isVerified: req.user.isVerified,
        isActive: req.user.isActive,
      };

      ResponseHelper.success(res, { user: userData });
    } catch (error: unknown) {
      ResponseHelper.serverError(res, error);
    }
  }

  /**
   * Update user profile
   * PUT /api/users/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const updateData: UpdateProfileRequest = req.body;

      // Validate @Cloud co-worker requirements
      if (updateData.isAtCloudLeader && !updateData.roleInAtCloud) {
        res.status(400).json({
          success: false,
          message: "Role in @Cloud is required for @Cloud co-workers.",
        });
        return;
      }

      // If user is no longer an @Cloud co-worker, clear the role
      if (updateData.isAtCloudLeader === false) {
        updateData.roleInAtCloud = undefined;
      }

      // Store old @Cloud values for change detection
      const oldIsAtCloudLeader = req.user.isAtCloudLeader;
      const oldRoleInAtCloud = req.user.roleInAtCloud;

      // Update avatar based on gender if changed
      if (updateData.gender && updateData.gender !== req.user.gender) {
        const user = await User.findById(req.user._id);
        if (user) {
          const oldAvatarUrl = user.avatar;

          if (updateData.gender === "female") {
            user.avatar = "/default-avatar-female.jpg";
          } else if (updateData.gender === "male") {
            user.avatar = "/default-avatar-male.jpg";
          }
          await user.save();

          // Cleanup old uploaded avatar (async, don't wait for it)
          if (oldAvatarUrl) {
            cleanupOldAvatar(String(user._id), oldAvatarUrl).catch((error) => {
              console.error(
                "Failed to cleanup old avatar during gender change:",
                error
              );
            });
          }
        }
      }

      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Check for @Cloud role changes and send admin notifications
      const newIsAtCloudLeader = updatedUser.isAtCloudLeader;
      const newRoleInAtCloud = updatedUser.roleInAtCloud;

      // Detect @Cloud role changes for admin notifications
      if (oldIsAtCloudLeader !== newIsAtCloudLeader) {
        try {
          if (!oldIsAtCloudLeader && newIsAtCloudLeader) {
            // Scenario 2: Profile Change - No to Yes
            await AutoEmailNotificationService.sendAtCloudRoleChangeNotification(
              {
                userData: {
                  _id: String(updatedUser._id),
                  firstName: updatedUser.firstName || updatedUser.username,
                  lastName: updatedUser.lastName || "",
                  email: updatedUser.email,
                  roleInAtCloud: updatedUser.roleInAtCloud,
                },
                changeType: "assigned",
                // Use the actual acting user as the creator/sender
                systemUser: {
                  _id: String(updatedUser._id),
                  firstName: updatedUser.firstName || updatedUser.username,
                  lastName: updatedUser.lastName || "",
                  email: updatedUser.email,
                  role: updatedUser.role,
                  avatar: updatedUser.avatar,
                  gender: updatedUser.gender,
                },
              }
            );
            console.log(
              `Admin notifications sent for @Cloud role assignment: ${updatedUser.email}`
            );
          } else if (oldIsAtCloudLeader && !newIsAtCloudLeader) {
            // Scenario 3: Profile Change - Yes to No
            await AutoEmailNotificationService.sendAtCloudRoleChangeNotification(
              {
                userData: {
                  _id: String(updatedUser._id),
                  firstName: updatedUser.firstName || updatedUser.username,
                  lastName: updatedUser.lastName || "",
                  email: updatedUser.email,
                  previousRoleInAtCloud: oldRoleInAtCloud,
                },
                changeType: "removed",
                // Use the actual acting user as the creator/sender
                systemUser: {
                  _id: String(updatedUser._id),
                  firstName: updatedUser.firstName || updatedUser.username,
                  lastName: updatedUser.lastName || "",
                  email: updatedUser.email,
                  role: updatedUser.role,
                  avatar: updatedUser.avatar,
                  gender: updatedUser.gender,
                },
              }
            );
            console.log(
              `Admin notifications sent for @Cloud role removal: ${updatedUser.email}`
            );
          }
        } catch (notificationError) {
          console.error(
            "Failed to send @Cloud admin notifications for profile update:",
            notificationError
          );
          // Don't fail the profile update if notification fails
        }
      }

      // Edge Case: User remains an @Cloud co-worker but changes role (no admin notification needed)
      // This intentionally does not trigger notifications since they're still an @Cloud co-worker
      if (
        oldIsAtCloudLeader &&
        newIsAtCloudLeader &&
        oldRoleInAtCloud !== newRoleInAtCloud
      ) {
        console.log(
          `@Cloud role change within co-worker status: ${updatedUser.email} (${oldRoleInAtCloud} → ${newRoleInAtCloud})`
        );
        // No admin notification for role changes within @Cloud co-worker status
      }

      // Invalidate user-related caches after successful update
      await CachePatterns.invalidateUserCache(String(updatedUser._id));

      res.status(200).json({
        success: true,
        message: "Profile updated successfully!",
        data: {
          user: {
            id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            phone: updatedUser.phone,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            gender: updatedUser.gender,
            avatar: updatedUser.avatar,
            role: updatedUser.role,
            isAtCloudLeader: updatedUser.isAtCloudLeader,
            roleInAtCloud: updatedUser.roleInAtCloud,
            homeAddress: updatedUser.homeAddress,
            occupation: updatedUser.occupation,
            company: updatedUser.company,
            weeklyChurch: updatedUser.weeklyChurch,
            churchAddress: updatedUser.churchAddress,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Update profile error:", error);
      // Narrow known validation error shape from Mongoose
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "ValidationError"
      ) {
        const raw =
          (error as { errors?: Record<string, { message: string }> }).errors ||
          {};
        const validationErrors = Object.values(raw).map(
          (err: { message: string }) => err.message
        );
        res.status(400).json({
          success: false,
          message: "Validation failed.",
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to update profile.",
      });
    }
  }

  /**
   * Upload avatar
   * POST /api/users/avatar
   */
  static async uploadAvatar(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
        return;
      }

      // Get current user to access old avatar
      const currentUser = await User.findById(req.user._id);
      if (!currentUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      const oldAvatarUrl = currentUser.avatar;

      // Generate new avatar URL with cache-busting timestamp
      const baseAvatarUrl = getFileUrl(req, `avatars/${req.file.filename}`);
      const avatarUrl = `${baseAvatarUrl}?t=${Date.now()}`;
      console.log(`📸 Avatar upload successful:`);
      console.log(`  - File path: ${req.file.path}`);
      console.log(`  - Avatar URL: ${avatarUrl}`);
      console.log(`  - Filename: ${req.file.filename}`);

      // Update user's avatar
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarUrl },
        { new: true, select: "-password" }
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Update denormalized avatar data across all collections
      // This ensures avatar updates propagate to program mentors and message creators
      await Promise.all([
        // Update Program mentors
        Program.updateMany(
          { "mentors.userId": req.user._id },
          { $set: { "mentors.$[elem].avatar": avatarUrl } },
          { arrayFilters: [{ "elem.userId": req.user._id }] }
        ),
        // Update Message creator
        Message.updateMany(
          { "creator.id": String(req.user._id) },
          { $set: { "creator.avatar": avatarUrl } }
        ),
      ]);

      // Cleanup old avatar file (async, don't wait for it)
      if (oldAvatarUrl) {
        cleanupOldAvatar(String(currentUser._id), oldAvatarUrl).catch(
          (error) => {
            console.error("Failed to cleanup old avatar:", error);
          }
        );
      }

      // Emit WebSocket event for real-time avatar updates across the app
      socketService.emitUserUpdate(String(updatedUser._id), {
        type: "profile_edited",
        user: {
          id: String(updatedUser._id),
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          avatar: updatedUser.avatar,
          phone: updatedUser.phone,
          isAtCloudLeader: updatedUser.isAtCloudLeader,
          roleInAtCloud: updatedUser.roleInAtCloud,
          isActive: updatedUser.isActive,
        },
        changes: {
          avatar: true,
        },
      });

      log.info("Avatar updated and WebSocket event emitted", undefined, {
        userId: String(updatedUser._id),
        avatarUrl: updatedUser.avatar,
      });

      res.status(200).json({
        success: true,
        message: "Avatar uploaded successfully.",
        data: {
          avatarUrl,
          user: {
            id: updatedUser._id,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Upload avatar error:", error);
      if (error && typeof error === "object" && "stack" in error) {
        console.error("Error stack:", (error as { stack?: string }).stack);
      }
      res.status(500).json({
        success: false,
        message: "Failed to upload avatar.",
      });
    }
  }

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
