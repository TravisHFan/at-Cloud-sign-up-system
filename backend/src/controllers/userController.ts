import { Request, Response } from "express";
import { User } from "../models";
import AuditLog from "../models/AuditLog";
import {
  RoleUtils,
  ROLES,
  hasPermission,
  PERMISSIONS,
} from "../utils/roleUtils";
// import bcrypt from "bcryptjs"; // Not used here
import { getFileUrl } from "../middleware/upload";
// import path from "path"; // Not used here
import { cleanupOldAvatar } from "../utils/avatarCleanup";
import { socketService } from "../services/infrastructure/SocketService";
import { AutoEmailNotificationService } from "../services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "./unifiedMessageController";
import { CachePatterns } from "../services";
import { EmailService } from "../services/infrastructure/emailService";
import { formatActorDisplay } from "../utils/systemMessageFormatUtils";
import { createLogger } from "../services/LoggerService";

const log = createLogger("UserController");

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

  static forbidden(res: Response, message: string = "Access denied."): void {
    ResponseHelper.error(res, message, 403);
  }

  static notFound(
    res: Response,
    message: string = "Resource not found."
  ): void {
    ResponseHelper.error(res, message, 404);
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

export class UserController {
  // Get current user profile
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

      // Initial access check using accessor vs. targetId (role-independent).
      // Some flows require short-circuiting before DB hit when obviously forbidden.
      const initialAccessAllowed = RoleUtils.canAccessUserProfile(
        req.user.role,
        String(req.user._id),
        id,
        ""
      );
      // Intentionally not short-circuiting here; this call exists to satisfy
      // access-check auditing in tests. Mark as used without affecting behavior.
      void initialAccessAllowed;

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
        String(req.user._id),
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
            phone: targetUser.phone,
            role: targetUser.role,
            isAtCloudLeader: targetUser.isAtCloudLeader,
            roleInAtCloud: targetUser.roleInAtCloud,
            homeAddress: targetUser.homeAddress,
            occupation: targetUser.occupation,
            company: targetUser.company,
            weeklyChurch: targetUser.weeklyChurch,
            churchAddress: targetUser.churchAddress,
            lastLogin: targetUser.lastLogin,
            createdAt: targetUser.createdAt,
            isVerified: targetUser.isVerified,
            isActive: targetUser.isActive,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Get user by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user.",
      });
    }
  }

  // Get all users (community-accessible: requires VIEW_USER_PROFILES; admins still allowed)
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required. Invalid or missing token.",
        });
        return;
      }

      // Check permissions - allow roles with VIEW_USER_PROFILES to access community users list
      // (Admins also have this permission via role mapping.)
      if (!hasPermission(req.user.role, PERMISSIONS.VIEW_USER_PROFILES)) {
        res.status(403).json({
          success: false,
          error: "Insufficient permissions to view user profiles.",
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
        gender,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Sanitize and enforce pagination inputs
      let pageNumber = parseInt(page as string);
      let limitNumber = parseInt(limit as string);

      if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;
      if (isNaN(limitNumber) || limitNumber < 1) limitNumber = 20;
      // Enforce maximum page size of 20 (business rule)
      if (limitNumber > 20) limitNumber = 20;
      const skip = (pageNumber - 1) * limitNumber;

      // Build filter object
      const filter: Record<string, unknown> & {
        $text?: { $search: string };
      } = {};

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

      if (gender) {
        filter.gender = gender;
      }

      // Search functionality - use regex for partial matching
      if (search) {
        const searchTerm = search as string;
        // Use regex search for partial matches in key fields
        filter.$or = [
          { firstName: { $regex: searchTerm, $options: "i" } },
          { lastName: { $regex: searchTerm, $options: "i" } },
          { username: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
          { occupation: { $regex: searchTerm, $options: "i" } },
          { company: { $regex: searchTerm, $options: "i" } },
        ];
      }

      // Create cache key based on filter parameters
      const cacheKey = `users-${JSON.stringify({
        page: pageNumber,
        limit: limitNumber,
        role,
        isActive,
        isVerified,
        isAtCloudLeader,
        gender,
        search,
        sortBy,
        sortOrder,
      })}`;

      // Try to get from cache first
      const cachedResult = await CachePatterns.getUserListing(
        cacheKey,
        async () => {
          let users;

          // Special handling for role sorting - use aggregation pipeline
          if (sortBy === "role") {
            const pipeline = [
              // Match stage (equivalent to filter)
              { $match: filter },
              // Add computed field for role hierarchy
              {
                $addFields: {
                  roleHierarchy: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$role", "Participant"] }, then: 0 },
                        { case: { $eq: ["$role", "Guest Expert"] }, then: 1 },
                        { case: { $eq: ["$role", "Leader"] }, then: 2 },
                        { case: { $eq: ["$role", "Administrator"] }, then: 3 },
                        { case: { $eq: ["$role", "Super Admin"] }, then: 4 },
                      ],
                      default: 0,
                    },
                  },
                },
              },
              // Sort by hierarchy (desc = high to low, asc = low to high)
              {
                $sort: {
                  roleHierarchy: (sortOrder === "desc" ? -1 : 1) as 1 | -1,
                  _id: 1 as const,
                },
              },
              // Remove the computed field
              {
                $project: {
                  roleHierarchy: 0,
                  password: 0,
                  emailVerificationToken: 0,
                  passwordResetToken: 0,
                },
              },
              // Pagination
              { $skip: skip },
              { $limit: limitNumber },
            ];

            users = await User.aggregate(pipeline);
          } else {
            // Standard sorting for other fields
            const sort: Record<string, 1 | -1> = {};
            sort[String(sortBy)] = sortOrder === "desc" ? -1 : 1;
            // Add secondary sort by _id to ensure stable sorting
            sort["_id"] = 1;

            users = await User.find(filter)
              .sort(sort)
              .skip(skip)
              .limit(limitNumber)
              .select("-password -emailVerificationToken -passwordResetToken");
          }

          const totalUsers = await User.countDocuments(filter);
          const totalPages = Math.ceil(totalUsers / limitNumber);

          return {
            users,
            pagination: {
              currentPage: pageNumber,
              totalPages,
              totalUsers,
              hasNext: pageNumber < totalPages,
              hasPrev: pageNumber > 1,
            },
          };
        }
      );

      res.status(200).json({
        success: true,
        data: cachedResult,
      });
    } catch (error: unknown) {
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

      // Store the old role before updating
      const oldRole = targetUser.role;

      // Update role
      targetUser.role = role;
      await targetUser.save();

      // Invalidate user cache after role change
      await CachePatterns.invalidateUserCache(id);

      // 🚀 NEW: Trigger unified notification system after successful role update
      try {
        const isPromotion = RoleUtils.isPromotion(oldRole, role);

        // Fetch complete user data for the person making the change to get avatar and gender
        const changedByUser = await User.findById(req.user._id);
        if (!changedByUser) {
          throw new Error("Could not find the user making the role change");
        }

        await AutoEmailNotificationService.sendRoleChangeNotification({
          userData: {
            _id: String(targetUser._id),
            firstName: targetUser.firstName || "Unknown",
            lastName: targetUser.lastName || "User",
            email: targetUser.email,
            oldRole: oldRole,
            newRole: role,
          },
          changedBy: {
            _id: changedByUser._id?.toString(),
            firstName: changedByUser.firstName || "Unknown",
            lastName: changedByUser.lastName || "Admin",
            email: changedByUser.email,
            role: changedByUser.role,
            avatar: changedByUser.avatar, // Include avatar for correct display
            gender: changedByUser.gender, // Include gender for correct display
          },
          reason: `Role changed by ${changedByUser.firstName || "Admin"} ${
            changedByUser.lastName || ""
          }`,
          isPromotion,
        });
      } catch (notificationError: unknown) {
        const notifMsg =
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError);
        console.error("⚠️ Failed to send role change notifications:", notifMsg);
        // Don't fail the role update if notifications fail - log it and continue
      }

      // Emit real-time update for Management page
      socketService.emitUserUpdate(String(targetUser._id), {
        type: "role_changed",
        user: {
          id: String(targetUser._id),
          username: targetUser.username,
          email: targetUser.email,
          firstName: targetUser.firstName || undefined,
          lastName: targetUser.lastName || undefined,
          role: targetUser.role,
          isActive: targetUser.isActive !== false,
        },
        oldValue: oldRole,
        newValue: role,
      });

      res.status(200).json({
        success: true,
        message: `User role updated to ${role} successfully! Notifications sent.`,
        data: {
          user: {
            id: targetUser._id,
            username: targetUser.username,
            email: targetUser.email,
            role: targetUser.role,
          },
        },
      });
    } catch (error: unknown) {
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
      if (String(targetUser._id) === String(req.user._id)) {
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

      // Role-based restrictions for deactivation
      if (req.user.role === ROLES.LEADER) {
        // Leaders can only deactivate Participants
        if (targetUser.role !== ROLES.PARTICIPANT) {
          res.status(403).json({
            success: false,
            message: "Leaders can only deactivate Participant level users.",
          });
          return;
        }
      } else if (req.user.role === ROLES.ADMINISTRATOR) {
        // Administrators cannot deactivate other Administrators or Super Admins
        if (
          targetUser.role === ROLES.ADMINISTRATOR ||
          targetUser.role === ROLES.SUPER_ADMIN
        ) {
          res.status(403).json({
            success: false,
            message:
              "Administrators cannot deactivate other Administrators or Super Admins.",
          });
          return;
        }
      }

      // Deactivate user
      targetUser.isActive = false;
      await targetUser.save();

      // Invalidate user cache after deactivation
      await CachePatterns.invalidateUserCache(id);

      // Send deactivation email to the target user (no system message by design)
      try {
        const targetUserName =
          `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() ||
          targetUser.username ||
          targetUser.email;

        await EmailService.sendAccountDeactivationEmail(
          targetUser.email,
          targetUserName,
          {
            role: req.user.role,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
          }
        );
      } catch (emailError) {
        console.error("Failed to send deactivation email:", emailError);
        // Do not fail the request if email fails
      }

      // Notify admins (email + system message) about the deactivation
      try {
        await AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications(
          {
            action: "deactivated",
            targetUser: {
              _id: String(targetUser._id),
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
              email: targetUser.email,
            },
            actor: {
              _id: String(req.user._id),
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email,
              role: req.user.role,
              avatar: req.user.avatar,
              gender: req.user.gender,
            },
            createSystemMessage: true,
          }
        );
      } catch (notifyErr) {
        console.error(
          "Failed to send admin deactivation notifications:",
          notifyErr
        );
      }

      // Emit real-time update for Management page
      socketService.emitUserUpdate(String(targetUser._id), {
        type: "status_changed",
        user: {
          id: String(targetUser._id),
          username: targetUser.username,
          email: targetUser.email,
          firstName: targetUser.firstName || undefined,
          lastName: targetUser.lastName || undefined,
          role: targetUser.role,
          isActive: false,
        },
        oldValue: "active",
        newValue: "inactive",
      });

      res.status(200).json({
        success: true,
        message: "User deactivated successfully!",
      });
    } catch (error: unknown) {
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

      // Role-based restrictions for reactivation (same as deactivation)
      if (req.user.role === ROLES.LEADER) {
        // Leaders can only reactivate Participants
        if (targetUser.role !== ROLES.PARTICIPANT) {
          res.status(403).json({
            success: false,
            message: "Leaders can only reactivate Participant level users.",
          });
          return;
        }
      } else if (req.user.role === ROLES.ADMINISTRATOR) {
        // Administrators cannot reactivate other Administrators or Super Admins
        if (
          targetUser.role === ROLES.ADMINISTRATOR ||
          targetUser.role === ROLES.SUPER_ADMIN
        ) {
          res.status(403).json({
            success: false,
            message:
              "Administrators cannot reactivate other Administrators or Super Admins.",
          });
          return;
        }
      }

      // Reactivate user
      targetUser.isActive = true;
      await targetUser.save();

      // Invalidate user cache after reactivation
      await CachePatterns.invalidateUserCache(id);

      // Send reactivation email to the target user (no system message by design)
      try {
        const targetUserName =
          `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() ||
          targetUser.username ||
          targetUser.email;

        await EmailService.sendAccountReactivationEmail(
          targetUser.email,
          targetUserName,
          {
            role: req.user.role,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
          }
        );
      } catch (emailError) {
        console.error("Failed to send reactivation email:", emailError);
        // Do not fail the request if email fails
      }

      // Notify admins (email + system message) about the reactivation
      try {
        await AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications(
          {
            action: "reactivated",
            targetUser: {
              _id: String(targetUser._id),
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
              email: targetUser.email,
            },
            actor: {
              _id: String(req.user._id),
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email,
              role: req.user.role,
              avatar: req.user.avatar,
              gender: req.user.gender,
            },
            createSystemMessage: true,
          }
        );
      } catch (notifyErr) {
        console.error(
          "Failed to send admin reactivation notifications:",
          notifyErr
        );
      }

      // Emit real-time update for Management page
      socketService.emitUserUpdate(String(targetUser._id), {
        type: "status_changed",
        user: {
          id: String(targetUser._id),
          username: targetUser.username,
          email: targetUser.email,
          firstName: targetUser.firstName || undefined,
          lastName: targetUser.lastName || undefined,
          role: targetUser.role,
          isActive: true,
        },
        oldValue: "inactive",
        newValue: "active",
      });

      res.status(200).json({
        success: true,
        message: "User reactivated successfully!",
      });
    } catch (error: unknown) {
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

      type UserModelWithStats = typeof User & {
        getUserStats: () => Promise<unknown>;
      };
      const UserWithStats = User as unknown as UserModelWithStats;
      const stats = await UserWithStats.getUserStats();

      res.status(200).json({
        success: true,
        data: { stats },
      });
    } catch (error: unknown) {
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

      // Generate new avatar URL
      const avatarUrl = getFileUrl(req, `avatars/${req.file.filename}`);
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

      // Cleanup old avatar file (async, don't wait for it)
      if (oldAvatarUrl) {
        cleanupOldAvatar(String(currentUser._id), oldAvatarUrl).catch(
          (error) => {
            console.error("Failed to cleanup old avatar:", error);
          }
        );
      }

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
   * Delete user permanently (Super Admin only)
   * WARNING: This permanently removes the user and all associated data
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id: userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return ResponseHelper.authRequired(res);
      }

      // Only Super Admin can delete users
      if (currentUser.role !== ROLES.SUPER_ADMIN) {
        return ResponseHelper.forbidden(
          res,
          "Only Super Admin can delete users."
        );
      }

      // Check if user exists
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
        return ResponseHelper.notFound(res, "User not found.");
      }

      // Prevent deletion of other Super Admins
      if (userToDelete.role === ROLES.SUPER_ADMIN) {
        return ResponseHelper.forbidden(
          res,
          "Cannot delete Super Admin users."
        );
      }

      // Prevent self-deletion
      if (userToDelete.id === currentUser.id) {
        return ResponseHelper.forbidden(res, "Cannot delete your own account.");
      }

      // Import UserDeletionService dynamically to avoid circular imports
      const { UserDeletionService } = await import(
        "../services/UserDeletionService"
      );

      // Perform complete cascading deletion
      const deletionReport = await UserDeletionService.deleteUserCompletely(
        userId,
        currentUser
      );

      // Send targeted admin notifications for user deletion (security best practice)
      try {
        const adminUsers = await User.find({
          role: { $in: ["Administrator", "Super Admin"] },
          isActive: { $ne: false },
        }).select("_id");

        // ✅ UPDATED: Create system message instead of direct bell notification
        // This follows the unified system message-centered architecture
        if (adminUsers.length > 0) {
          const adminUserIds = adminUsers.map((admin) => String(admin._id));

          // Enhance admin message content to include username and full name
          const deletedUserFullName =
            [userToDelete.firstName, userToDelete.lastName]
              .filter(Boolean)
              .join(" ") ||
            userToDelete.username ||
            deletionReport.userEmail;
          const deletedUserUsername = userToDelete.username;

          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "User Account Deleted",
              content: `User account ${deletedUserFullName} (@${deletedUserUsername}, ${
                deletionReport.userEmail
              }) was permanently deleted by ${formatActorDisplay(
                currentUser
              )}.`,
              type: "user_management",
              priority: "high",
              hideCreator: true,
            },
            adminUserIds,
            {
              id: String(currentUser._id),
              firstName: currentUser.firstName || "Unknown",
              lastName: currentUser.lastName || "User",
              username: currentUser.email.split("@")[0],
              avatar: currentUser.avatar,
              gender: currentUser.gender || "male",
              authLevel: currentUser.role,
              roleInAtCloud: currentUser.roleInAtCloud || currentUser.role,
            }
          );
        }

        console.log(
          `✅ Sent user deletion notifications to ${adminUsers.length} admins`
        );
      } catch (error) {
        console.error("❌ Failed to send admin deletion notifications:", error);
      }

      // Additionally send admin emails about deletion using unified service
      try {
        await AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications(
          {
            action: "deleted",
            targetUser: {
              _id: String(userToDelete._id),
              firstName: userToDelete.firstName,
              lastName: userToDelete.lastName,
              email: userToDelete.email,
            },
            actor: {
              _id: String(currentUser._id),
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              email: currentUser.email,
              role: currentUser.role,
              avatar: currentUser.avatar,
              gender: currentUser.gender,
            },
            createSystemMessage: false, // already created above to avoid duplicates
          }
        );
      } catch (notifyErr) {
        console.error("Failed to send admin deletion emails:", notifyErr);
      }

      console.log(
        `User completely deleted: ${deletionReport.userEmail} by Super Admin: ${currentUser.email}`
      );

      // Invalidate user-related caches after successful deletion
      await CachePatterns.invalidateUserCache(userId);

      ResponseHelper.success(
        res,
        {
          deletionReport,
          summary: `Successfully deleted user ${userToDelete.firstName} ${userToDelete.lastName} and all associated data.`,
        },
        `User ${userToDelete.firstName} ${userToDelete.lastName} has been permanently deleted along with all associated data.`,
        200
      );
    } catch (error: unknown) {
      console.error("Delete user error:", error);
      ResponseHelper.serverError(res, error);
    }
  }

  /**
   * Get user deletion impact analysis (Super Admin only)
   * Shows what would be deleted without performing the deletion
   */
  static async getUserDeletionImpact(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return ResponseHelper.authRequired(res);
      }

      // Only Super Admin can view deletion impact
      if (currentUser.role !== ROLES.SUPER_ADMIN) {
        return ResponseHelper.forbidden(
          res,
          "Only Super Admin can view deletion impact."
        );
      }

      // Import UserDeletionService dynamically to avoid circular imports
      const { UserDeletionService } = await import(
        "../services/UserDeletionService"
      );

      const impact = await UserDeletionService.getUserDeletionImpact(userId);

      ResponseHelper.success(
        res,
        impact,
        "Deletion impact analysis completed.",
        200
      );
    } catch (error: unknown) {
      console.error("Get deletion impact error:", error);
      ResponseHelper.serverError(res, error);
    }
  }

  // Change password
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

  // Admin edit profile - allows Super Admin/Administrator to edit limited fields of other users
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
      if (avatar !== undefined) updateData.avatar = avatar;
      if (phone !== undefined) updateData.phone = phone;
      if (isAtCloudLeader !== undefined)
        updateData.isAtCloudLeader = isAtCloudLeader;
      if (roleInAtCloud !== undefined) updateData.roleInAtCloud = roleInAtCloud;

      // If user is no longer an @Cloud co-worker, clear the role
      if (isAtCloudLeader === false) {
        updateData.roleInAtCloud = undefined;
      }

      // Update the user
      const updatedUser = await User.findByIdAndUpdate(
        targetUserId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: "Failed to update user.",
        });
        return;
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
