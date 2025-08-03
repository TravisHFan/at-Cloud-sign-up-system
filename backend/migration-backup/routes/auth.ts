import { Router } from "express";
import { AuthController } from "../controllers/authController";
import {
  authenticate,
  verifyEmailToken,
  verifyPasswordResetToken,
} from "../middleware/auth";
import {
  validateUserRegistration,
  validateUserLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUserUpdate,
  validateError,
} from "../middleware/validation";

const router = Router();

// Public routes (no authentication required)
router.post(
  "/register",
  validateUserRegistration,
  validateError,
  AuthController.register
);
router.post("/login", validateUserLogin, validateError, AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.get(
  "/verify-email/:token",
  verifyEmailToken,
  AuthController.verifyEmail
);
router.post(
  "/resend-verification",
  validateForgotPassword,
  validateError,
  AuthController.resendVerification
);
router.post(
  "/forgot-password",
  validateForgotPassword,
  validateError,
  AuthController.forgotPassword
);
router.post(
  "/reset-password",
  verifyPasswordResetToken,
  validateResetPassword,
  validateError,
  AuthController.resetPassword
);
router.post(
  "/complete-password-change/:token",
  AuthController.completePasswordChange
);

// Protected routes (authentication required)
router.use(authenticate); // All routes below require authentication

router.post("/logout", AuthController.logout);
router.get("/profile", AuthController.getProfile);

// Secure password change routes
router.post("/request-password-change", AuthController.requestPasswordChange);

export default router;
