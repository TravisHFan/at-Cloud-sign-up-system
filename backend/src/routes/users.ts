import { Router } from "express";
import { UserController } from "../controllers/userController";
import {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  authorizePermission,
} from "../middleware/auth";
import { uploadAvatar } from "../middleware/upload";
import { PERMISSIONS } from "../utils/roleUtils";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User profile routes
router.get("/profile", UserController.getProfile);
router.put("/profile", UserController.updateProfile);
router.post("/change-password", UserController.changePassword);

// Avatar upload route
router.post("/avatar", uploadAvatar, UserController.uploadAvatar);

// Get user by ID (access control handled in controller)
router.get("/:id", UserController.getUserById);

// Admin routes
router.get("/", requireAdmin, UserController.getAllUsers);
router.get(
  "/stats",
  authorizePermission(PERMISSIONS.VIEW_SYSTEM_ANALYTICS),
  UserController.getUserStats
);

// Admin user management routes
router.put("/:id/role", requireAdmin, UserController.updateUserRole);
router.put("/:id/deactivate", requireAdmin, UserController.deactivateUser);
router.put("/:id/reactivate", requireAdmin, UserController.reactivateUser);

export default router;
