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

// Request validation middleware
import { Schema } from "joi";

export const validateRequest = (schema: {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details.map((d) => d.message).join(", ")}`);
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(
          `Params: ${error.details.map((d) => d.message).join(", ")}`
        );
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
      return;
    }

    next();
  };
};

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
