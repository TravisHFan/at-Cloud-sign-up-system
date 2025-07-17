/**
 * Refactored User Controller
 * Follows SOLID principles:
 * - Single Responsibility: Only handles HTTP requests/responses
 * - Open/Closed: Extensible through dependency injection
 * - Liskov Substitution: Uses interfaces for dependencies
 * - Interface Segregation: Focused interfaces
 * - Dependency Inversion: Depends on abstractions, not concretions
 */

import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { UserRepository } from "../repositories/UserRepository";

export class RefactoredUserController {
  private userService: UserService;

  constructor(userService?: UserService) {
    // Dependency injection - allows for easy testing and flexibility
    this.userService = userService || new UserService(new UserRepository());
  }

  /**
   * Create a new user
   * POST /api/users
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.userService.createUser(req.body);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.userService.getUserById(id);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error getting user:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Update user
   * PUT /api/users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.userService.updateUser(id, req.body);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Delete user (soft delete)
   * DELETE /api/users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.userService.deleteUser(id);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Search users with pagination
   * GET /api/users
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        department,
        isActive,
        emailVerified,
        searchTerm,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const options = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        role: role as string,
        department: department as string,
        isActive:
          isActive === "true" ? true : isActive === "false" ? false : undefined,
        emailVerified:
          emailVerified === "true"
            ? true
            : emailVerified === "false"
            ? false
            : undefined,
        searchTerm: searchTerm as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
      };

      const result = await this.userService.searchUsers(options);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error searching users:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Get users by role
   * GET /api/users/role/:role
   */
  async getUsersByRole(req: Request, res: Response): Promise<void> {
    try {
      const { role } = req.params;
      const result = await this.userService.getUsersByRole(role);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error getting users by role:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Update user password
   * PUT /api/users/:id/password
   */
  async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: "Current password and new password are required",
        });
        return;
      }

      const result = await this.userService.updatePassword(
        id,
        currentPassword,
        newPassword
      );

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating password:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Update user preferences
   * PUT /api/users/:id/preferences
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.userService.updatePreferences(id, req.body);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Preferences updated successfully",
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Update notification settings
   * PUT /api/users/:id/notifications
   */
  async updateNotificationSettings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.userService.updateNotificationSettings(
        id,
        req.body
      );

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Notification settings updated successfully",
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  async getUserStatistics(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.userService.getUserStatistics();

      if (!result.success) {
        res.status(result.statusCode || 500).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error getting user statistics:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Verify email
   * POST /api/users/verify-email
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: "Verification token is required",
        });
        return;
      }

      const result = await this.userService.verifyEmail(token);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
        data: result.data,
      });
    } catch (error: any) {
      console.error("Error verifying email:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Request password reset
   * POST /api/users/request-password-reset
   */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: "Email is required",
        });
        return;
      }

      const result = await this.userService.requestPasswordReset(email);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Password reset email sent (if email exists)",
      });
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Reset password
   * POST /api/users/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          error: "Token and new password are required",
        });
        return;
      }

      const result = await this.userService.resetPassword(token, newPassword);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Bulk update users
   * PUT /api/users/bulk
   */
  async bulkUpdateUsers(req: Request, res: Response): Promise<void> {
    try {
      const { userIds, updateData } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: "User IDs array is required",
        });
        return;
      }

      if (!updateData) {
        res.status(400).json({
          success: false,
          error: "Update data is required",
        });
        return;
      }

      const result = await this.userService.bulkUpdateUsers(
        userIds,
        updateData
      );

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Successfully updated ${result.data} users`,
        data: { updatedCount: result.data },
      });
    } catch (error: any) {
      console.error("Error bulk updating users:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}
