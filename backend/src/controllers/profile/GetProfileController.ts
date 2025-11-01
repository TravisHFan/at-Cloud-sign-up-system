import { Request, Response } from "express";

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

  static authRequired(res: Response): void {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  static serverError(res: Response, error?: unknown): void {
    console.error("Error (500): Internal server error.", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

export default class GetProfileController {
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseHelper.authRequired(res);
        return;
      }

      const userData = {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phone: req.user.phone,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        gender: req.user.gender,
        avatar: req.user.avatar,
        role: req.user.role,
        isAtCloudLeader: req.user.isAtCloudLeader,
        roleInAtCloud: req.user.roleInAtCloud,
        homeAddress: req.user.homeAddress,
        occupation: req.user.occupation,
        company: req.user.company,
        weeklyChurch: req.user.weeklyChurch,
        churchAddress: req.user.churchAddress,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
        isVerified: req.user.isVerified,
        isActive: req.user.isActive,
      };

      ResponseHelper.success(res, { user: userData });
    } catch (error: unknown) {
      ResponseHelper.serverError(res, error);
    }
  }
}
