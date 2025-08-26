import { Request, Response } from "express";
import { User, IUser } from "../models";
import { TokenService } from "../middleware/auth";
import { RoleUtils, ROLES } from "../utils/roleUtils";
import { EmailService } from "../services/infrastructure/emailService";
import { AutoEmailNotificationService } from "../services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "./unifiedMessageController";
import { CachePatterns } from "../services";
import GuestMigrationService from "../services/GuestMigrationService";
import { createLogger } from "../services";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  ApiResponse,
  AuthenticatedRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../types/api";

// Interface for registration request (matches frontend signUpSchema)
interface RegisterRequest {
  username: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  homeAddress?: string;
  isAtCloudLeader: boolean;
  roleInAtCloud?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;
  acceptTerms: boolean;
}

// Interface for login request
interface LoginRequest {
  emailOrUsername: string;
  password: string;
  rememberMe?: boolean;
}

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        username,
        email,
        phone,
        password,
        confirmPassword,
        firstName,
        lastName,
        gender,
        homeAddress,
        isAtCloudLeader,
        roleInAtCloud,
        occupation,
        company,
        weeklyChurch,
        churchAddress,
        acceptTerms,
      }: RegisterRequest = req.body;

      // Input validation
      if (!acceptTerms) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "You must accept the terms and conditions to register",
              400
            )
          );
        return;
      }

      if (password !== confirmPassword) {
        res
          .status(400)
          .json(createErrorResponse("Passwords do not match", 400));
        return;
      }

      // Check if user already exists
      // Note: Case-insensitive uniqueness is ultimately enforced by the
      // usernameLower unique index in the User model. The router currently
      // normalizes req.body.username to lowercase before validation; even if
      // that normalization were altered, the usernameLower index still prevents
      // duplicates that differ only by case.
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username: username }],
      });

      if (existingUser) {
        const message =
          existingUser.email === email.toLowerCase()
            ? "Email address is already registered"
            : "Username is already taken";
        res.status(409).json(createErrorResponse(message, 409));
        return;
      }

      // Validate @Cloud co-worker requirements
      if (isAtCloudLeader && !roleInAtCloud) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "Role in @Cloud is required for @Cloud co-workers",
              400
            )
          );
        return;
      }

      // Create new user
      const userData = {
        username,
        email: email.toLowerCase(),
        phone,
        password,
        firstName,
        lastName,
        gender,
        homeAddress,
        isAtCloudLeader,
        roleInAtCloud: isAtCloudLeader ? roleInAtCloud : undefined,
        occupation,
        company,
        weeklyChurch,
        churchAddress,
        role: ROLES.PARTICIPANT, // Default role
        isActive: true,
        isVerified: false, // Will be verified via email
        loginAttempts: 0,
      };

      // Set default avatar based on gender
      if (gender === "female") {
        (userData as any).avatar = "/default-avatar-female.jpg";
      } else if (gender === "male") {
        (userData as any).avatar = "/default-avatar-male.jpg";
      }

      const user = new User(userData);

      // Generate email verification token
      const verificationToken = (user as any).generateEmailVerificationToken();

      await user.save();

      // Send @Cloud role admin notifications if user signed up as @Cloud co-worker
      if (isAtCloudLeader) {
        try {
          await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
            userData: {
              _id: (user as any)._id.toString(),
              firstName: user.firstName || user.username,
              lastName: user.lastName || "",
              email: user.email,
              roleInAtCloud: user.roleInAtCloud,
            },
            changeType: "signup",
            systemUser: {
              firstName: "System",
              lastName: "Registration",
              email: "system@church.com",
              role: "System",
            },
          });
          console.log(
            `Admin notifications sent for new @Cloud co-worker signup: ${user.email}`
          );
        } catch (notificationError) {
          console.error(
            "Failed to send @Cloud admin notifications:",
            notificationError
          );
          // Don't fail the registration if notification fails
        }
      }

      // Send verification email
      const emailSent = await EmailService.sendVerificationEmail(
        user.email,
        user.firstName || user.username,
        verificationToken
      );

      if (!emailSent) {
        console.warn("Failed to send verification email to:", user.email);
      }

      // Note: No system message or bell notification needed here since
      // unverified users cannot log in to see them. Email verification is sufficient.

      const responseData = {
        user: {
          id: (user as any)._id,
          username: (user as any).username,
          email: (user as any).email,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          role: (user as any).role,
          isAtCloudLeader: (user as any).isAtCloudLeader,
          isVerified: (user as any).isVerified,
        },
      };

      // Invalidate user-related caches after successful registration
      await CachePatterns.invalidateUserCache((user._id as any).toString());

      // Auto-migrate guest registrations immediately on signup (optional via env)
      // ENABLE_GUEST_AUTO_MIGRATION=true enables; set to false to disable
      // Skip during unit tests to avoid DB dependencies; allow in integration scope
      const shouldAutoMigrateOnRegister =
        process.env.ENABLE_GUEST_AUTO_MIGRATION !== "false" &&
        (process.env.NODE_ENV !== "test" ||
          process.env.VITEST_SCOPE === "integration");
      if (shouldAutoMigrateOnRegister) {
        try {
          await GuestMigrationService.performGuestToUserMigration(
            (user._id as any).toString(),
            user.email
          );
        } catch (e) {
          // Non-fatal: don't block signup
          const log =
            createLogger && typeof createLogger === "function"
              ? createLogger("AuthController")
              : console;
          (log as any).error(
            "Guest auto-migration after register failed",
            e as any,
            "GuestMigration",
            {
              userId: (user._id as any).toString(),
              email: user.email,
            }
          );
        }
      }

      res
        .status(201)
        .json(
          createSuccessResponse(
            responseData,
            "Registration successful! Please check your email to verify your account"
          )
        );
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error.code === 11000) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        res
          .status(409)
          .json(createErrorResponse(`${field} is already registered`, 409));
        return;
      }

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        res.status(400).json(createErrorResponse("Validation failed", 400));
        return;
      }

      res
        .status(500)
        .json(createErrorResponse("Registration failed. Please try again"));
    }
  }

  // Login user
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { emailOrUsername, password, rememberMe }: LoginRequest = req.body;

      if (!emailOrUsername || !password) {
        res
          .status(400)
          .json(
            createErrorResponse("Email/username and password are required", 400)
          );
        return;
      }

      // Find user by email or username
      const user = await User.findOne({
        $or: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername },
        ],
      }).select("+password +loginAttempts +lockUntil");

      if (!user) {
        res
          .status(401)
          .json(createErrorResponse("Invalid email/username or password", 401));
        return;
      }

      // Check if account is locked
      if ((user as any).isAccountLocked()) {
        res
          .status(423)
          .json(
            createErrorResponse(
              "Account is temporarily locked due to too many failed login attempts. Please try again later",
              423
            )
          );
        return;
      }

      // Check if account is active
      if (!(user as any).isActive) {
        res
          .status(403)
          .json(
            createErrorResponse(
              "Account has been deactivated. Please contact support",
              403
            )
          );
        return;
      }

      // Verify password
      const isPasswordValid = await (user as any).comparePassword(password);

      if (!isPasswordValid) {
        await (user as any).incrementLoginAttempts();
        res
          .status(401)
          .json(createErrorResponse("Invalid email/username or password", 401));
        return;
      }

      // Check if email is verified (optional based on requirements)
      if (!(user as any).isVerified) {
        res
          .status(403)
          .json(
            createErrorResponse(
              "Please verify your email address before logging in",
              403
            )
          );
        return;
      }

      // Reset login attempts and update last login
      await (user as any).resetLoginAttempts();
      await (user as any).updateLastLogin();

      // Generate tokens
      const tokens = TokenService.generateTokenPair(user);

      // Set cookie options based on rememberMe
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 days or 1 day
      };

      // Set refresh token as httpOnly cookie
      res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

      const responseData = {
        user: {
          id: (user as any)._id,
          username: (user as any).username,
          email: (user as any).email,
          phone: (user as any).phone,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
          gender: (user as any).gender,
          role: (user as any).role,
          isAtCloudLeader: (user as any).isAtCloudLeader,
          roleInAtCloud: (user as any).roleInAtCloud,
          occupation: (user as any).occupation,
          company: (user as any).company,
          weeklyChurch: (user as any).weeklyChurch,
          homeAddress: (user as any).homeAddress,
          churchAddress: (user as any).churchAddress,
          avatar: (user as any).avatar,
          lastLogin: (user as any).lastLogin,
        },
        accessToken: tokens.accessToken,
        expiresAt: tokens.accessTokenExpires,
      };

      res
        .status(200)
        .json(createSuccessResponse(responseData, "Login successful!"));
    } catch (error: any) {
      console.error("Login error:", error);
      res
        .status(500)
        .json(createErrorResponse("Login failed. Please try again"));
    }
  }

  // Verify email
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(400).json({
          success: false,
          message: "Invalid verification token.",
          errorType: "invalid_token",
        });
        return;
      }

      const user = req.user as any;

      // Check if already verified
      if (user.isVerified) {
        res.status(200).json({
          success: true,
          message: "Email is already verified.",
          alreadyVerified: true,
        });
        return;
      }

      // Mark as verified and clear verification token
      user.isVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save();

      // Invalidate user cache after email verification
      await CachePatterns.invalidateUserCache((user._id as any).toString());

      // Send welcome email
      await EmailService.sendWelcomeEmail(
        user.email,
        user.firstName || user.username
      );

      // Attempt to migrate any pending guest registrations for this verified user
      // Auto-enabled by default outside of tests. Set ENABLE_GUEST_AUTO_MIGRATION=false to disable.
      let migrationSummary:
        | { modified: number; remainingPending: number }
        | undefined;
      const autoMigrateEnabled =
        process.env.ENABLE_GUEST_AUTO_MIGRATION !== "false" &&
        (process.env.NODE_ENV !== "test" ||
          process.env.VITEST_SCOPE === "integration");
      if (autoMigrateEnabled) {
        try {
          const log =
            createLogger && typeof createLogger === "function"
              ? createLogger("AuthController")
              : console;
          const performResult =
            await GuestMigrationService.performGuestToUserMigration(
              (user._id as any).toString(),
              user.email
            );
          if (performResult.ok) {
            const remainingEligible =
              await GuestMigrationService.detectGuestRegistrationsByEmail(
                user.email.toLowerCase()
              );
            migrationSummary = {
              modified: performResult.modified,
              remainingPending: remainingEligible.length,
            };
            (log as any).info(
              "Guest auto-migration completed after verifyEmail",
              "GuestMigration",
              {
                userId: (user._id as any).toString(),
                email: user.email.toLowerCase(),
                modified: performResult.modified,
                remainingPending: remainingEligible.length,
              }
            );
          }
        } catch (migrationError) {
          // Log and continue; do not fail verification
          const log =
            createLogger && typeof createLogger === "function"
              ? createLogger("AuthController")
              : console;
          (log as any).error(
            "Guest auto-migration failed after verifyEmail",
            migrationError as any,
            "GuestMigration",
            {
              userId: (user._id as any).toString(),
              email: user.email.toLowerCase(),
            }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Email verified successfully! Welcome to @Cloud Ministry.",
        freshlyVerified: true,
        migration: migrationSummary,
      });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "Email verification failed.",
        errorType: "server_error",
      });
    }
  }

  // Request password reset
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email address is required.",
        });
        return;
      }

      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });

      // Always return success to prevent email enumeration
      const successMessage =
        "If that email address is in our system, you will receive a password reset email shortly.";

      if (!user) {
        res.status(200).json({
          success: true,
          message: successMessage,
        });
        return;
      }

      // Generate password reset token
      const resetToken = (user as any).generatePasswordResetToken();
      await user.save();

      // Send password reset email
      const emailSent = await EmailService.sendPasswordResetEmail(
        user.email,
        user.firstName || user.username,
        resetToken
      );

      if (!emailSent) {
        console.warn("Failed to send password reset email to:", user.email);
      }

      // Create system message and bell notification for password reset
      try {
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: "Password Reset Requested",
            content: `A password reset link has been sent to your email. Please check your inbox and follow the instructions to reset your password.`,
            // Use a valid type in the Message schema
            type: "warning",
            priority: "high",
            hideCreator: true,
          },
          [(user as any)._id.toString()],
          {
            id: "system",
            firstName: "System",
            lastName: "Administrator",
            username: "system",
            avatar: "/default-avatar-male.jpg",
            gender: "male",
            authLevel: "Super Admin",
            roleInAtCloud: "System",
          }
        );
      } catch (error) {
        console.warn("Failed to create password reset system message:", error);
      }

      res.status(200).json({
        success: true,
        message: successMessage,
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset request failed.",
      });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { newPassword, confirmPassword } = req.body;

      if (!newPassword || !confirmPassword) {
        res.status(400).json({
          success: false,
          message: "New password and confirmation are required.",
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: "Passwords do not match.",
        });
        return;
      }

      if (!req.user) {
        res.status(400).json({
          success: false,
          message: "Invalid or expired reset token.",
        });
        return;
      }

      const user = req.user as any;

      // Update password and clear reset token
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      // Invalidate user cache after password reset
      await CachePatterns.invalidateUserCache((user._id as any).toString());

      // Create success trio notification for password reset
      try {
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: "Password Reset Successful",
            content: `Your password has been successfully reset. If you did not make this change, please contact support immediately.`,
            type: "update", // Changed from "warning" to "update" for positive confirmation
            priority: "high",
            hideCreator: true,
          },
          [user._id.toString()],
          {
            id: "system",
            firstName: "System",
            lastName: "Administrator",
            username: "system",
            avatar: "/default-avatar-male.jpg",
            gender: "male",
            authLevel: "Super Admin",
            roleInAtCloud: "System",
          }
        );

        // Send password reset success email
        await EmailService.sendPasswordResetSuccessEmail(
          user.email,
          user.firstName || user.username
        );
      } catch (error) {
        console.warn(
          "Failed to send password reset success notifications:",
          error
        );
      }

      res.status(200).json({
        success: true,
        message: "Password reset successfully!",
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Password reset failed.",
      });
    }
  }

  // Logout user
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Clear the refresh token cookie
      res.clearCookie("refreshToken");

      res.status(200).json({
        success: true,
        message: "Logged out successfully!",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed.",
      });
    }
  }

  // Refresh access token
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: "Refresh token not provided.",
        });
        return;
      }

      // Verify the refresh token
      const decoded = TokenService.verifyRefreshToken(refreshToken);

      if (!decoded || !decoded.userId) {
        res.status(401).json({
          success: false,
          message: "Invalid refresh token.",
        });
        return;
      }

      // Get user to ensure they still exist and are active
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: "User not found or inactive.",
        });
        return;
      }

      // Generate new access token
      const newTokens = TokenService.generateTokenPair(user);

      // Set new refresh token in cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      res.cookie("refreshToken", newTokens.refreshToken, cookieOptions);

      res.status(200).json({
        success: true,
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
        message: "Token refreshed successfully.",
      });
    } catch (error: any) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        success: false,
        message: "Token refresh failed.",
      });
    }
  }

  // Resend verification email (placeholder)
  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email address is required.",
        });
        return;
      }

      const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true,
        isVerified: false,
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found or already verified.",
        });
        return;
      }

      // Generate new verification token
      const verificationToken = (user as any).generateEmailVerificationToken();
      await user.save();

      // Send verification email
      const emailSent = await EmailService.sendVerificationEmail(
        user.email,
        user.firstName || user.username,
        verificationToken
      );

      if (!emailSent) {
        res.status(500).json({
          success: false,
          message: "Failed to send verification email.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Verification email sent successfully.",
      });
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to resend verification email.",
      });
    }
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: (req.user as any)._id,
            username: (req.user as any).username,
            email: (req.user as any).email,
            phone: (req.user as any).phone,
            firstName: (req.user as any).firstName,
            lastName: (req.user as any).lastName,
            gender: (req.user as any).gender,
            avatar: (req.user as any).avatar,
            role: (req.user as any).role,
            isAtCloudLeader: (req.user as any).isAtCloudLeader,
            roleInAtCloud: (req.user as any).roleInAtCloud,
            occupation: (req.user as any).occupation,
            company: (req.user as any).company,
            weeklyChurch: (req.user as any).weeklyChurch,
            homeAddress: (req.user as any).homeAddress,
            churchAddress: (req.user as any).churchAddress,
            lastLogin: (req.user as any).lastLogin,
            createdAt: (req.user as any).createdAt,
            isVerified: (req.user as any).isVerified,
            isActive: (req.user as any).isActive,
          },
        },
      });
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile.",
      });
    }
  }

  // Phase 1: Request password change - requires current password and new password
  static async requestPasswordChange(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req.user as any)._id;

      // Validate required fields
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: "Current password and new password are required.",
        });
        return;
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long.",
        });
        return;
      }

      // Find user and verify current password
      const user = await User.findById(userId).select("+password");
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found.",
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
        return;
      }

      // Generate password change token (10 minutes expiry)
      const passwordChangeToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(passwordChangeToken)
        .digest("hex");

      // Hash the new password for temporary storage
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Store pending password change
      user.passwordChangeToken = hashedToken;
      user.passwordChangeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      user.pendingPassword = hashedNewPassword; // Store hashed new password temporarily
      await user.save({ validateBeforeSave: false });

      // Send password change request trio
      try {
        console.log(
          "🔄 Starting trio notification for password change request..."
        );

        // Email notification
        console.log("📧 Sending email notification...");
        await EmailService.sendPasswordChangeRequestEmail(
          user.email,
          user.firstName || user.username,
          passwordChangeToken
        );
        console.log("✅ Email notification sent successfully");

        // System message
        console.log("📬 Creating system message...");
        const systemMessage =
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "Password Change Request",
              content: `A password change was requested for your account. Please check your email to confirm this change. This request expires in 10 minutes.`,
              // Use a valid type in the Message schema
              type: "warning",
              priority: "high",
              hideCreator: true,
            },
            [userId.toString()],
            {
              id: "system",
              firstName: "System",
              lastName: "",
              username: "system",
              // Use valid values per schema to avoid validation failures
              gender: "male",
              authLevel: "Super Admin",
              avatar: "",
            }
          );
        console.log(
          "✅ System message created successfully:",
          systemMessage?._id
        );

        console.log(
          `Password change request trio sent for user: ${user.email}`
        );
      } catch (error) {
        console.error(
          "❌ Failed to send password change request notifications:",
          error
        );
        if (error instanceof Error) {
          console.error("📋 Error stack:", error.stack);
        }
      }

      res.status(200).json({
        success: true,
        message:
          "Password change request sent. Please check your email to confirm.",
      });
    } catch (error: any) {
      console.error("Request password change error:", error);
      res.status(500).json({
        success: false,
        message: "Password change request failed.",
      });
    }
  }

  // Phase 2: Complete password change - verify token and apply new password
  static async completePasswordChange(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { token } = req.params;
      console.log("🔐 Starting password change completion for token:", token);

      if (!token) {
        console.log("❌ No token provided");
        res.status(400).json({
          success: false,
          message: "Password change token is required.",
        });
        return;
      }

      // Hash the provided token to match stored hash
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      console.log("🔑 Token processing:", {
        originalToken: token,
        hashedToken: hashedToken.substring(0, 10) + "...",
        currentTime: new Date(Date.now()),
      });

      // Find user with valid password change token
      const user = await User.findOne({
        passwordChangeToken: hashedToken,
        passwordChangeExpires: { $gt: Date.now() },
      }).select("+pendingPassword");

      console.log("👤 User lookup result:", {
        found: !!user,
        userId: user?._id?.toString(),
        email: user?.email,
        hasPasswordChangeToken: !!user?.passwordChangeToken,
        hasExpiration: !!user?.passwordChangeExpires,
        hasPendingPassword: !!user?.pendingPassword,
        tokenExpires: user?.passwordChangeExpires,
        currentTime: new Date(Date.now()),
        isExpired: user?.passwordChangeExpires
          ? Date.now() > user.passwordChangeExpires.getTime()
          : "N/A",
      });

      if (!user) {
        console.log("❌ Password change failed: Token invalid or expired");
        res.status(400).json({
          success: false,
          message: "Password change token is invalid or has expired.",
        });
        return;
      }

      if (!user.pendingPassword) {
        console.log("❌ Password change failed: No pending password found");
        res.status(400).json({
          success: false,
          message: "No pending password change found.",
        });
        return;
      }

      console.log("🔒 User passwords before update:", {
        currentPasswordLength: user.password ? user.password.length : 0,
        pendingPasswordLength: user.pendingPassword
          ? user.pendingPassword.length
          : 0,
        currentPasswordStart: user.password
          ? user.password.substring(0, 10)
          : "none",
        pendingPasswordStart: user.pendingPassword
          ? user.pendingPassword.substring(0, 10)
          : "none",
      });

      // Apply the new password using direct update to avoid double hashing
      // The pendingPassword is already hashed, so we update directly without triggering pre-save hooks
      const updateResult = await User.updateOne(
        { _id: user._id },
        {
          $set: {
            password: user.pendingPassword,
            passwordChangedAt: new Date(),
          },
          $unset: {
            passwordChangeToken: 1,
            passwordChangeExpires: 1,
            pendingPassword: 1,
          },
        }
      );

      // Invalidate user cache after password update
      await CachePatterns.invalidateUserCache((user._id as any).toString());

      console.log("📝 Database update result:", {
        acknowledged: updateResult.acknowledged,
        modifiedCount: updateResult.modifiedCount,
        matchedCount: updateResult.matchedCount,
        upsertedCount: updateResult.upsertedCount,
      });

      // Verify the update by fetching the user again
      const updatedUser = await User.findById(user._id);
      console.log("✅ User after update:", {
        userId: updatedUser?._id?.toString(),
        passwordLength: updatedUser?.password ? updatedUser.password.length : 0,
        passwordStart: updatedUser?.password
          ? updatedUser.password.substring(0, 10)
          : "none",
        hasPasswordChangeToken: !!updatedUser?.passwordChangeToken,
        hasPendingPassword: !!updatedUser?.pendingPassword,
        passwordChangedAt: updatedUser?.passwordChangedAt,
      });

      // Send password change success trio
      try {
        console.log(
          "🔄 Starting trio notification for password change completion..."
        );

        // Email notification
        console.log("📧 Sending email notification...");
        await EmailService.sendPasswordResetSuccessEmail(
          user.email,
          user.firstName || user.username
        );
        console.log("✅ Email notification sent successfully");

        // System message
        console.log("📬 Creating system message...");
        const systemMessage =
          await UnifiedMessageController.createTargetedSystemMessage(
            {
              title: "Password Changed Successfully",
              content: `Your account password was changed successfully on ${new Date().toLocaleString()}. If you didn't make this change, please contact support immediately.`,
              // Use a valid type in the Message schema
              type: "update",
              priority: "medium",
              hideCreator: true,
            },
            [(user as any)._id.toString()],
            {
              id: "system",
              firstName: "System",
              lastName: "",
              username: "system",
              gender: "male",
              authLevel: "Super Admin",
              avatar: "",
            }
          );
        console.log(
          "✅ System message created successfully:",
          systemMessage?._id
        );

        console.log(
          `Password change success trio sent for user: ${user.email}`
        );
      } catch (error) {
        console.error(
          "❌ Failed to send password change success notifications:",
          error
        );
        if (error instanceof Error) {
          console.error("📋 Error stack:", error.stack);
        }
      }

      res.status(200).json({
        success: true,
        message: "Password changed successfully!",
      });
    } catch (error: any) {
      console.error("Complete password change error:", error);
      res.status(500).json({
        success: false,
        message: "Password change completion failed.",
      });
    }
  }
}
