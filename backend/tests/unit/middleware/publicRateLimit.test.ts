/**
 * publicRateLimit Middleware Unit Tests
 *
 * Tests for the rate limiting middleware for public registration and short link creation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Type-safe mock helpers
const asReq = (obj: Record<string, unknown>) => obj as unknown as Request;
const asRes = (obj: Record<string, unknown>) => obj as unknown as Response;
const asNext = (fn: ReturnType<typeof vi.fn>) => fn as unknown as NextFunction;

// Mock dependencies before importing the module
vi.mock("../../../src/services/RateLimiterService", () => ({
  default: {
    consume: vi.fn(),
  },
}));

vi.mock("../../../src/services/PublicAbuseMetricsService", () => ({
  PublicAbuseMetricsService: {
    increment: vi.fn(),
  },
}));

vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../src/services/PrometheusMetricsService", () => ({
  registrationAttemptCounter: { inc: vi.fn() },
  registrationFailureCounter: { inc: vi.fn() },
  shortLinkCreateAttemptCounter: { inc: vi.fn() },
  shortLinkCreateFailureCounter: { inc: vi.fn() },
}));

vi.mock("../../../src/utils/privacy", () => ({
  hashEmail: vi.fn((email: string) => `hashed_${email}`),
  truncateIpToCidr: vi.fn((ip: string) => (ip ? `${ip}/24` : null)),
}));

import {
  publicRegistrationRateLimit,
  shortLinkCreationRateLimit,
} from "../../../src/middleware/publicRateLimit";
import RateLimiterService from "../../../src/services/RateLimiterService";
import { PublicAbuseMetricsService } from "../../../src/services/PublicAbuseMetricsService";
import {
  registrationAttemptCounter,
  registrationFailureCounter,
  shortLinkCreateAttemptCounter,
  shortLinkCreateFailureCounter,
} from "../../../src/services/PrometheusMetricsService";

describe("publicRateLimit Middleware", () => {
  let mockReq: Record<string, unknown>;
  let mockRes: Record<string, unknown>;
  let mockNext: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset env variables
    delete process.env.TEST_DISABLE_PUBLIC_RL;
    process.env.NODE_ENV = "test";

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();

    mockReq = {
      ip: "192.168.1.100",
      body: {},
      socket: { remoteAddress: "192.168.1.100" },
    };
  });

  afterEach(() => {
    delete process.env.TEST_DISABLE_PUBLIC_RL;
  });

  describe("publicRegistrationRateLimit", () => {
    it("should bypass rate limiting when TEST_DISABLE_PUBLIC_RL is true", () => {
      process.env.TEST_DISABLE_PUBLIC_RL = "true";

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(RateLimiterService.consume).not.toHaveBeenCalled();
    });

    it("should allow request when rate limit is not exceeded", () => {
      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
        retryAfterSeconds: undefined,
      });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(PublicAbuseMetricsService.increment).toHaveBeenCalledWith(
        "registration_attempt"
      );
      expect(registrationAttemptCounter.inc).toHaveBeenCalled();
    });

    it("should block request and return 429 when IP rate limit is exceeded", () => {
      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: false,
        remaining: 0,
        limit: 20,
        retryAfterSeconds: 300,
      });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message:
          "Too many registration attempts from this IP. Please try later.",
        retryAfterSeconds: 300,
        code: "RATE_LIMIT_IP",
      });
      expect(PublicAbuseMetricsService.increment).toHaveBeenCalledWith(
        "registration_block_rate_limit"
      );
      expect(registrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "rate_limit_ip",
      });
    });

    it("should check email rate limit when email is provided", () => {
      mockReq.body = { attendee: { email: "test@example.com" } };

      // First call for IP, second call for email - both allowed
      vi.mocked(RateLimiterService.consume)
        .mockReturnValueOnce({ allowed: true, remaining: 10, limit: 20 })
        .mockReturnValueOnce({ allowed: true, remaining: 5, limit: 10 });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(RateLimiterService.consume).toHaveBeenCalledTimes(2);
    });

    it("should block when email rate limit is exceeded", () => {
      mockReq.body = { attendee: { email: "test@example.com" } };

      // IP allowed, email blocked
      vi.mocked(RateLimiterService.consume)
        .mockReturnValueOnce({ allowed: true, remaining: 10, limit: 20 })
        .mockReturnValueOnce({
          allowed: false,
          remaining: 0,
          limit: 10,
          retryAfterSeconds: 600,
        });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Too many attempts for this email. Please try later.",
        retryAfterSeconds: 600,
        code: "RATE_LIMIT_EMAIL",
      });
      expect(registrationFailureCounter.inc).toHaveBeenCalledWith({
        reason: "rate_limit_email",
      });
    });

    it("should use socket.remoteAddress when req.ip is not available", () => {
      mockReq.ip = undefined;
      mockReq.socket = { remoteAddress: "10.0.0.1" };

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "pubreg:ip:10.0.0.1",
        })
      );
    });

    it("should normalize email to lowercase", () => {
      mockReq.body = { attendee: { email: "  Test@Example.COM  " } };

      vi.mocked(RateLimiterService.consume)
        .mockReturnValueOnce({ allowed: true, remaining: 10, limit: 20 })
        .mockReturnValueOnce({ allowed: true, remaining: 5, limit: 10 });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "pubreg:email:test@example.com",
        })
      );
    });

    it("should handle missing email gracefully", () => {
      mockReq.body = { attendee: {} };

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      // Only IP check should be called
      expect(RateLimiterService.consume).toHaveBeenCalledTimes(1);
    });
  });

  describe("shortLinkCreationRateLimit", () => {
    it("should bypass rate limiting when TEST_DISABLE_PUBLIC_RL is true", () => {
      process.env.TEST_DISABLE_PUBLIC_RL = "true";

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(RateLimiterService.consume).not.toHaveBeenCalled();
    });

    it("should allow request when rate limit is not exceeded", () => {
      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(PublicAbuseMetricsService.increment).toHaveBeenCalledWith(
        "shortlink_create_attempt"
      );
      expect(shortLinkCreateAttemptCounter.inc).toHaveBeenCalled();
    });

    it("should block request when user rate limit is exceeded", () => {
      mockReq.user = { _id: "user123" };

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: false,
        remaining: 0,
        limit: 20,
        retryAfterSeconds: 600,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Short link creation rate limit exceeded (user).",
        retryAfterSeconds: 600,
        code: "RATE_LIMIT_USER",
      });
      expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
        reason: "rate_limit_user",
      });
    });

    it("should block request when IP rate limit is exceeded", () => {
      // User limit passes, IP limit fails
      vi.mocked(RateLimiterService.consume)
        .mockReturnValueOnce({ allowed: true, remaining: 10, limit: 20 })
        .mockReturnValueOnce({
          allowed: false,
          remaining: 0,
          limit: 100,
          retryAfterSeconds: 3600,
        });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Short link creation rate limit exceeded (IP).",
        retryAfterSeconds: 3600,
        code: "RATE_LIMIT_IP",
      });
      expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
        reason: "rate_limit_ip",
      });
    });

    it("should use userId from request if available", () => {
      mockReq.userId = "directUserId123";

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "slcreate:user:directUserId123",
        })
      );
    });

    it("should use 'anon' as userId when not authenticated", () => {
      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "slcreate:user:anon",
        })
      );
    });

    it("should check both user and IP rate limits", () => {
      vi.mocked(RateLimiterService.consume)
        .mockReturnValueOnce({ allowed: true, remaining: 10, limit: 20 })
        .mockReturnValueOnce({ allowed: true, remaining: 20, limit: 100 });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(RateLimiterService.consume).toHaveBeenCalledTimes(2);
    });

    it("should handle user._id from request", () => {
      mockReq.user = { _id: "user_id_from_auth" };

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "slcreate:user:user_id_from_auth",
        })
      );
    });
  });

  describe("edge cases", () => {
    it("should handle unknown IP gracefully", () => {
      mockReq.ip = undefined;
      mockReq.socket = {};

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      publicRegistrationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "pubreg:ip:unknown",
        })
      );
    });

    it("should handle unknown IP gracefully for shortlink creation", () => {
      mockReq.ip = undefined;
      mockReq.socket = {};

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining("slcreate"),
        })
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("should use socket.remoteAddress for shortlink when req.ip is undefined", () => {
      mockReq.ip = undefined;
      mockReq.socket = { remoteAddress: "172.16.0.1" };

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      shortLinkCreationRateLimit(
        asReq(mockReq),
        asRes(mockRes),
        mockNext
      );

      expect(RateLimiterService.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "slcreate:ip:172.16.0.1",
        })
      );
    });

    it("should handle Prometheus counter errors gracefully", () => {
      vi.mocked(registrationAttemptCounter.inc).mockImplementation(() => {
        throw new Error("Prometheus error");
      });

      vi.mocked(RateLimiterService.consume).mockReturnValue({
        allowed: true,
        remaining: 10,
        limit: 20,
      });

      // Should not throw
      expect(() => {
        publicRegistrationRateLimit(
          asReq(mockReq),
          asRes(mockRes),
          mockNext
        );
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
