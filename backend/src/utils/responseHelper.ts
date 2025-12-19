import { Response } from "express";
import { createLogger } from "../services/LoggerService";

// Lazy-initialized logger to avoid side effects during test module loading
let _log: ReturnType<typeof createLogger> | null = null;
function getLog() {
  if (!_log) {
    _log = createLogger("ResponseHelper");
  }
  return _log;
}

/**
 * Shared response helper utilities for consistent API responses across controllers.
 * Use these methods to ensure uniform response format: { success: boolean, message?: string, data?: unknown }
 */
export class ResponseHelper {
  /**
   * Send a successful response
   * @param res - Express response object
   * @param data - Optional data payload
   * @param message - Optional success message
   * @param statusCode - HTTP status code (default: 200)
   */
  static success(
    res: Response,
    data?: unknown,
    message?: string,
    statusCode: number = 200
  ): void {
    const payload: Record<string, unknown> = { success: true };
    if (message) payload.message = message;
    if (typeof data !== "undefined") payload.data = data;
    res.status(statusCode).json(payload);
  }

  /**
   * Send an error response with logging
   * @param res - Express response object
   * @param message - Error message to send to client
   * @param statusCode - HTTP status code (default: 400)
   * @param error - Optional error object for logging
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    error?: unknown
  ): void {
    // Log the error
    const asError = error instanceof Error ? error : undefined;
    try {
      getLog().error(
        `Response error ${statusCode}: ${message}`,
        asError,
        undefined,
        {
          statusCode,
        }
      );
    } catch {
      // Avoid impacting response flow if logging throws
      console.error(`Error (${statusCode}):`, message, error);
    }

    res.status(statusCode).json({
      success: false,
      message,
    });
  }

  /**
   * Send a 400 Bad Request response
   */
  static badRequest(res: Response, message: string): void {
    ResponseHelper.error(res, message, 400);
  }

  /**
   * Send a 401 Unauthorized response
   */
  static authRequired(res: Response): void {
    ResponseHelper.error(res, "Authentication required.", 401);
  }

  /**
   * Send a 403 Forbidden response
   */
  static forbidden(res: Response, message: string = "Access denied."): void {
    ResponseHelper.error(res, message, 403);
  }

  /**
   * Send a 404 Not Found response
   */
  static notFound(
    res: Response,
    message: string = "Resource not found."
  ): void {
    ResponseHelper.error(res, message, 404);
  }

  /**
   * Send a 500 Internal Server Error response
   */
  static serverError(res: Response, error?: unknown): void {
    ResponseHelper.error(res, "Internal server error.", 500, error);
  }

  /**
   * Alias for serverError for consistency with some controllers
   */
  static internalServerError(
    res: Response,
    message: string = "Internal server error."
  ): void {
    ResponseHelper.error(res, message, 500);
  }
}

export default ResponseHelper;
