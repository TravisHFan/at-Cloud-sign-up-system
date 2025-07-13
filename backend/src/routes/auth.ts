import { Router } from "express";
import { AuthController } from "../controllers/authController";
import {
  authenticate,
  verifyEmailToken,
  verifyPasswordResetToken,
} from "../middleware/auth";

const router = Router();

// Public routes (no authentication required)
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.get("/verify-email/:token", AuthController.verifyEmail);
router.post("/resend-verification", AuthController.resendVerification);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

// Protected routes (authentication required)
router.use(authenticate); // All routes below require authentication

router.post("/logout", AuthController.logout);
router.get("/profile", AuthController.getProfile);

export default router;
