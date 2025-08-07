import { Router } from "express";
import { UserController } from "../controllers/userController";
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

// User profile routes
router.get("/profile", UserController.getProfile);
router.put(
  "/profile",
  validateUserUpdate,
  handleValidationErrors,
  UserController.updateProfile
);

// Avatar upload route
router.post(
  "/avatar",
  uploadLimiter,
  uploadAvatar,
  UserController.uploadAvatar
);

// Get user by ID (access control handled in controller)
router.get(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  UserController.getUserById
);

// Compatibility routes for tests - delegate to current user operations
router.post(
  "/:id/avatar",
  uploadLimiter,
  uploadAvatar,
  UserController.uploadAvatar
);

router.put(
  "/:id",
  validateUserUpdate,
  handleValidationErrors,
  UserController.updateProfile
);

// Admin routes - Allow all authenticated users to view user list (community feature)
router.get("/", UserController.getAllUsers);
router.get("/search", UserController.getAllUsers); // Search endpoint (uses same logic as getAllUsers)
router.get(
  "/stats",
  authorizePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS),
  analyticsLimiter,
  UserController.getUserStats
);

// Admin user management routes
router.put(
  "/:id/role",
  validateObjectId,
  handleValidationErrors,
  requireAdmin,
  UserController.updateUserRole
);
router.put(
  "/:id/deactivate",
  validateObjectId,
  handleValidationErrors,
  requireLeader,
  UserController.deactivateUser
);
router.put(
  "/:id/reactivate",
  validateObjectId,
  handleValidationErrors,
  requireLeader,
  UserController.reactivateUser
);

// Delete user impact analysis route (Super Admin only)
router.get(
  "/:id/deletion-impact",
  validateObjectId,
  handleValidationErrors,
  requireSuperAdmin,
  UserController.getUserDeletionImpact
);

// Delete user route (Super Admin only)
router.delete(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  requireSuperAdmin,
  UserController.deleteUser
);

// Password change route (delegated to auth controller)
router.post(
  "/:id/change-password",
  validateObjectId,
  handleValidationErrors,
  UserController.changePassword
);

export default router;
