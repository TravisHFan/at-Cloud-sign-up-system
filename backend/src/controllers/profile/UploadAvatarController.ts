import { Request, Response } from "express";
import { User } from "../../models";
import Program from "../../models/Program";
import Message from "../../models/Message";
import { getFileUrl } from "../../middleware/upload";
import { cleanupOldAvatar } from "../../utils/avatarCleanup";
import { socketService } from "../../services/infrastructure/SocketService";
import { createLogger } from "../../services/LoggerService";

const log = createLogger("ProfileController");

export default class UploadAvatarController {
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
      // Use absolute URL to ensure images work in production where frontend and backend are separate
      const baseAvatarUrl = getFileUrl(req, `avatars/${req.file.filename}`, {
        absolute: true,
      });
      const avatarUrl = `${baseAvatarUrl}?t=${Date.now()}`;
      console.log(`📸 Avatar upload successful:`);
      console.log(`  - File path: ${req.file.path}`);
      console.log(`  - Avatar URL: ${avatarUrl}`);
      console.log(`  - Filename: ${req.file.filename}`);

      // Update user's avatar
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarUrl },
        { new: true, select: "-password" },
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
          { arrayFilters: [{ "elem.userId": req.user._id }] },
        ),
        // Update Message creator
        Message.updateMany(
          { "creator.id": String(req.user._id) },
          { $set: { "creator.avatar": avatarUrl } },
        ),
      ]);

      // Cleanup old avatar file (async, don't wait for it)
      if (oldAvatarUrl) {
        cleanupOldAvatar(String(currentUser._id), oldAvatarUrl).catch(
          (error) => {
            console.error("Failed to cleanup old avatar:", error);
          },
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
}
