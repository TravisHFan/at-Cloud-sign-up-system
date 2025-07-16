import { Request, Response } from "express";
import { User, IUser } from "../models";
import { TokenService } from "../middleware/auth";
import { RoleUtils, ROLES } from "../utils/roleUtils";
import { EmailService } from "../services/infrastructure/emailService";
import crypto from "crypto";
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

      // Validate @Cloud leader requirements
      if (isAtCloudLeader && !roleInAtCloud) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "Role in @Cloud is required for @Cloud leaders",
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
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
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

      // Send verification email
      const emailSent = await EmailService.sendVerificationEmail(
        user.email,
        user.firstName || user.username,
        verificationToken
      );

      if (!emailSent) {
        console.warn("Failed to send verification email to:", user.email);
      }

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
        });
        return;
      }

      const user = req.user as any;

      // Check if already verified
      if (user.isVerified) {
        res.status(200).json({
          success: true,
          message: "Email is already verified.",
        });
        return;
      }

      // Mark as verified and clear verification token
      user.isVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save();

      // Send welcome email
      await EmailService.sendWelcomeEmail(
        user.email,
        user.firstName || user.username
      );

      res.status(200).json({
        success: true,
        message: "Email verified successfully! Welcome to @Cloud Ministry.",
      });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "Email verification failed.",
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

  // Refresh access token (placeholder)
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement refresh token logic
      res.status(501).json({
        success: false,
        message: "Refresh token functionality not implemented yet.",
      });
    } catch (error: any) {
      console.error("Refresh token error:", error);
      res.status(500).json({
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
            emailNotifications: (req.user as any).emailNotifications,
            smsNotifications: (req.user as any).smsNotifications,
            pushNotifications: (req.user as any).pushNotifications,
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
}
