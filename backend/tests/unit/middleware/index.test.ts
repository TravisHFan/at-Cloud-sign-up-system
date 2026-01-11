/**
 * Middleware Index Unit Tests
 *
 * Tests middleware exports and utility functions from middleware/index.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";

// Mock express-rate-limit before importing
vi.mock("express-rate-limit", () => ({
  default: vi.fn((options) => {
    // Return a mock middleware that stores the options for inspection
    const middleware = (req: any, res: any, next: any) => next();
    (middleware as any).options = options;
    return middleware;
  }),
}));

describe("middleware/index", () => {
  let createRateLimit: typeof import("../../../src/middleware/index").createRateLimit;
  let authRateLimit: typeof import("../../../src/middleware/index").authRateLimit;
  let generalRateLimit: typeof import("../../../src/middleware/index").generalRateLimit;
  let uploadRateLimit: typeof import("../../../src/middleware/index").uploadRateLimit;
  let notFound: typeof import("../../../src/middleware/index").notFound;
  let requestLogger: typeof import("../../../src/middleware/index").requestLogger;
  let errorHandler: typeof import("../../../src/middleware/index").errorHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("../../../src/middleware/index");
    createRateLimit = module.createRateLimit;
    authRateLimit = module.authRateLimit;
    generalRateLimit = module.generalRateLimit;
    uploadRateLimit = module.uploadRateLimit;
    notFound = module.notFound;
    requestLogger = module.requestLogger;
    errorHandler = module.errorHandler;
  });

  describe("createRateLimit", () => {
    it("should create a rate limit middleware with default message", () => {
      const middleware = createRateLimit(60000, 10);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
      const options = (middleware as any).options;
      expect(options.windowMs).toBe(60000);
      expect(options.max).toBe(10);
      expect(options.message).toEqual({
        success: false,
        message: "Too many requests, please try again later.",
      });
    });

    it("should create a rate limit middleware with custom message", () => {
      const middleware = createRateLimit(30000, 5, "Custom limit message");
      const options = (middleware as any).options;
      expect(options.windowMs).toBe(30000);
      expect(options.max).toBe(5);
      expect(options.message).toBe("Custom limit message");
    });

    it("should configure standardHeaders and legacyHeaders", () => {
      const middleware = createRateLimit(1000, 1);
      const options = (middleware as any).options;
      expect(options.standardHeaders).toBe(true);
      expect(options.legacyHeaders).toBe(false);
    });

    it("should have a custom handler that returns 429", () => {
      const middleware = createRateLimit(60000, 10);
      const options = (middleware as any).options;
      expect(options.handler).toBeDefined();

      const mockReq = {} as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      options.handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: 60, // 60000 / 1000
      });
    });
  });

  describe("pre-configured rate limits", () => {
    it("should export authRateLimit configured for 10 requests per 15 minutes", () => {
      expect(authRateLimit).toBeDefined();
      const options = (authRateLimit as any).options;
      expect(options.windowMs).toBe(15 * 60 * 1000);
      expect(options.max).toBe(10);
    });

    it("should export generalRateLimit configured for 100 requests per 15 minutes", () => {
      expect(generalRateLimit).toBeDefined();
      const options = (generalRateLimit as any).options;
      expect(options.windowMs).toBe(15 * 60 * 1000);
      expect(options.max).toBe(100);
    });

    it("should export uploadRateLimit configured for 20 uploads per hour", () => {
      expect(uploadRateLimit).toBeDefined();
      const options = (uploadRateLimit as any).options;
      expect(options.windowMs).toBe(60 * 60 * 1000);
      expect(options.max).toBe(20);
    });
  });

  describe("notFound middleware", () => {
    it("should return 404 with route not found message", () => {
      const mockReq = {
        originalUrl: "/api/nonexistent",
      } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      notFound(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Route /api/nonexistent not found",
      });
    });

    it("should include the original URL in the error message", () => {
      const mockReq = {
        originalUrl: "/some/other/path",
      } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      notFound(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Route /some/other/path not found",
      });
    });
  });

  describe("requestLogger middleware", () => {
    it("should call next() to continue the middleware chain", () => {
      const mockReq = {} as Request;
      const mockRes = {
        on: vi.fn(),
      } as unknown as Response;
      const mockNext = vi.fn() as unknown as NextFunction;

      requestLogger(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should register a finish event listener on the response", () => {
      const mockReq = {} as Request;
      const mockRes = {
        on: vi.fn(),
      } as unknown as Response;
      const mockNext = vi.fn() as unknown as NextFunction;

      requestLogger(mockReq, mockRes, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("should not throw when finish event fires", () => {
      const mockReq = {} as Request;
      let finishCallback: () => void = () => {};
      const mockRes = {
        on: vi.fn((event, callback) => {
          if (event === "finish") {
            finishCallback = callback;
          }
        }),
      } as unknown as Response;
      const mockNext = vi.fn() as unknown as NextFunction;

      requestLogger(mockReq, mockRes, mockNext);

      // Simulate finish event - should not throw
      expect(() => finishCallback()).not.toThrow();
    });
  });

  describe("errorHandler export", () => {
    it("should export the errorHandler function", () => {
      expect(errorHandler).toBeDefined();
      expect(typeof errorHandler).toBe("function");
    });
  });

  describe("imageCompression exports", () => {
    it("should export compressUploadedImage", async () => {
      const { compressUploadedImage } = await import(
        "../../../src/middleware/index"
      );
      expect(compressUploadedImage).toBeDefined();
    });

    it("should export logCompressionStats", async () => {
      const { logCompressionStats } = await import(
        "../../../src/middleware/index"
      );
      expect(logCompressionStats).toBeDefined();
    });

    it("should export includeCompressionInfo", async () => {
      const { includeCompressionInfo } = await import(
        "../../../src/middleware/index"
      );
      expect(includeCompressionInfo).toBeDefined();
    });
  });
});
