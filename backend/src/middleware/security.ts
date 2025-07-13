import helmet from "helmet";
import { Request, Response, NextFunction } from "express";

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow file uploads
});

// CORS configuration
export const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:3000", // Development fallback
      "http://localhost:5174", // Vite preview
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
};

// XSS Protection middleware
export const xssProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Basic XSS protection for request body
  if (req.body) {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === "string") {
        return obj.replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
      }
      if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
};

// Request size limitation
export const requestSizeLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = parseInt(req.get("content-length") || "0");
  const maxSize = 10 * 1024 * 1024; // 10MB limit

  if (contentLength > maxSize) {
    res.status(413).json({
      success: false,
      message: "Request entity too large",
    });
    return;
  }

  next();
};

// IP-based security middleware
export const ipSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientIp = req.ip || req.connection.remoteAddress || "unknown";

  // Block suspicious patterns (basic implementation)
  const suspiciousPatterns = [
    /^10\.0\.0\./, // Example: block certain internal IPs if needed
    // Add more patterns as needed
  ];

  // In production, you might want to implement a more sophisticated
  // IP reputation system here

  req.clientIp = clientIp;
  next();
};

// Error handling middleware for security
export const securityErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log security-related errors
  if (err.message.includes("CORS") || err.message.includes("rate limit")) {
    console.warn(`Security warning: ${err.message} from IP: ${req.ip}`);
  }

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(isDevelopment && { error: err.message }),
  });
};

// Declare additional Express Request properties
declare global {
  namespace Express {
    interface Request {
      clientIp?: string;
    }
  }
}
