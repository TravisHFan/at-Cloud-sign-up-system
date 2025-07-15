import { Request, Response } from "express";
import { User, IUser } from "../models";
import {
  RoleUtils,
  ROLES,
  hasPermission,
  PERMISSIONS,
} from "../utils/roleUtils";
import bcrypt from "bcryptjs";
import { getFileUrl } from "../middleware/upload";
import path from "path";

// Interface for updating profile (matches frontend profileSchema)
interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  isAtCloudLeader?: boolean;
  roleInAtCloud?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
}

// Interface for changing password
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export class UserController {
  // Get current user profile
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
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
            occupation: req.user.occupation,
            company: req.user.company,
            weeklyChurch: req.user.weeklyChurch,
            lastLogin: req.user.lastLogin,
            createdAt: req.user.createdAt,
            emailNotifications: req.user.emailNotifications,
            smsNotifications: req.user.smsNotifications,
            pushNotifications: req.user.pushNotifications,
            isVerified: req.user.isVerified,
            isActive: req.user.isActive,
          },
        },
      });
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile.",
      });
    }
  }

  // Update user profile
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

      // Validate @Cloud leader requirements
      if (updateData.isAtCloudLeader && !updateData.roleInAtCloud) {
        res.status(400).json({
          success: false,
          message: "Role in @Cloud is required for @Cloud leaders.",
        });
        return;
      }

      // If user is no longer an @Cloud leader, clear the role
      if (updateData.isAtCloudLeader === false) {
        updateData.roleInAtCloud = undefined;
      }

      // Update avatar based on gender if changed
      if (updateData.gender && updateData.gender !== req.user.gender) {
        const user = await User.findById(req.user._id);
        if (user) {
          if (updateData.gender === "female") {
            user.avatar = "/default-avatar-female.jpg";
          } else if (updateData.gender === "male") {
            user.avatar = "/default-avatar-male.jpg";
          }
          await user.save();
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
            occupation: updatedUser.occupation,
            company: updatedUser.company,
            weeklyChurch: updatedUser.weeklyChurch,
            emailNotifications: updatedUser.emailNotifications,
            smsNotifications: updatedUser.smsNotifications,
            pushNotifications: updatedUser.pushNotifications,
          },
        },
      });
    } catch (error: any) {
      console.error("Update profile error:", error);

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message
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

  // Change password
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const {
        currentPassword,
        newPassword,
        confirmPassword,
      }: ChangePasswordRequest = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        res.status(400).json({
          success: false,
          message:
            "Current password, new password, and confirmation are required.",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: "New passwords do not match.",
        });
        return;
      }

      // Get user with password
      const user = await User.findById(req.user._id).select("+password");

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );

      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
        return;
      }

      // Check if new password is different from current
      const isSamePassword = await user.comparePassword(newPassword);

      if (isSamePassword) {
        res.status(400).json({
          success: false,
          message: "New password must be different from current password.",
        });
        return;
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Password changed successfully!",
      });
    } catch (error: any) {
      console.error("Change password error:", error);

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        res.status(400).json({
          success: false,
          message: "Password validation failed.",
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to change password.",
      });
    }
  }

  // Get user by ID (for admins and specific cases)
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check if user can access this profile
      const canAccessProfile = RoleUtils.canAccessUserProfile(
        req.user.role,
        (req.user._id as any).toString(),
        id,
        "" // We'll check this after getting the target user
      );

      const targetUser = await User.findById(id);

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Final permission check with target user's role
      const finalCanAccess = RoleUtils.canAccessUserProfile(
        req.user.role,
        (req.user._id as any).toString(),
        id,
        targetUser.role
      );

      if (!finalCanAccess) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to access this profile.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: targetUser._id,
            username: targetUser.username,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            gender: targetUser.gender,
            avatar: targetUser.avatar,
            role: targetUser.role,
            isAtCloudLeader: targetUser.isAtCloudLeader,
            roleInAtCloud: targetUser.roleInAtCloud,
            occupation: targetUser.occupation,
            company: targetUser.company,
            weeklyChurch: targetUser.weeklyChurch,
            lastLogin: targetUser.lastLogin,
            createdAt: targetUser.createdAt,
            isVerified: targetUser.isVerified,
            isActive: targetUser.isActive,
          },
        },
      });
    } catch (error: any) {
      console.error("Get user by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user.",
      });
    }
  }

  // Get all users (admin only)
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.MANAGE_USERS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to view all users.",
        });
        return;
      }

      const {
        page = 1,
        limit = 20,
        role,
        isActive,
        isVerified,
        isAtCloudLeader,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);
      const skip = (pageNumber - 1) * limitNumber;

      // Build filter object
      const filter: any = {};

      if (role) {
        filter.role = role;
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
      }

      if (isVerified !== undefined) {
        filter.isVerified = isVerified === "true";
      }

      if (isAtCloudLeader !== undefined) {
        filter.isAtCloudLeader = isAtCloudLeader === "true";
      }

      // Text search
      if (search) {
        filter.$text = { $search: search as string };
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      // Get users with pagination
      const users = await User.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .select("-password -emailVerificationToken -passwordResetToken");

      const totalUsers = await User.countDocuments(filter);
      const totalPages = Math.ceil(totalUsers / limitNumber);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: pageNumber,
            totalPages,
            totalUsers,
            hasNext: pageNumber < totalPages,
            hasPrev: pageNumber > 1,
          },
        },
      });
    } catch (error: any) {
      console.error("Get all users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve users.",
      });
    }
  }

  // Update user role (admin only)
  static async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.EDIT_USER_ROLES)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to edit user roles.",
        });
        return;
      }

      if (!role || !RoleUtils.isValidRole(role)) {
        res.status(400).json({
          success: false,
          message: "Valid role is required.",
        });
        return;
      }

      const targetUser = await User.findById(id);

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Check if role change is allowed
      const canPromote = RoleUtils.canPromoteUser(
        req.user.role,
        targetUser.role,
        role
      );

      if (!canPromote) {
        res.status(403).json({
          success: false,
          message: "You cannot promote this user to the specified role.",
        });
        return;
      }

      // Update role
      targetUser.role = role;
      await targetUser.save();

      res.status(200).json({
        success: true,
        message: `User role updated to ${role} successfully!`,
        data: {
          user: {
            id: targetUser._id,
            username: targetUser.username,
            email: targetUser.email,
            role: targetUser.role,
          },
        },
      });
    } catch (error: any) {
      console.error("Update user role error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user role.",
      });
    }
  }

  // Deactivate user (admin only)
  static async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.DEACTIVATE_USERS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to deactivate users.",
        });
        return;
      }

      const targetUser = await User.findById(id);

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Prevent deactivating own account
      if (
        (targetUser._id as any).toString() === (req.user._id as any).toString()
      ) {
        res.status(400).json({
          success: false,
          message: "You cannot deactivate your own account.",
        });
        return;
      }

      // Prevent non-super admins from deactivating super admins
      if (
        targetUser.role === ROLES.SUPER_ADMIN &&
        !RoleUtils.isSuperAdmin(req.user.role)
      ) {
        res.status(403).json({
          success: false,
          message: "You cannot deactivate a Super Admin.",
        });
        return;
      }

      // Deactivate user
      targetUser.isActive = false;
      await targetUser.save();

      res.status(200).json({
        success: true,
        message: "User deactivated successfully!",
      });
    } catch (error: any) {
      console.error("Deactivate user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to deactivate user.",
      });
    }
  }

  // Reactivate user (admin only)
  static async reactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.DEACTIVATE_USERS)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to reactivate users.",
        });
        return;
      }

      const targetUser = await User.findById(id);

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Reactivate user
      targetUser.isActive = true;
      await targetUser.save();

      res.status(200).json({
        success: true,
        message: "User reactivated successfully!",
      });
    } catch (error: any) {
      console.error("Reactivate user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reactivate user.",
      });
    }
  }

  // Get user statistics (admin only)
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

      const stats = await (User as any).getUserStats();

      res.status(200).json({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      console.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user statistics.",
      });
    }
  }

  // Upload avatar
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

      // Generate avatar URL
      const avatarUrl = getFileUrl(req, `avatars/${req.file.filename}`);

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

      res.status(200).json({
        success: true,
        message: "Avatar uploaded successfully.",
        data: { avatarUrl },
      });
    } catch (error: any) {
      console.error("Upload avatar error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload avatar.",
      });
    }
  }
}
