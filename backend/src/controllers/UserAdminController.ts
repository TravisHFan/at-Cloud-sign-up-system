import { Request, Response } from "express";

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
    const { default: UserQueryController } =
      await import("./user-admin/UserQueryController");
    return UserQueryController.getUserById(req, res);
  }

  /**
   * Get all users (admin only with pagination and filtering)
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    const { default: UserListingController } =
      await import("./user-admin/UserListingController");
    return UserListingController.getAllUsers(req, res);
  }

  /**
   * Update user role (admin only)
   */
  static async updateUserRole(req: Request, res: Response): Promise<void> {
    const { default: UserRoleController } =
      await import("./user-admin/UserRoleController");
    return UserRoleController.updateUserRole(req, res);
  }

  /**
   * Deactivate user (admin only)
   */
  static async deactivateUser(req: Request, res: Response): Promise<void> {
    const { default: UserDeactivationController } =
      await import("./user-admin/UserDeactivationController");
    return UserDeactivationController.deactivateUser(req, res);
  }

  /**
   * Reactivate user (admin only)
   */
  static async reactivateUser(req: Request, res: Response): Promise<void> {
    const { default: UserReactivationController } =
      await import("./user-admin/UserReactivationController");
    return UserReactivationController.reactivateUser(req, res);
  }

  /**
   * Delete user permanently (Super Admin only)
   * WARNING: This permanently removes the user and all associated data
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    const { default: UserDeletionController } =
      await import("./user-admin/UserDeletionController");
    return UserDeletionController.deleteUser(req, res);
  }

  /**
   * Get user deletion impact analysis (Super Admin only)
   * Shows what would be deleted without performing the deletion
   */
  static async getUserDeletionImpact(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { default: UserDeletionImpactController } =
      await import("./user-admin/UserDeletionImpactController");
    return UserDeletionImpactController.getUserDeletionImpact(req, res);
  }

  /**
   * Admin edit profile - allows Super Admin/Administrator to edit limited fields of other users
   */
  static async adminEditProfile(req: Request, res: Response): Promise<void> {
    const { default: AdminProfileEditController } =
      await import("./user-admin/AdminProfileEditController");
    return AdminProfileEditController.adminEditProfile(req, res);
  }
}
