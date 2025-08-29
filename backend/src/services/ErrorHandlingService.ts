/**
 * Error Handling Service
 * Centralized error management and formatting
 * Follows Single Responsibility Principle
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "./LoggerService";

export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
  CONFLICT_ERROR = "CONFLICT_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  statusCode: number;
  details?: unknown;
  field?: string;
  code?: string;
  stack?: string;
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly field?: string;
  public readonly code?: string;
  public readonly isOperational: boolean;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number = 500,
    details?: unknown,
    field?: string,
    code?: string
  ) {
    super(message);

    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.field = field;
    this.code = code;
    this.isOperational = true;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    this.name = this.constructor.name;
  }

  public toJSON(): ErrorDetails {
    return {
      type: this.type,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      field: this.field,
      code: this.code,
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    };
  }
}

export class ErrorHandlingService {
  /**
   * Create validation error
   */
  static createValidationError(
    message: string,
    field?: string,
    details?: unknown
  ): AppError {
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      message,
      400,
      details,
      field,
      "VALIDATION_FAILED"
    );
  }

  /**
   * Create authentication error
   */
  static createAuthenticationError(
    message: string = "Authentication required",
    details?: unknown
  ): AppError {
    return new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      message,
      401,
      details,
      undefined,
      "AUTH_REQUIRED"
    );
  }

  /**
   * Create authorization error
   */
  static createAuthorizationError(
    message: string = "Insufficient permissions",
    details?: unknown
  ): AppError {
    return new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      message,
      403,
      details,
      undefined,
      "ACCESS_DENIED"
    );
  }

  /**
   * Create not found error
   */
  static createNotFoundError(
    resource: string = "Resource",
    id?: string
  ): AppError {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    return new AppError(
      ErrorType.NOT_FOUND_ERROR,
      message,
      404,
      { resource, id },
      undefined,
      "NOT_FOUND"
    );
  }

  /**
   * Create conflict error
   */
  static createConflictError(message: string, details?: unknown): AppError {
    return new AppError(
      ErrorType.CONFLICT_ERROR,
      message,
      409,
      details,
      undefined,
      "CONFLICT"
    );
  }

  /**
   * Create database error
   */
  static createDatabaseError(
    message: string,
    originalError?: Error,
    operation?: string
  ): AppError {
    return new AppError(
      ErrorType.DATABASE_ERROR,
      message,
      500,
      { originalError: originalError?.message, operation },
      undefined,
      "DATABASE_ERROR"
    );
  }

  /**
   * Create rate limit error
   */
  static createRateLimitError(
    message: string = "Too many requests",
    retryAfter?: number
  ): AppError {
    return new AppError(
      ErrorType.RATE_LIMIT_ERROR,
      message,
      429,
      { retryAfter },
      undefined,
      "RATE_LIMIT_EXCEEDED"
    );
  }

  /**
   * Parse MongoDB errors
   */
  static parseMongoError(error: unknown): AppError {
    const e = error as {
      code?: number;
      keyValue?: Record<string, unknown>;
      name?: string;
      errors?: Record<
        string,
        { path: string; message: string; value?: unknown }
      >;
      path?: string;
      value?: unknown;
      message?: string;
    };
    // Duplicate key error
    if (e.code === 11000) {
      const field = Object.keys(e.keyValue || {})[0];
      const value = (e.keyValue as Record<string, unknown> | undefined)?.[
        field
      ];
      return this.createConflictError(`${field} '${value}' already exists`, {
        field,
        value,
      });
    }

    // Validation error
    if (e.name === "ValidationError" && e.errors) {
      const errors = Object.values(e.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));

      return this.createValidationError("Validation failed", undefined, {
        errors,
      });
    }

    // Cast error (invalid ObjectId)
    if (e.name === "CastError" && e.path) {
      return this.createValidationError(
        `Invalid ${e.path}: ${String(e.value)}`,
        e.path
      );
    }

    // Generic database error
    return this.createDatabaseError(
      "Database operation failed",
      error instanceof Error ? error : new Error(String(error))
    );
  }

  /**
   * Parse JWT errors
   */
  static parseJWTError(error: unknown): AppError {
    const e = error as { name?: string };
    if (e.name === "TokenExpiredError") {
      return this.createAuthenticationError("Token has expired");
    }

    if (e.name === "JsonWebTokenError") {
      return this.createAuthenticationError("Invalid token");
    }

    if (e.name === "NotBeforeError") {
      return this.createAuthenticationError("Token not active");
    }

    return this.createAuthenticationError("Token validation failed");
  }

  /**
   * Handle different types of errors
   */
  static handleError(error: unknown): AppError {
    // If it's already an AppError, return as is
    if (error instanceof AppError) {
      return error;
    }

    // Handle MongoDB errors
    const e = error as { name?: string; code?: number };
    if (
      e.name === "MongoError" ||
      e.name === "ValidationError" ||
      e.code === 11000
    ) {
      return this.parseMongoError(e);
    }

    // Handle JWT errors
    if (e.name?.includes("Token") || e.name === "JsonWebTokenError") {
      return this.parseJWTError(e);
    }

    // Handle specific HTTP errors
    const eh = error as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    if (eh.status || eh.statusCode) {
      const statusCode = eh.status || eh.statusCode;
      let type: ErrorType;

      switch (statusCode) {
        case 400:
          type = ErrorType.VALIDATION_ERROR;
          break;
        case 401:
          type = ErrorType.AUTHENTICATION_ERROR;
          break;
        case 403:
          type = ErrorType.AUTHORIZATION_ERROR;
          break;
        case 404:
          type = ErrorType.NOT_FOUND_ERROR;
          break;
        case 409:
          type = ErrorType.CONFLICT_ERROR;
          break;
        case 429:
          type = ErrorType.RATE_LIMIT_ERROR;
          break;
        default:
          type = ErrorType.INTERNAL_SERVER_ERROR;
      }

      return new AppError(type, eh.message || "Error", statusCode);
    }

    // Generic internal server error
    return new AppError(
      ErrorType.INTERNAL_SERVER_ERROR,
      (error as { message?: string })?.message ||
        "An unexpected error occurred",
      500,
      { originalError: (error as { message?: string })?.message }
    );
  }

  /**
   * Express error handler middleware
   */
  static errorHandler() {
    return (
      error: unknown,
      req: Request,
      res: Response,
      _next: NextFunction
    ): void => {
      const appError = this.handleError(error);

      // Log the error
      const errForLog =
        error instanceof Error ? error : new Error(String(error));
      logger.error(
        `Error in ${req.method} ${req.path}`,
        errForLog,
        "ErrorHandler",
        {
          type: appError.type,
          statusCode: appError.statusCode,
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          body: req.body,
          params: req.params,
          query: req.query,
        }
      );

      // Send error response
      const errorPayload: Record<string, unknown> = {
        type: appError.type,
        message: appError.message,
        code: appError.code,
      };
      if (appError.field) {
        errorPayload.field = appError.field;
      }
      if (typeof appError.details !== "undefined") {
        errorPayload.details = appError.details;
      }
      if (process.env.NODE_ENV === "development" && appError.stack) {
        errorPayload.stack = appError.stack;
      }

      res.status(appError.statusCode).json({
        success: false,
        error: errorPayload,
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || "unknown",
      });
    };
  }

  /**
   * 404 handler middleware
   */
  static notFoundHandler() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const error = this.createNotFoundError(
        "Route",
        `${req.method} ${req.path}`
      );
      next(error);
    };
  }

  /**
   * Async error wrapper
   */
  static asyncHandler<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): T {
    return ((...args: unknown[]) => {
      const next = args[2] as NextFunction;
      return Promise.resolve(fn(...(args as Parameters<T>))).catch(next);
    }) as T;
  }

  /**
   * Validation result handler
   */
  static handleValidationResult(validationResult: {
    isValid: boolean;
    errors: string[];
  }): void {
    if (!validationResult.isValid) {
      throw this.createValidationError(
        validationResult.errors.join(", "),
        undefined,
        { errors: validationResult.errors }
      );
    }
  }

  /**
   * Safe async operation wrapper
   */
  static async safeAsync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const appError = this.handleError(error);
      logger.error(
        `Error in ${context}`,
        error instanceof Error ? error : new Error(String(error)),
        context
      );
      return { success: false, error: appError };
    }
  }

  /**
   * Create error response format
   */
  static createErrorResponse(
    error: AppError,
    requestId?: string
  ): {
    success: false;
    error: ErrorDetails & { requestId?: string; timestamp: string };
  } {
    return {
      success: false,
      error: {
        ...error.toJSON(),
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if error is operational (expected) or programming error
   */
  static isOperationalError(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }
}

// Export commonly used error creators
export const {
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError,
  createDatabaseError,
  createRateLimitError,
  asyncHandler,
  handleValidationResult,
} = ErrorHandlingService;
