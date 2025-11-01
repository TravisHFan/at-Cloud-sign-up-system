import { Request, Response } from "express";

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response): Promise<void> {
    const { default: RegistrationController } = await import(
      "./auth/RegistrationController"
    );
    return RegistrationController.register(req, res);
  }

  // Login user
  static async login(req: Request, res: Response): Promise<void> {
    const { default: LoginController } = await import("./auth/LoginController");
    return LoginController.login(req, res);
  }

  // Verify email
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    const { default: EmailVerificationController } = await import(
      "./auth/EmailVerificationController"
    );
    return EmailVerificationController.verifyEmail(req, res);
  }

  // Request password reset
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const { default: PasswordResetController } = await import(
      "./auth/PasswordResetController"
    );
    return PasswordResetController.forgotPassword(req, res);
  }

  // Reset password
  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { default: PasswordResetController } = await import(
      "./auth/PasswordResetController"
    );
    return PasswordResetController.resetPassword(req, res);
  }

  // Logout user
  static async logout(req: Request, res: Response): Promise<void> {
    const { default: LogoutController } = await import(
      "./auth/LogoutController"
    );
    return LogoutController.logout(req, res);
  }

  // Refresh access token
  static async refreshToken(req: Request, res: Response): Promise<void> {
    const { default: TokenController } = await import("./auth/TokenController");
    return TokenController.refreshToken(req, res);
  }

  // Resend verification email (placeholder)
  static async resendVerification(req: Request, res: Response): Promise<void> {
    const { default: EmailVerificationController } = await import(
      "./auth/EmailVerificationController"
    );
    return EmailVerificationController.resendVerification(req, res);
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response): Promise<void> {
    const { default: ProfileController } = await import(
      "./auth/ProfileController"
    );
    return ProfileController.getProfile(req, res);
  }

  // Phase 1: Request password change - requires current password and new password
  static async requestPasswordChange(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PasswordChangeController } = await import(
      "./auth/PasswordChangeController"
    );
    return PasswordChangeController.requestPasswordChange(req, res);
  }

  // Phase 2: Complete password change - verify token and apply new password
  static async completePasswordChange(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: PasswordChangeController } = await import(
      "./auth/PasswordChangeController"
    );
    return PasswordChangeController.completePasswordChange(req, res);
  }
}
