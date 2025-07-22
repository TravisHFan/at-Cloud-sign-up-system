import rateLimit from "express-rate-limit";

// Check if we're in development environment
const isDevelopment = process.env.NODE_ENV === "development";

// Skip rate limiting for localhost in development
const skipForLocalhost = (req: any) => {
  if (isDevelopment) {
    const isLocalhost =
      req.ip === "127.0.0.1" ||
      req.ip === "::1" ||
      req.ip === "::ffff:127.0.0.1" ||
      req.connection.remoteAddress === "127.0.0.1";
    if (isLocalhost) {
      console.log(
        `[DEV] Rate limiting BYPASSED for localhost: ${req.ip} - ${req.method} ${req.path}`
      );
      return true;
    }
  }
  return false;
};

// Development mode: much more generous limits
// Production mode: strict limits for security

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 1000, // 10,000 requests in dev, 1,000 in prod
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: skipForLocalhost, // Skip rate limiting for localhost in development
});

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 5000 : 1000, // Very generous for development
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: skipForLocalhost, // Skip rate limiting for localhost in development
});

// Moderate rate limiting for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 300 : 30, // 300 in dev, 30 in prod
  message: {
    error: "Too many search requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForLocalhost,
});

// Strict rate limiting for file upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 100 : 10, // 100 in dev, 10 in prod
  message: {
    error: "Too many file uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForLocalhost,
});

// Analytics rate limiting (more restrictive)
export const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 1000 : 100, // 1000 in dev, 100 in prod
  message: {
    error: "Too many analytics requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForLocalhost,
});

// Moderate rate limiting for profile endpoints
export const profileLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 1000 : 100, // 1000 in dev, 100 in prod
  message: {
    error: "Too many profile requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForLocalhost,
});

// Export rate limiting (very restrictive)
export const exportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDevelopment ? 30 : 3, // 30 in dev, 3 in prod
  message: {
    error: "Export rate limit exceeded, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForLocalhost,
});

// System messages rate limiting (generous for frequent polling)
export const systemMessagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 5000 : 500, // 5000 in dev, 500 in prod
  message: {
    error: "Too many system message requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests to prevent abuse
  skip: skipForLocalhost,
});
