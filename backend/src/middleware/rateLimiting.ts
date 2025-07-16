import rateLimit from "express-rate-limit";

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 200 to 1000 for development (React StrictMode causes double requests)
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Very generous for development - Limit each IP to 1000 login attempts per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Moderate rate limiting for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 search requests per minute
  message: {
    error: "Too many search requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for file upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 uploads per 5 minutes
  message: {
    error: "Too many file uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Analytics rate limiting (more restrictive)
export const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Increased from 20 to 100 for development (React StrictMode causes double requests)
  message: {
    error: "Too many analytics requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate rate limiting for profile endpoints
export const profileLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow 100 profile requests per minute (generous for page refreshes)
  message: {
    error: "Too many profile requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export rate limiting (very restrictive)
export const exportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 export requests per 10 minutes
  message: {
    error: "Export rate limit exceeded, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// System messages rate limiting (generous for frequent polling)
export const systemMessagesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Allow 500 system message requests per 15 minutes (generous for polling)
  message: {
    error: "Too many system message requests, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests to prevent abuse
});
