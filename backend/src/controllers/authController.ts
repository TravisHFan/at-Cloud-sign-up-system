import { Request, Response } from "express";
import { User, IUser } from "../models";
import { TokenService } from "../middleware/auth";
import { RoleUtils, ROLES } from "../utils/roleUtils";
import { EmailService } from "../services/emailService";
import crypto from "crypto";

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

      // Validation
      if (!acceptTerms) {
        res.status(400).json({
          success: false,
          message: "You must accept the terms and conditions to register.",
        });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: "Passwords do not match.",
        });
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username: username }],
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message:
            existingUser.email === email.toLowerCase()
              ? "Email address is already registered."
              : "Username is already taken.",
        });
        return;
      }

      // Validate @Cloud leader requirements
      if (isAtCloudLeader && !roleInAtCloud) {
        res.status(400).json({
          success: false,
          message: "Role in @Cloud is required for @Cloud leaders.",
        });
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

      res.status(201).json({
        success: true,
        message:
          "Registration successful! Please check your email to verify your account.",
        data: {
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
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error.code === 11000) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        res.status(409).json({
          success: false,
          message: `${field} is already registered.`,
        });
        return;
      }

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        res.status(400).json({
          success: false,
          message: "Validation failed.",
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Registration failed. Please try again.",
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { emailOrUsername, password, rememberMe }: LoginRequest = req.body;

      if (!emailOrUsername || !password) {
        res.status(400).json({
          success: false,
          message: "Email/username and password are required.",
        });
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
        res.status(401).json({
          success: false,
          message: "Invalid email/username or password.",
        });
        return;
      }

      // Check if account is locked
      if ((user as any).isAccountLocked()) {
        res.status(423).json({
          success: false,
          message:
            "Account is temporarily locked due to too many failed login attempts. Please try again later.",
        });
        return;
      }

      // Check if account is active
      if (!(user as any).isActive) {
        res.status(403).json({
          success: false,
          message: "Account has been deactivated. Please contact support.",
        });
        return;
      }

      // Verify password
      const isPasswordValid = await (user as any).comparePassword(password);

      if (!isPasswordValid) {
        await (user as any).incrementLoginAttempts();
        res.status(401).json({
          success: false,
          message: "Invalid email/username or password.",
        });
        return;
      }

      // Check if email is verified (optional based on requirements)
      if (!(user as any).isVerified) {
        res.status(403).json({
          success: false,
          message: "Please verify your email address before logging in.",
          data: {
            requiresVerification: true,
            email: (user as any).email,
          },
        });
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

      res.status(200).json({
        success: true,
        message: "Login successful!",
        data: {
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
        },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed. Please try again.",
      });
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
