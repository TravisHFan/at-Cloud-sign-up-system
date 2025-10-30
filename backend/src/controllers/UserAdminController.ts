import { Request, Response } from "express";
import { User } from "../models";
import AuditLog from "../models/AuditLog";
import {
  RoleUtils,
  ROLES,
  hasPermission,
  PERMISSIONS,
} from "../utils/roleUtils";
import { cleanupOldAvatar } from "../utils/avatarCleanup";
import { socketService } from "../services/infrastructure/SocketService";
import { AutoEmailNotificationService } from "../services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "./unifiedMessageController";
import { CachePatterns } from "../services";
import { EmailService } from "../services/infrastructure/EmailServiceFacade";
import { formatActorDisplay } from "../utils/systemMessageFormatUtils";

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

/**
 * UserAdminController
 * Handles administrative user management operations
 * - User lookup and listing
 * - Role management
 * - Account status (activate/deactivate)
 * - User deletion
 * - Admin profile editing
 */
export class UserAdminController {
  /**
   * Get user by ID (admin only)
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    const { default: UserQueryController } = await import(
      "./user-admin/UserQueryController"
    );
    return UserQueryController.getUserById(req, res);
  }

  /**
   * Get all users (admin only with pagination and filtering)
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    const { default: UserListingController } = await import(
      "./user-admin/UserListingController"
    );
    return UserListingController.getAllUsers(req, res);
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(req: Request, res: Response): Promise<void> {
    const { default: UserRoleController } = await import(
      "./user-admin/UserRoleController"
    );
    return UserRoleController.updateUserRole(req, res);
  }

  /**
   * Deactivate user (admin only)
   */
  static async deactivateUser(req: Request, res: Response): Promise<void> {
    const { default: UserDeactivationController } = await import(
      "./user-admin/UserDeactivationController"
    );
    return UserDeactivationController.deactivateUser(req, res);
  }

  /**
   * Reactivate user (admin only)
   */
  static async reactivateUser(req: Request, res: Response): Promise<void> {
    const { default: UserReactivationController } = await import(
      "./user-admin/UserReactivationController"
    );
    return UserReactivationController.reactivateUser(req, res);
  }

  /**
   * Delete user permanently (Super Admin only)
   * WARNING: This permanently removes the user and all associated data
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    const { default: UserDeletionController } = await import(
      "./user-admin/UserDeletionController"
    );
    return UserDeletionController.deleteUser(req, res);
  }

  /**
   * Get user deletion impact analysis (Super Admin only)
   * Shows what would be deleted without performing the deletion
   */
  static async getUserDeletionImpact(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: UserDeletionImpactController } = await import(
      "./user-admin/UserDeletionImpactController"
    );
    return UserDeletionImpactController.getUserDeletionImpact(req, res);
  }

  /**
   * Admin edit profile - allows Super Admin/Administrator to edit limited fields of other users
   */
  static async adminEditProfile(req: Request, res: Response): Promise<void> {
    const { default: AdminProfileEditController } = await import(
      "./user-admin/AdminProfileEditController"
    );
    return AdminProfileEditController.adminEditProfile(req, res);
  }
}
