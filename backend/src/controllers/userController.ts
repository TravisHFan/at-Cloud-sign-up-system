import { Response } from "express";
import { createLogger } from "../services/LoggerService";

const log = createLogger("UserController");

// Response helper utilities
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
