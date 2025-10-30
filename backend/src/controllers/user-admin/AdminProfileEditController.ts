import { Request, Response } from "express";
import { User } from "../../models";
import AuditLog from "../../models/AuditLog";
import { ROLES } from "../../utils/roleUtils";
import { cleanupOldAvatar } from "../../utils/avatarCleanup";
import { socketService } from "../../services/infrastructure/SocketService";
import { CachePatterns } from "../../services";

/**
 * AdminProfileEditController
 * Handles adminEditProfile - allows admins to edit limited user profile fields
 */
export default class AdminProfileEditController {
  /**
   * Admin edit profile - allows Super Admin/Administrator to edit limited fields of other users
   */
  static async adminEditProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Only Super Admin and Administrator can use this endpoint
      if (
        req.user.role !== ROLES.SUPER_ADMIN &&
        req.user.role !== ROLES.ADMINISTRATOR
      ) {
        res.status(403).json({
          success: false,
          message:
            "Only Super Admin and Administrator can edit other users' profiles.",
        });
        return;
      }

      const { id: targetUserId } = req.params;
      const { avatar, phone, isAtCloudLeader, roleInAtCloud } = req.body;

      // Validate that the user exists
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Validate @Cloud co-worker requirements
      if (isAtCloudLeader && !roleInAtCloud) {
        res.status(400).json({
          success: false,
          message: "Role in @Cloud is required for @Cloud co-workers.",
        });
        return;
      }

      // Store old values for audit logging
      const oldValues = {
        avatar: targetUser.avatar,
        phone: targetUser.phone,
        isAtCloudLeader: targetUser.isAtCloudLeader,
        roleInAtCloud: targetUser.roleInAtCloud,
      };

      // Build update object with only allowed fields
      const updateData: Record<string, unknown> = {};
      const unsetData: Record<string, unknown> = {};

      if (avatar !== undefined) updateData.avatar = avatar;
      if (phone !== undefined) updateData.phone = phone;
      if (isAtCloudLeader !== undefined)
        updateData.isAtCloudLeader = isAtCloudLeader;
      if (roleInAtCloud !== undefined) updateData.roleInAtCloud = roleInAtCloud;

      // If user is no longer an @Cloud co-worker, clear the role
      if (isAtCloudLeader === false) {
        unsetData.roleInAtCloud = "";
        delete updateData.roleInAtCloud; // Remove from $set if it was added
      }

      // Update the user
      const updateQuery: Record<string, unknown> = {};
      if (Object.keys(updateData).length > 0) {
        updateQuery.$set = updateData;
      }
      if (Object.keys(unsetData).length > 0) {
        updateQuery.$unset = unsetData;
      }

      const updatedUser = await User.findByIdAndUpdate(
        targetUserId,
        updateQuery,
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: "Failed to update user.",
        });
        return;
      }

      // Cleanup old avatar file if a new avatar was uploaded (async, don't wait for it)
      if (
        avatar !== undefined &&
        oldValues.avatar !== avatar &&
        oldValues.avatar
      ) {
        cleanupOldAvatar(String(targetUserId), oldValues.avatar).catch(
          (error) => {
            console.error(
              "Failed to cleanup old avatar during admin edit:",
              error
            );
          }
        );
      }

      // Create audit log entry
      try {
        const changes: Record<string, { old: unknown; new: unknown }> = {};

        if (avatar !== undefined && oldValues.avatar !== avatar) {
          changes.avatar = { old: oldValues.avatar, new: avatar };
        }
        if (phone !== undefined && oldValues.phone !== phone) {
          changes.phone = { old: oldValues.phone, new: phone };
        }
        if (
          isAtCloudLeader !== undefined &&
          oldValues.isAtCloudLeader !== isAtCloudLeader
        ) {
          changes.isAtCloudLeader = {
            old: oldValues.isAtCloudLeader,
            new: isAtCloudLeader,
          };
        }
        if (
          roleInAtCloud !== undefined &&
          oldValues.roleInAtCloud !== roleInAtCloud
        ) {
          changes.roleInAtCloud = {
            old: oldValues.roleInAtCloud,
            new: roleInAtCloud,
          };
        }

        if (Object.keys(changes).length > 0) {
          await AuditLog.create({
            action: "admin_profile_edit",
            actor: {
              id: req.user._id,
              role: req.user.role,
              email: req.user.email,
            },
            targetModel: "User",
            targetId: targetUserId,
            details: {
              targetUser: {
                id: updatedUser._id,
                email: updatedUser.email,
                name:
                  `${updatedUser.firstName || ""} ${
                    updatedUser.lastName || ""
                  }`.trim() || updatedUser.username,
              },
              changes,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || "unknown",
          });
        }
      } catch (auditError) {
        console.error(
          "Failed to create audit log for admin profile edit:",
          auditError
        );
        // Don't fail the request if audit logging fails
      }

      // Invalidate caches so updated profile appears immediately
      await CachePatterns.invalidateUserCache(targetUserId);

      // Emit real-time update for Management page
      socketService.emitUserUpdate(String(updatedUser._id), {
        type: "profile_edited",
        user: {
          id: String(updatedUser._id),
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.firstName || undefined,
          lastName: updatedUser.lastName || undefined,
          role: updatedUser.role,
          avatar: updatedUser.avatar || undefined,
          phone: updatedUser.phone || undefined,
          isAtCloudLeader: updatedUser.isAtCloudLeader || undefined,
          roleInAtCloud: updatedUser.roleInAtCloud || undefined,
          isActive: updatedUser.isActive !== false,
        },
        changes: {
          avatar: avatar !== undefined,
          phone: phone !== undefined,
          isAtCloudLeader: isAtCloudLeader !== undefined,
          roleInAtCloud: roleInAtCloud !== undefined,
        },
      });

      res.status(200).json({
        success: true,
        message: "Profile updated successfully by admin.",
        data: {
          id: updatedUser._id,
          avatar: updatedUser.avatar,
          phone: updatedUser.phone,
          isAtCloudLeader: updatedUser.isAtCloudLeader,
          roleInAtCloud: updatedUser.roleInAtCloud,
        },
      });
    } catch (error: unknown) {
      console.error("Admin edit profile error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update user profile",
      });
    }
  }
}
