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

  static handleValidationError(error: any): ApiResponse {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (err: any) => err.message
      );
      return createErrorResponse(
        `Validation failed: ${messages.join(", ")}`,
        400
      );
    }
    return createErrorResponse("Validation error", 400);
  }

  static handleDuplicateKeyError(error: any): ApiResponse {
    const field = Object.keys(error.keyValue)[0];
    return createErrorResponse(
      `Duplicate value for field: ${field}. Please use another value.`,
      400
    );
  }

  static handleCastError(error: any): ApiResponse {
    return createErrorResponse(`Invalid ${error.path}: ${error.value}`, 400);
  }

  static handleJWTError(): ApiResponse {
    return createErrorResponse("Invalid token. Please log in again.", 401);
  }

  static handleJWTExpiredError(): ApiResponse {
    return createErrorResponse("Token expired. Please log in again.", 401);
  }

  static globalErrorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    let error = { ...err };
    error.message = err.message;

    // Log error
    console.error("Error:", err);

    // Mongoose bad ObjectId
    if (err.name === "CastError") {
      error = ErrorHandlerMiddleware.handleCastError(err);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      error = ErrorHandlerMiddleware.handleDuplicateKeyError(err);
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
      error = ErrorHandlerMiddleware.handleValidationError(err);
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
      error = ErrorHandlerMiddleware.handleJWTError();
    }

    if (err.name === "TokenExpiredError") {
      error = ErrorHandlerMiddleware.handleJWTExpiredError();
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server Error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
}

export default ErrorHandlerMiddleware;
