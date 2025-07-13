import { Request, Response, NextFunction } from "express";
import { AuditLog } from "../models";

// Audit logging middleware
export const auditLogger = (action: string, resourceType: string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const originalSend = res.send;
    let responseBody: any;

    // Capture response body
    res.send = function (body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Continue with the request
    next();

    // Log after response is sent
    res.on("finish", async () => {
      try {
        const result =
          res.statusCode >= 200 && res.statusCode < 300
            ? "success"
            : res.statusCode >= 400 && res.statusCode < 500
            ? "warning"
            : "failure";

        await AuditLog.create({
          user: req.userId || undefined,
          action,
          resource: {
            type: resourceType as any,
            id: req.params.id || req.body.id || undefined,
          },
          details: {
            method: req.method,
            endpoint: req.path,
            userAgent: req.get("User-Agent"),
            ipAddress: req.ip || req.socket.remoteAddress,
            metadata: {
              query: req.query,
              params: req.params,
              statusCode: res.statusCode,
            },
          },
          result,
          errorMessage: result === "failure" ? "Request failed" : undefined,
          sessionId: req.get("X-Session-ID"),
          requestId: req.get("X-Request-ID"),
        });
      } catch (error) {
        console.error("Audit logging failed:", error);
      }
    });
  };
};

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
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  console.error("Error:", err);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(", ");
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = { message, statusCode: 401 };
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = { message, statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

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
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const { statusCode } = res;

    console.log(`${method} ${url} ${statusCode} ${duration}ms - ${ip}`);
  });

  next();
};

// CORS configuration
export const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:5173",
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
