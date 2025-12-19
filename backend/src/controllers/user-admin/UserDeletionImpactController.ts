import { Request, Response } from "express";
import { ROLES } from "../../utils/roleUtils";
import { ResponseHelper } from "../../utils/responseHelper";

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
