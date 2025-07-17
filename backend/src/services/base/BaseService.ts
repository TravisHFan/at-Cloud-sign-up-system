/**
 * Base Service Class
 * Implements common patterns and utilities for all business services
 * Follows Single Responsibility Principle
 */

import mongoose from "mongoose";
import { IUser } from "../../models/User";

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export abstract class BaseService {
  /**
   * Wraps async operations with standardized error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string = "Operation failed"
  ): Promise<ServiceResult<T>> {
    try {
      const data = await operation();
      return {
        success: true,
        data,
        statusCode: 200,
      };
    } catch (error: any) {
      console.error(`${errorMessage}:`, error);

      // Handle specific error types
      if (error.name === "ValidationError") {
        return {
          success: false,
          error: this.formatValidationError(error),
          statusCode: 400,
        };
      }

      if (error.name === "CastError") {
        return {
          success: false,
          error: "Invalid ID format",
          statusCode: 400,
        };
      }

      if (error.code === 11000) {
        return {
          success: false,
          error: this.formatDuplicateKeyError(error),
          statusCode: 409,
        };
      }

      return {
        success: false,
        error: error.message || errorMessage,
        statusCode: error.statusCode || 500,
      };
    }
  }

  /**
   * Validates MongoDB ObjectId
   */
  protected validateObjectId(
    id: string,
    fieldName: string = "ID"
  ): ServiceResult<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        success: false,
        error: `Invalid ${fieldName} format`,
        statusCode: 400,
      };
    }
    return { success: true, data: true };
  }

  /**
   * Validates user authentication and permissions
   */
  protected validateUser(
    user: IUser | undefined,
    requiredPermissions?: string[]
  ): ServiceResult<IUser> {
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        statusCode: 401,
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: "Account is inactive",
        statusCode: 403,
      };
    }

    // Add permission validation if needed
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Implementation depends on your permission system
      // For now, just validate the user exists and is active
    }

    return { success: true, data: user };
  }

  /**
   * Applies pagination to a mongoose query
   */
  protected async applyPagination<T>(
    query: any,
    options: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    const { page, limit, sortBy = "createdAt", sortOrder = "desc" } = options;

    const skip = (page - 1) * limit;
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [data, totalCount] = await Promise.all([
      query.sort(sortObj).skip(skip).limit(limit).exec(),
      query.model.countDocuments(query.getQuery()),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Formats Mongoose validation errors
   */
  private formatValidationError(error: any): string {
    const errors = Object.values(error.errors).map((err: any) => err.message);
    return errors.join(", ");
  }

  /**
   * Formats MongoDB duplicate key errors
   */
  private formatDuplicateKeyError(error: any): string {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return `${field} '${value}' already exists`;
  }

  /**
   * Sanitizes data for output (removes sensitive fields)
   */
  protected sanitizeOutput<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[] = [
      "password",
      "resetPasswordToken",
      "verificationToken",
    ]
  ): Partial<T> {
    if (!data) return data;

    const sanitized = { ...data };
    sensitiveFields.forEach((field) => {
      delete sanitized[field];
    });

    return sanitized;
  }

  /**
   * Creates a standardized success response
   */
  protected createSuccessResult<T>(
    data: T,
    statusCode: number = 200
  ): ServiceResult<T> {
    return {
      success: true,
      data,
      statusCode,
    };
  }

  /**
   * Creates a standardized error response
   */
  protected createErrorResult(
    error: string,
    statusCode: number = 400
  ): ServiceResult {
    return {
      success: false,
      error,
      statusCode,
    };
  }
}
