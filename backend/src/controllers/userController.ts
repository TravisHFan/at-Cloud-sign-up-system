import { Request, Response } from "express";
import { User } from "../models";
import AuditLog from "../models/AuditLog";
import Program from "../models/Program";
import Message from "../models/Message";
import {
  RoleUtils,
  ROLES,
  hasPermission,
  PERMISSIONS,
} from "../utils/roleUtils";
// import bcrypt from "bcryptjs"; // Not used here
import { getFileUrl } from "../middleware/upload";
// import path from "path"; // Not used here
import { cleanupOldAvatar } from "../utils/avatarCleanup";
import { socketService } from "../services/infrastructure/SocketService";
import { AutoEmailNotificationService } from "../services/infrastructure/autoEmailNotificationService";
import { UnifiedMessageController } from "./unifiedMessageController";
import { CachePatterns } from "../services";
import { EmailService } from "../services/infrastructure/emailService";
import { formatActorDisplay } from "../utils/systemMessageFormatUtils";
import { createLogger } from "../services/LoggerService";

const log = createLogger("UserController");

// Response helper utilities
class ResponseHelper {
  static success(
    res: Response,
    data?: unknown,
    message?: string,
    statusCode: number = 200
  ): void {
    const payload: Record<string, unknown> = { success: true };
    if (message) payload.message = message;
    if (typeof data !== "undefined") payload.data = data as unknown;
    res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    error?: unknown
  ): void {
    console.error(`Error (${statusCode}):`, message, error);
    // Structured log alongside console for observability (tests may assert console output)
    const asError = error instanceof Error ? error : undefined;
    try {
      log.error(
        `Response error ${statusCode}: ${message}`,
        asError,
        undefined,
        { statusCode }
      );
    } catch {
      // Avoid impacting response flow if logging throws for any reason
    }
    res.status(statusCode).json({
      success: false,
      message,
    });
  }

  static authRequired(res: Response): void {
    ResponseHelper.error(res, "Authentication required.", 401);
  }

  static forbidden(res: Response, message: string = "Access denied."): void {
    ResponseHelper.error(res, message, 403);
  }

  static notFound(
    res: Response,
    message: string = "Resource not found."
  ): void {
    ResponseHelper.error(res, message, 404);
  }

  static serverError(res: Response, error?: unknown): void {
    ResponseHelper.error(res, "Internal server error.", 500, error);
  }
}

// Interface for updating profile (matches frontend profileSchema exactly)
interface UpdateProfileRequest {
  username?: string;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  email?: string;
  phone?: string;
  isAtCloudLeader?: boolean;
  roleInAtCloud?: string;
  homeAddress?: string;
  occupation?: string;
  company?: string;
  weeklyChurch?: string;
  churchAddress?: string;
}

/**
 * UserController
 *
 * Legacy controller maintained for backward compatibility.
 * User management methods have been extracted to focused controllers:
 * - ProfileController: getProfile, updateProfile, uploadAvatar, changePassword
 * - UserAdminController: getUserById, getAllUsers, updateUserRole, deactivateUser,
 *                        reactivateUser, deleteUser, getUserDeletionImpact, adminEditProfile
 * - UserAnalyticsController: getUserStats
 *
 * This class is kept to preserve the ResponseHelper utility and interface definitions
 * that may be used elsewhere in the codebase.
 */
export class UserController {
  // All user management methods have been extracted to focused controllers.
  // See ProfileController, UserAdminController, and UserAnalyticsController.
}
