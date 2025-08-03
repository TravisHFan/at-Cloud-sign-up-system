import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest, createErrorResponse } from "../types/api";
import { hasPermission, Permission } from "../utils/roleUtils";

/**
 * Authentication utility functions for controllers
 */
export class AuthUtils {
  /**
   * Validates that user is authenticated and returns typed user
   */
  static validateAuth(
    req: Request,
    res: Response
  ): { user: AuthenticatedRequest["user"]; isValid: boolean } {
    const user = (req as AuthenticatedRequest).user;

    if (!user || !user.id) {
      res.status(401).json(createErrorResponse("Authentication required", 401));
      return { user: null as any, isValid: false };
    }

    return { user, isValid: true };
  }

  /**
   * Validates authentication and specific permission
   */
  static validateAuthAndPermission(
    req: Request,
    res: Response,
    permission: Permission
  ): { user: AuthenticatedRequest["user"]; isValid: boolean } {
    const { user, isValid } = this.validateAuth(req, res);

    if (!isValid) {
      return { user, isValid: false };
    }

    if (!hasPermission(user.role, permission)) {
      res
        .status(403)
        .json(createErrorResponse("Insufficient permissions", 403));
      return { user, isValid: false };
    }

    return { user, isValid: true };
  }

  /**
   * Validates MongoDB ObjectId format
   */
  static validateObjectId(
    id: string,
    fieldName: string = "ID"
  ): { isValid: boolean; error?: string } {
    const mongoose = require("mongoose");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        isValid: false,
        error: `Invalid ${fieldName} format`,
      };
    }

    return { isValid: true };
  }

  /**
   * Check if user can access resource (owns it or has admin privileges)
   */
  static canAccessResource(
    currentUser: AuthenticatedRequest["user"],
    resourceOwnerId: string,
    requiresAdmin: boolean = false
  ): boolean {
    // Admin/Super Admin can access everything
    if (
      currentUser.role === "Super Admin" ||
      currentUser.role === "Administrator"
    ) {
      return true;
    }

    // If admin is required, only admins can access
    if (requiresAdmin) {
      return false;
    }

    // User can access their own resources
    return currentUser.id === resourceOwnerId;
  }
}

/**
 * Middleware factory for route-level authentication
 */
export const requireAuth = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { isValid } = AuthUtils.validateAuth(req, res);
    if (isValid) {
      next();
    }
  };
};

/**
 * Middleware factory for route-level permission checking
 */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { isValid } = AuthUtils.validateAuthAndPermission(
      req,
      res,
      permission
    );
    if (isValid) {
      next();
    }
  };
};
