/* eslint-disable @typescript-eslint/no-namespace */
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import { User, IUser } from "../models";
import {
  RoleUtils,
  ROLES,
  UserRole,
  hasPermission,
  Permission,
} from "../utils/roleUtils";

// Narrow JWT payloads used in this module
type AccessTokenPayload = jwt.JwtPayload & {
  userId: string;
  email?: string;
  role?: string;
};
type RefreshTokenPayload = jwt.JwtPayload & { userId: string };

// Extend Express Request interface to include user
declare global {
  // Use module augmentation for Express Request
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
      userRole?: string;
    }
  }
}

// JWT Token Service
export class TokenService {
  // Use dynamic getters instead of static properties to ensure env vars are loaded
  private static get ACCESS_TOKEN_SECRET() {
    return process.env.JWT_ACCESS_SECRET || "your-access-secret-key";
  }

  private static get REFRESH_TOKEN_SECRET() {
    return process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
  }

  private static get ACCESS_TOKEN_EXPIRE() {
    // Reduced default access token expiry from 12h to 3h
    return process.env.JWT_ACCESS_EXPIRE || "3h";
  }

  private static get REFRESH_TOKEN_EXPIRE() {
    return process.env.JWT_REFRESH_EXPIRE || "7d";
  }

  // Generate access token
  static generateAccessToken(payload: {
    userId: string;
    email: string;
    role: string;
  }): string {
    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRE,
      issuer: "atcloud-system",
      audience: "atcloud-users",
    } as jwt.SignOptions);
  }

  // Generate refresh token
  static generateRefreshToken(payload: { userId: string }): string {
    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRE,
      issuer: "atcloud-system",
      audience: "atcloud-users",
    } as jwt.SignOptions);
  }

  // Verify access token
  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: "atcloud-system",
        audience: "atcloud-users",
      }) as AccessTokenPayload;
    } catch {
      throw new Error("Invalid access token");
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: "atcloud-system",
        audience: "atcloud-users",
      }) as RefreshTokenPayload;
    } catch {
      throw new Error("Invalid refresh token");
    }
  }

  // Helper function to parse JWT time strings to milliseconds
  static parseTimeToMs(timeString: string): number {
    // Handle numeric strings (seconds)
    if (/^\d+$/.test(timeString)) {
      return parseInt(timeString, 10) * 1000;
    }

    // Parse time strings like "3h", "7d", "15m", etc.
    const match = timeString.match(/^(\d+)([smhdwy])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeString}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000; // seconds
      case "m":
        return value * 60 * 1000; // minutes
      case "h":
        return value * 60 * 60 * 1000; // hours
      case "d":
        return value * 24 * 60 * 60 * 1000; // days
      case "w":
        return value * 7 * 24 * 60 * 60 * 1000; // weeks
      case "y":
        return value * 365 * 24 * 60 * 60 * 1000; // years
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }
  }

  // Generate token pair
  static generateTokenPair(user: IUser) {
    const payload = {
      userId: String(user._id),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      userId: String(user._id),
    });

    // Clock skew buffer: subtract 30s so frontend treats token as expired slightly earlier
    const CLOCK_SKEW_MS = 30 * 1000;

    // Parse expiration times from environment variables to get actual milliseconds
    const accessMs = this.parseTimeToMs(this.ACCESS_TOKEN_EXPIRE);
    const refreshMs = this.parseTimeToMs(this.REFRESH_TOKEN_EXPIRE);

    return {
      accessToken,
      refreshToken,
      accessTokenExpires: new Date(Date.now() + accessMs - CLOCK_SKEW_MS),
      refreshTokenExpires: new Date(Date.now() + refreshMs), // No clock skew for refresh token
    };
  }

  // Decode token without verification (for getting expired token data)
  static decodeToken(token: string): jwt.JwtPayload | string | null {
    return jwt.decode(token) as jwt.JwtPayload | string | null;
  }
}

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided or invalid format.",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. Token is missing.",
      });
      return;
    }

    // Test environment shortcut tokens (bypass JWT verification)
    if (process.env.NODE_ENV === "test") {
      if (
        token.startsWith("test-admin-") &&
        mongoose.Types.ObjectId.isValid(token.substring("test-admin-".length))
      ) {
        const userId = token.substring("test-admin-".length);
        // Fetch user document to ensure it exists (and role), fallback to injected admin role
        const userDoc = await User.findById(userId);
        (req as Request & { user?: unknown }).user =
          userDoc ||
          ({
            _id: userId,
            id: userId,
            role: ROLES.ADMINISTRATOR,
            isVerified: true,
            isActive: true,
          } as Record<string, unknown>);
        req.userId = userId;
        req.userRole = ROLES.ADMINISTRATOR;
        return next();
      }
      if (
        token.startsWith("test-") &&
        mongoose.Types.ObjectId.isValid(token.substring("test-".length))
      ) {
        const userId = token.substring("test-".length);
        const userDoc = await User.findById(userId);
        (req as Request & { user?: unknown }).user =
          userDoc ||
          ({
            _id: userId,
            id: userId,
            role: ROLES.PARTICIPANT,
            isVerified: true,
            isActive: true,
          } as Record<string, unknown>);
        req.userId = userId;
        req.userRole = ROLES.PARTICIPANT;
        return next();
      }
    }

    // Verify real JWT token
    const decoded = TokenService.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select("+password");

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: "Invalid token. User not found or inactive.",
      });
      return;
    }

    // Check if user is verified (optional based on your requirements)
    if (!user.isVerified) {
      res.status(403).json({
        success: false,
        message: "Account not verified. Please verify your email address.",
      });
      return;
    }

    // Attach user to request object
    req.user = user;
    req.userId = String(user._id);
    req.userRole = user.role;

    next();
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Auth error");
    console.error("Authentication error:", err.message);

    if (err.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
      return;
    }

    if (err.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Token has expired.",
      });
      return;
    }

    // For any other authentication-related error, return 401
    res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

// Optional Authentication middleware: attaches req.user if a valid token is provided, but never blocks
export const authenticateOptional = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);
    if (!token) return next();

    // Verify token; if invalid, fall through and continue unauthenticated
    const decoded = TokenService.verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select("+password");
    if (!user || !user.isActive || !user.isVerified) {
      return next();
    }

    // Attach user context and proceed
    req.user = user;
    req.userId = String(user._id);
    req.userRole = user.role;
    return next();
  } catch {
    // Silently ignore errors; proceed as unauthenticated
    return next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Invalid or missing token.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "Insufficient permissions.",
      });
      return;
    }

    next();
  };
};

// Advanced role-based authorization using role utilities
export const authorizeRoles = (...requiredRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!RoleUtils.hasAnyRole(req.user.role, requiredRoles)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${requiredRoles.join(" or ")}`,
      });
      return;
    }

    next();
  };
};

// Minimum role authorization (user must have this role or higher)
export const authorizeMinimumRole = (minimumRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!RoleUtils.hasMinimumRole(req.user.role, minimumRole)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Minimum required role: ${minimumRole}`,
      });
      return;
    }

    next();
  };
};

// Permission-based authorization
export const authorizePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
      });
      return;
    }

    next();
  };
};

// Verify email token middleware
export const verifyEmailToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        success: false,
        message: "Verification token is required.",
      });
      return;
    }

    const crypto = await import("crypto");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      // Check if token exists but is expired
      const expiredUser = await User.findOne({
        emailVerificationToken: hashedToken,
      });

      if (expiredUser) {
        res.status(400).json({
          success: false,
          message: "Verification token has expired.",
          errorType: "expired_token",
        });
        return;
      }

      // Token doesn't exist - might be already used
      // For a better user experience, let's just return a generic success
      // since we can't reliably determine if it was successfully used before
      res.status(200).json({
        success: true,
        message: "Email verification completed successfully.",
        alreadyVerified: true,
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed.",
    });
  }
};

// Password reset token middleware
export const verifyPasswordResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: "Reset token is required.",
      });
      return;
    }

    const crypto = await import("crypto");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired reset token.",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Password reset verification error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset verification failed.",
    });
  }
};

// Admin-only middleware (Administrator or Super Admin)
export const requireAdmin = authorizeMinimumRole(ROLES.ADMINISTRATOR);

// Super Admin-only middleware
export const requireSuperAdmin = authorizeRoles(ROLES.SUPER_ADMIN);

// Leader or higher middleware
export const requireLeader = authorizeMinimumRole(ROLES.LEADER);

// @Cloud co-worker authorization (for @Cloud-specific features)
export const authorizeAtCloudLeader = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  // Check if user is an @Cloud co-worker or has admin privileges
  if (req.user.isAtCloudLeader || RoleUtils.isAdmin(req.user.role)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: "Access denied. @Cloud co-worker status required.",
  });
};

// Event ownership or admin access
export const authorizeEventAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const eventId = req.params.eventId || req.params.id;

    if (!eventId) {
      res.status(400).json({
        success: false,
        message: "Event ID is required.",
      });
      return;
    }

    // Admins can access any event
    if (RoleUtils.isAdmin(req.user.role)) {
      next();
      return;
    }

    // Import Event model here to avoid circular dependency
    const { Event } = await import("../models");
    const event = await Event.findById(eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        message: "Event not found.",
      });
      return;
    }

    // Check if user created the event
    const currentUserId = String(req.user._id);
    const eventCreatorId = String(event.createdBy);

    if (currentUserId === eventCreatorId) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: "Access denied. You can only access events you created.",
    });
  } catch (error) {
    console.error("Event authorization error:", error);
    res.status(500).json({
      success: false,
      message: "Authorization check failed.",
    });
  }
};

// Event management authorization (for removing/moving users)
export const authorizeEventManagement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("DEBUG: authorizeEventManagement called");
    console.log("DEBUG: req.user exists:", !!req.user);
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    // Admins (Administrator or Super Admin) can manage any event; bypass further checks
    console.log("DEBUG: req.user.role:", req.user.role);
    // Note: use direct role comparison here instead of RoleUtils.isAdmin because tests mock RoleUtils
    // without stubbing isAdmin for this path.
    const isAdminByRole =
      req.user.role === ROLES.ADMINISTRATOR ||
      req.user.role === ROLES.SUPER_ADMIN;
    console.log("DEBUG: isAdminByRole:", isAdminByRole);
    if (isAdminByRole) {
      next();
      return;
    }

    const eventId = req.params.eventId || req.params.id;

    if (!eventId) {
      res.status(400).json({
        success: false,
        message: "Event ID is required.",
      });
      return;
    }

    // Import Event model here to avoid circular dependency
    const { Event } = await import("../models");
    const event = await Event.findById(eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        message: "Event not found.",
      });
      return;
    }

    const currentUserId = String(req.user._id);
    const eventCreatorId = String(event.createdBy);

    // Check if user created the event
    if (currentUserId === eventCreatorId) {
      next();
      return;
    }

    // Check if user is listed as an organizer
    const isOrganizer = event.organizerDetails?.some(
      (organizer: { userId?: { toString(): string } }) =>
        organizer.userId?.toString() === currentUserId
    );

    if (isOrganizer) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message:
        "Access denied. You must be an Administrator, Super Admin, event creator, or listed organizer to manage this event.",
    });
  } catch (error) {
    console.error("Event management authorization error:", error);
    res.status(500).json({
      success: false,
      message: "Authorization check failed.",
    });
  }
};

// Conditional authorization based on @Cloud co-worker status and role
export const conditionalAuthorization = (
  requireAtCloudLeader: boolean = false,
  minimumRole?: UserRole,
  allowedRoles?: UserRole[]
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    // Check @Cloud co-worker requirement
    if (
      requireAtCloudLeader &&
      !req.user.isAtCloudLeader &&
      !RoleUtils.isAdmin(req.user.role)
    ) {
      res.status(403).json({
        success: false,
        message: "Access denied. @Cloud co-worker status required.",
      });
      return;
    }

    // Check role requirements
    if (minimumRole && !RoleUtils.hasMinimumRole(req.user.role, minimumRole)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Minimum required role: ${minimumRole}`,
      });
      return;
    }

    if (allowedRoles && !RoleUtils.hasAnyRole(req.user.role, allowedRoles)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(" or ")}`,
      });
      return;
    }

    next();
  };
};
