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
router.post("/change-password", UserController.changePassword);

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

// Admin routes
router.get("/", requireLeader, UserController.getAllUsers);
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
  requireAdmin,
  UserController.deactivateUser
);
router.put(
  "/:id/reactivate",
  validateObjectId,
  handleValidationErrors,
  requireAdmin,
  UserController.reactivateUser
);

// Delete user route (Super Admin only)
router.delete(
  "/:id",
  validateObjectId,
  handleValidationErrors,
  requireSuperAdmin,
  UserController.deleteUser
);

export default router;
