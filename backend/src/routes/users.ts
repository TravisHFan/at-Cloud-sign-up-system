import { Router } from "express";
import { ProfileController } from "../controllers/ProfileController";
import { UserAdminController } from "../controllers/UserAdminController";
import { UserAnalyticsController } from "../controllers/UserAnalyticsController";
import {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  requireLeader,
  authorizePermission,
} from "../middleware/auth";
import { uploadAvatar } from "../middleware/upload";
import { PERMISSIONS } from "../utils/roleUtils";
import {
  validateUserUpdate,
  validateObjectId,
  handleValidationErrors,
} from "../middleware/validation";
import { uploadLimiter, analyticsLimiter } from "../middleware/rateLimiting";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User profile routes (ProfileController)
router.get("/profile", ProfileController.getProfile);
router.put(
  "/profile",
  validateUserUpdate,
  handleValidationErrors,
  ProfileController.updateProfile
);

// Avatar upload route (ProfileController)
router.post(
  "/avatar",
  uploadLimiter,
  uploadAvatar,
  ProfileController.uploadAvatar
);

// Admin routes - Allow all authenticated users to view user list (community feature) (UserAdminController)
router.get("/", UserAdminController.getAllUsers);
router.get("/search", UserAdminController.getAllUsers); // Search endpoint (uses same logic as getAllUsers)
router.get(
  "/stats",
  authorizePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS),
  analyticsLimiter,
  UserAnalyticsController.getUserStats // UserAnalyticsController
);

// Get user by ID (access control handled in controller) - MUST come after specific routes (UserAdminController)
router.get(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  UserAdminController.getUserById
);

// Admin user management routes (UserAdminController)
router.put(
  "/:id/admin-edit",
  validateObjectId,
  handleValidationErrors,
  requireAdmin,
  UserAdminController.adminEditProfile
);
router.put(
  "/:id/role",
  validateObjectId,
  handleValidationErrors,
  requireAdmin,
  UserAdminController.updateUserRole
);
router.put(
  "/:id/deactivate",
  validateObjectId,
  handleValidationErrors,
  requireLeader,
  UserAdminController.deactivateUser
);
router.put(
  "/:id/reactivate",
  validateObjectId,
  handleValidationErrors,
  requireLeader,
  UserAdminController.reactivateUser
);

// Delete user impact analysis route (Super Admin only) (UserAdminController)
router.get(
  "/:id/deletion-impact",
  validateObjectId,
  handleValidationErrors,
  requireSuperAdmin,
  UserAdminController.getUserDeletionImpact
);

// Delete user route (Super Admin only) (UserAdminController)
router.delete(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  requireSuperAdmin,
  UserAdminController.deleteUser
);

// Password change route (ProfileController)
router.post(
  "/:id/change-password",
  validateObjectId,
  handleValidationErrors,
  ProfileController.changePassword
);

export default router;
