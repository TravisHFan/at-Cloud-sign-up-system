import { Request, Response, NextFunction } from "express";
import { ApiResponse, createErrorResponse } from "../types/api";

export class ErrorHandlerMiddleware {
  static async handleAsyncError(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static handleValidationError(error: unknown): ApiResponse {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "ValidationError"
    ) {
      const errObj = error as {
        errors: Record<string, { message: string }>;
      };
      const messages = Object.values(errObj.errors).map((e) => e.message);
      return createErrorResponse(
        `Validation failed: ${messages.join(", ")}`,
        400
      );
    }
    return createErrorResponse("Validation error", 400);
  }

  static handleDuplicateKeyError(error: unknown): ApiResponse {
    const field =
      typeof error === "object" &&
      error !== null &&
      "keyValue" in error &&
      error.keyValue &&
      typeof (error as { keyValue: Record<string, unknown> }).keyValue ===
        "object"
        ? Object.keys(
            (error as { keyValue: Record<string, unknown> }).keyValue
          )[0]
        : "unknown";
    return createErrorResponse(
      `Duplicate value for field: ${field}. Please use another value.`,
      400
    );
  }

  static handleCastError(error: unknown): ApiResponse {
    const err = error as { path?: string; value?: unknown };
    return createErrorResponse(
      `Invalid ${err.path}: ${String(err.value)}`,
      400
    );
  }

  static handleJWTError(): ApiResponse {
    return createErrorResponse("Invalid token. Please log in again.", 401);
  }

  static handleJWTExpiredError(): ApiResponse {
    return createErrorResponse("Token expired. Please log in again.", 401);
  }

  static globalErrorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    const base = err as {
      [k: string]: unknown;
      message?: string;
      name?: string;
      code?: number;
      stack?: string;
    };
    let statusCode: number | undefined;
    let message: string | undefined = base.message;

    // Log error
    console.error("Error:", err);

    // Mongoose bad ObjectId
    if (base.name === "CastError") {
      const resp = ErrorHandlerMiddleware.handleCastError(base);
      statusCode = resp.statusCode;
      message = resp.message;
    }

    // Mongoose duplicate key
    if (base.code === 11000) {
      const resp = ErrorHandlerMiddleware.handleDuplicateKeyError(base);
      statusCode = resp.statusCode;
      message = resp.message;
    }

    // Mongoose validation error
    if (base.name === "ValidationError") {
      const resp = ErrorHandlerMiddleware.handleValidationError(base);
      statusCode = resp.statusCode;
      message = resp.message;
    }

    // JWT errors
    if (base.name === "JsonWebTokenError") {
      const resp = ErrorHandlerMiddleware.handleJWTError();
      statusCode = resp.statusCode;
      message = resp.message;
    }

    if (base.name === "TokenExpiredError") {
      const resp = ErrorHandlerMiddleware.handleJWTExpiredError();
      statusCode = resp.statusCode;
      message = resp.message;
    }

    res.status(statusCode || 500).json({
      success: false,
      message: message || "Server Error",
      ...(process.env.NODE_ENV === "development" && {
        stack: base.stack,
      }),
    });
  }
}

export default ErrorHandlerMiddleware;
