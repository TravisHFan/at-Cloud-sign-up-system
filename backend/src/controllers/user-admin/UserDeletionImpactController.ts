import { Request, Response } from "express";
import { ROLES } from "../../utils/roleUtils";

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

  static serverError(res: Response, error?: unknown): void {
    ResponseHelper.error(res, "Internal server error.", 500, error);
  }
}

/**
 * UserDeletionImpactController
 * Handles getUserDeletionImpact - preview deletion consequences without executing
 */
export default class UserDeletionImpactController {
  /**
   * Get user deletion impact analysis (Super Admin only)
   * Shows what would be deleted without performing the deletion
   */
  static async getUserDeletionImpact(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: userId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        return ResponseHelper.authRequired(res);
      }

      // Only Super Admin can view deletion impact
      if (currentUser.role !== ROLES.SUPER_ADMIN) {
        return ResponseHelper.forbidden(
          res,
          "Only Super Admin can view deletion impact."
        );
      }

      // Import UserDeletionService dynamically to avoid circular imports
      const { UserDeletionService } = await import(
        "../../services/UserDeletionService"
      );

      const impact = await UserDeletionService.getUserDeletionImpact(userId);

      ResponseHelper.success(
        res,
        impact,
        "Deletion impact analysis completed.",
        200
      );
    } catch (error: unknown) {
      console.error("Get deletion impact error:", error);
      ResponseHelper.serverError(res, error);
    }
  }
}
