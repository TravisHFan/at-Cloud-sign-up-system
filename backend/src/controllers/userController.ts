// ResponseHelper is now imported from shared utils
// Kept here for backwards compatibility reference - use import { ResponseHelper } from "../utils/responseHelper"

/**
 * UserController
 *
 * Legacy controller maintained for backward compatibility.
 * User management methods have been extracted to focused controllers:
 * - ProfileController: getProfile, updateProfile, uploadAvatar, changePassword
 * - UserAdminController: getUserById, getAllUsers, updateUserRole, deactivateUser,
 *                        reactivateUser, deleteUser, getUserDeletionImpact, adminEditProfile
 * - UserAnalyticsController: getUserStats
 *
 * This class is kept to preserve the ResponseHelper utility and interface definitions
 * that may be used elsewhere in the codebase.
 */
export class UserController {
  // All user management methods have been extracted to focused controllers.
  // See ProfileController, UserAdminController, and UserAnalyticsController.
}
