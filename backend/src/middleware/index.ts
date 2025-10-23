import { Request, Response, NextFunction } from "express";
import ErrorHandlerMiddleware from "./errorHandler";

// Rate limiting middleware
import rateLimit from "express-rate-limit";

export const createRateLimit = (
  windowMs: number,
  max: number,
  message?: string
) => {
  return rateLimit({
    windowMs,
    max,
    message: message || {
      success: false,
      message: "Too many requests, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.round(windowMs / 1000),
      });
    },
  });
};

// Common rate limits
export const authRateLimit = createRateLimit(15 * 60 * 1000, 10); // 10 requests per 15 minutes
export const generalRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const uploadRateLimit = createRateLimit(60 * 60 * 1000, 20); // 20 uploads per hour

// Image compression middleware
export {
  compressUploadedImage,
  logCompressionStats,
  includeCompressionInfo,
} from "./imageCompression";

// Error handling middleware
export const errorHandler = ErrorHandlerMiddleware.globalErrorHandler;

// Not found middleware
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

// Request logger middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // lightweight hook; expand with metrics if needed

  res.on("finish", () => {
    // Intentionally minimal logger; expand metrics when needed
  });

  next();
};
