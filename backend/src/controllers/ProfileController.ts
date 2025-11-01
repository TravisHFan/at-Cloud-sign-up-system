import { Request, Response } from "express";

/**
 * ProfileController
 *
 * Handles user profile management operations:
 * - View profile
 * - Update profile information
 * - Upload avatar
 * - Change password
 *
 * All methods delegate to specialized controllers in profile/ subdirectory
 */
export class ProfileController {
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    const { default: GetProfileController } = await import(
      "./profile/GetProfileController"
    );
    return GetProfileController.getProfile(req, res);
  }

  /**
   * Update user profile
   * PUT /api/users/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    const { default: UpdateProfileController } = await import(
      "./profile/UpdateProfileController"
    );
    return UpdateProfileController.updateProfile(req, res);
  }

  /**
   * Upload avatar
   * POST /api/users/avatar
   */
  static async uploadAvatar(req: Request, res: Response): Promise<void> {
    const { default: UploadAvatarController } = await import(
      "./profile/UploadAvatarController"
    );
    return UploadAvatarController.uploadAvatar(req, res);
  }

  /**
   * Change password
   * POST /api/users/:id/change-password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    const { default: ChangePasswordController } = await import(
      "./profile/ChangePasswordController"
    );
    return ChangePasswordController.changePassword(req, res);
  }
}
