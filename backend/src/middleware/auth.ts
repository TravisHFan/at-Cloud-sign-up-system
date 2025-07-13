import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User, IUser } from "../models";

// Extend Express Request interface to include user
declare global {
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
  private static readonly ACCESS_TOKEN_SECRET =
    process.env.JWT_ACCESS_SECRET || "your-access-secret-key";
  private static readonly REFRESH_TOKEN_SECRET =
    process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
  private static readonly ACCESS_TOKEN_EXPIRE =
    process.env.JWT_ACCESS_EXPIRE || "15m";
  private static readonly REFRESH_TOKEN_EXPIRE =
    process.env.JWT_REFRESH_EXPIRE || "7d";

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
  static verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: "atcloud-system",
        audience: "atcloud-users",
      });
    } catch (error) {
      throw new Error("Invalid access token");
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: "atcloud-system",
        audience: "atcloud-users",
      });
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  // Generate token pair
  static generateTokenPair(user: IUser) {
    const payload = {
      userId: (user._id as any).toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      userId: (user._id as any).toString(),
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      refreshTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
  }

  // Decode token without verification (for getting expired token data)
  static decodeToken(token: string): any {
    return jwt.decode(token);
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

    // Verify token
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
    req.userId = (user._id as any).toString();
    req.userRole = user.role;

    next();
  } catch (error: any) {
    console.error("Authentication error:", error.message);

    if (error.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
      return;
    }

    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Token has expired.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next(); // Continue without authentication
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      next(); // Continue without authentication
      return;
    }

    const decoded = TokenService.verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (user && user.isActive && user.isVerified) {
      req.user = user;
      req.userId = (user._id as any).toString();
      req.userRole = user.role;
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions.",
      });
      return;
    }

    next();
  };
};

// Check if user owns resource or is admin
export const checkOwnership = (resourceUserField: string = "user") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    // Admins can access any resource
    if (req.user.role === "admin") {
      next();
      return;
    }

    // Check if user owns the resource (will be validated in the route handler)
    req.userRole = req.user.role;
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

    const crypto = require("crypto");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification token.",
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

    const crypto = require("crypto");
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
