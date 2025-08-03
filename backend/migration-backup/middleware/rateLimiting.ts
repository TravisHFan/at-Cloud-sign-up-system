import rateLimit from "express-rate-limit";

// Check if we're in development environment
const isDevelopment = process.env.NODE_ENV === "development";

// Check if rate limiting is emergency disabled
const isEmergencyDisabled = () => {
  return process.env.ENABLE_RATE_LIMITING === "false";
};

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

// Combined skip function that checks both localhost and emergency disable
const skipRateLimit = (req: any) => {
  if (isEmergencyDisabled()) {
    console.log(
      `[EMERGENCY] Rate limiting DISABLED: ${req.ip} - ${req.method} ${req.path}`
    );
    return true;
  }
  return skipForLocalhost(req);
};

// Development mode: much more generous limits
// Production mode: strict limits for security

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 2000, // 10,000 requests in dev, 2,000 in prod
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: skipRateLimit, // Skip rate limiting for localhost in development and emergency disable
});

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 5000 : 2000, // Very generous for development
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: skipRateLimit, // Skip rate limiting for localhost in development and emergency disable
});

// Moderate rate limiting for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 300 : 60, // 300 in dev, 60 in prod
  message: {
    error: "Too many search requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

// Strict rate limiting for file upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 100 : 20, // 100 in dev, 20 in prod
  message: {
    error: "Too many file uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

// Analytics rate limiting (more restrictive)
export const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isDevelopment ? 1000 : 200, // 1000 in dev, 200 in prod
  message: {
    error: "Too many analytics requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

// Moderate rate limiting for profile endpoints
export const profileLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 1000 : 200, // 1000 in dev, 200 in prod
  message: {
    error: "Too many profile requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

// Export rate limiting (very restrictive)
export const exportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDevelopment ? 30 : 15, // 30 in dev, 15 in prod
  message: {
    error: "Export rate limit exceeded, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

// System messages rate limiting (generous for frequent polling)
export const systemMessagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 5000 : 1000, // 5000 in dev, 1000 in prod
  message: {
    error: "Too many system message requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests to prevent abuse
  skip: skipRateLimit,
});
