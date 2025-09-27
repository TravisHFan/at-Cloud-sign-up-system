import { Request, Response, NextFunction } from "express";
import RateLimiterService from "../services/RateLimiterService";
import { PublicAbuseMetricsService } from "../services/PublicAbuseMetricsService";
import { createLogger } from "../services/LoggerService";
import {
  registrationAttemptCounter,
  registrationFailureCounter,
  shortLinkCreateAttemptCounter,
  shortLinkCreateFailureCounter,
} from "../services/PrometheusMetricsService";
import { hashEmail, truncateIpToCidr } from "../utils/privacy";

interface LimitConfig {
  windowMs: number;
  limit: number;
}

// Helper functions to evaluate limits at runtime (needed for tests that mutate env mid-process)
function regPerIp(): LimitConfig {
  return {
    windowMs: 10 * 60 * 1000,
    limit: Number(process.env.PUBLIC_REG_LIMIT_PER_IP || 40),
  };
}
function regPerEmail(): LimitConfig {
  return {
    windowMs: 10 * 60 * 1000,
    limit: Number(process.env.PUBLIC_REG_LIMIT_PER_EMAIL || 8),
  };
}
function shortLinkPerUser(): LimitConfig {
  return {
    windowMs: 60 * 60 * 1000,
    limit: Number(process.env.SHORTLINK_CREATE_LIMIT_PER_USER || 25),
  };
}
function shortLinkPerIp(): LimitConfig {
  return {
    windowMs: 60 * 60 * 1000,
    limit: Number(process.env.SHORTLINK_CREATE_LIMIT_PER_IP || 60),
  };
}

function normalizeEmail(raw?: string): string | null {
  if (!raw) return null;
  return raw.trim().toLowerCase();
}

export function publicRegistrationRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.TEST_DISABLE_PUBLIC_RL === "true"
  ) {
    return next();
  }
  const ip =
    (req.ip as string) || (req.socket as any)?.remoteAddress || "unknown";
  const ipCidr = truncateIpToCidr(ip) || "unknown";
  PublicAbuseMetricsService.increment("registration_attempt");
  try {
    registrationAttemptCounter.inc();
  } catch {}
  const email = normalizeEmail(req.body?.attendee?.email);

  // IP key
  const ipKey = `pubreg:ip:${ip}`;
  const ipCfg = regPerIp();
  const ipResult = RateLimiterService.consume({
    key: ipKey,
    windowMs: ipCfg.windowMs,
    limit: ipCfg.limit,
  });
  if (!ipResult.allowed) {
    PublicAbuseMetricsService.increment("registration_block_rate_limit");
    try {
      registrationFailureCounter.inc({ reason: "rate_limit_ip" });
    } catch {}
    createLogger("PublicRateLimit").warn(
      "Registration rate limit breach",
      undefined,
      {
        scope: "registration",
        limitType: "ip",
        ipCidr,
        key: ipKey,
        windowMs: ipCfg.windowMs,
        limit: ipCfg.limit,
        retryAfterSeconds: ipResult.retryAfterSeconds,
        endpoint: "public_registration",
      }
    );
    return res.status(429).json({
      success: false,
      message: "Too many registration attempts from this IP. Please try later.",
      retryAfterSeconds: ipResult.retryAfterSeconds,
      code: "RATE_LIMIT_IP",
    });
  }

  if (email) {
    const emailKey = `pubreg:email:${email}`;
    const emailCfg = regPerEmail();
    const emailResult = RateLimiterService.consume({
      key: emailKey,
      windowMs: emailCfg.windowMs,
      limit: emailCfg.limit,
    });
    if (!emailResult.allowed) {
      PublicAbuseMetricsService.increment("registration_block_rate_limit");
      try {
        registrationFailureCounter.inc({ reason: "rate_limit_email" });
      } catch {}
      createLogger("PublicRateLimit").warn(
        "Registration rate limit breach",
        undefined,
        {
          scope: "registration",
          limitType: "email",
          ipCidr,
          emailHash: email ? hashEmail(email) : null,
          key: emailKey,
          windowMs: emailCfg.windowMs,
          limit: emailCfg.limit,
          retryAfterSeconds: emailResult.retryAfterSeconds,
          endpoint: "public_registration",
        }
      );
      return res.status(429).json({
        success: false,
        message: "Too many attempts for this email. Please try later.",
        retryAfterSeconds: emailResult.retryAfterSeconds,
        code: "RATE_LIMIT_EMAIL",
      });
    }
  }
  next();
}

export function shortLinkCreationRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.TEST_DISABLE_PUBLIC_RL === "true"
  ) {
    return next();
  }
  const ip =
    (req.ip as string) || (req.socket as any)?.remoteAddress || "unknown";
  const ipCidr = truncateIpToCidr(ip) || "unknown";
  PublicAbuseMetricsService.increment("shortlink_create_attempt");
  try {
    shortLinkCreateAttemptCounter.inc();
  } catch {}
  const userId = (req as any).user?._id || (req as any).userId || "anon";

  const userKey = `slcreate:user:${userId}`;
  const userCfg = shortLinkPerUser();
  const userResult = RateLimiterService.consume({
    key: userKey,
    windowMs: userCfg.windowMs,
    limit: userCfg.limit,
  });
  if (!userResult.allowed) {
    PublicAbuseMetricsService.increment("shortlink_create_block_rate_limit");
    try {
      shortLinkCreateFailureCounter.inc({ reason: "rate_limit_user" });
    } catch {}
    createLogger("PublicRateLimit").warn(
      "Short link create rate limit breach",
      undefined,
      {
        scope: "shortlink_create",
        limitType: "user",
        ipCidr,
        userId,
        key: userKey,
        windowMs: userCfg.windowMs,
        limit: userCfg.limit,
        retryAfterSeconds: userResult.retryAfterSeconds,
        endpoint: "shortlink_create",
      }
    );
    return res.status(429).json({
      success: false,
      message: "Short link creation rate limit exceeded (user).",
      retryAfterSeconds: userResult.retryAfterSeconds,
      code: "RATE_LIMIT_USER",
    });
  }

  const ipKey = `slcreate:ip:${ip}`;
  const ipCfg2 = shortLinkPerIp();
  const ipResult = RateLimiterService.consume({
    key: ipKey,
    windowMs: ipCfg2.windowMs,
    limit: ipCfg2.limit,
  });
  if (!ipResult.allowed) {
    PublicAbuseMetricsService.increment("shortlink_create_block_rate_limit");
    try {
      shortLinkCreateFailureCounter.inc({ reason: "rate_limit_ip" });
    } catch {}
    createLogger("PublicRateLimit").warn(
      "Short link create rate limit breach",
      undefined,
      {
        scope: "shortlink_create",
        limitType: "ip",
        ipCidr,
        userId,
        key: ipKey,
        windowMs: ipCfg2.windowMs,
        limit: ipCfg2.limit,
        retryAfterSeconds: ipResult.retryAfterSeconds,
        endpoint: "shortlink_create",
      }
    );
    return res.status(429).json({
      success: false,
      message: "Short link creation rate limit exceeded (IP).",
      retryAfterSeconds: ipResult.retryAfterSeconds,
      code: "RATE_LIMIT_IP",
    });
  }
  next();
}

export default { publicRegistrationRateLimit, shortLinkCreationRateLimit };
