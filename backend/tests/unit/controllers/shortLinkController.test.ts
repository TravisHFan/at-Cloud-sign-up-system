/**
 * Unit tests for ShortLinkController
 * Testing short link creation and resolution for event sharing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { ShortLinkController } from "../../../src/controllers/shortLinkController";

// Mock dependencies
vi.mock("../../../src/services/ShortLinkService", () => ({
  default: {
    getOrCreateForEvent: vi.fn(),
    resolveKey: vi.fn(),
  },
}));

vi.mock("../../../src/services/ShortLinkMetricsService", () => ({
  ShortLinkMetricsService: {
    increment: vi.fn(),
  },
}));

vi.mock("../../../src/services/PrometheusMetricsService", () => ({
  shortLinkCreatedCounter: {
    inc: vi.fn(),
  },
  shortLinkResolveCounter: {
    inc: vi.fn(),
  },
  shortLinkResolveDuration: {
    startTimer: vi.fn(() => vi.fn()),
  },
  shortLinkCreateFailureCounter: {
    inc: vi.fn(),
  },
}));

vi.mock("../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

import ShortLinkService from "../../../src/services/ShortLinkService";
import { ShortLinkMetricsService } from "../../../src/services/ShortLinkMetricsService";
import {
  shortLinkCreatedCounter,
  shortLinkResolveCounter,
  shortLinkResolveDuration,
  shortLinkCreateFailureCounter,
} from "../../../src/services/PrometheusMetricsService";

describe("ShortLinkController", () => {
  let mockReq: Partial<Request> & { user?: any };
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
      params: {},
      user: undefined,
      get: vi.fn() as any,
      secure: false,
    } as any;

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Reset environment variables
    delete process.env.PUBLIC_SHORT_BASE_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.NODE_ENV;
  });

  describe("create", () => {
    describe("validation", () => {
      it("should return 400 if eventId is missing", async () => {
        mockReq.body = {};

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "eventId is required",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "validation",
        });
      });

      it("should return 400 if eventId is not a string", async () => {
        mockReq.body = { eventId: 123 };

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "eventId is required",
        });
      });
    });

    describe("authenticated user", () => {
      it("should create short link for authenticated user", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;
        (mockReq.get as any).mockReturnValue("localhost:5001");

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(ShortLinkService.getOrCreateForEvent).toHaveBeenCalledWith(
          "event123",
          "user123",
          undefined,
        );
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          created: true,
          data: expect.objectContaining({
            key: "abc123",
            eventId: "event123",
            slug: "test-event",
          }),
        });
        expect(shortLinkCreatedCounter.inc).toHaveBeenCalled();
        expect(ShortLinkMetricsService.increment).toHaveBeenCalledWith(
          "created",
        );
      });

      it("should use _id if id is not available", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { _id: "user456" } as any;
        (mockReq.get as any).mockReturnValue("localhost:5001");

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: false,
          shortLink: {
            key: "existing",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(ShortLinkService.getOrCreateForEvent).toHaveBeenCalledWith(
          "event123",
          "user456",
          undefined,
        );
      });
    });

    describe("anonymous user", () => {
      it("should create short link with sentinel user ID for anonymous", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = undefined;
        (mockReq.get as any).mockReturnValue("localhost:5001");

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "xyz789",
            eventId: "event123",
            targetSlug: "public-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(ShortLinkService.getOrCreateForEvent).toHaveBeenCalledWith(
          "event123",
          "000000000000000000000000", // Sentinel ObjectId
          undefined,
        );
        expect(statusMock).toHaveBeenCalledWith(201);
      });
    });

    describe("custom key", () => {
      it("should pass custom key to service", async () => {
        mockReq.body = { eventId: "event123", customKey: "my-event" };
        mockReq.user = { id: "user123" } as any;
        (mockReq.get as any).mockReturnValue("localhost:5001");

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "my-event",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(ShortLinkService.getOrCreateForEvent).toHaveBeenCalledWith(
          "event123",
          "user123",
          "my-event",
        );
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              key: "my-event",
            }),
          }),
        );
      });
    });

    describe("existing link", () => {
      it("should return 200 for existing active link", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;
        (mockReq.get as any).mockReturnValue("localhost:5001");

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: false,
          shortLink: {
            key: "existing",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          created: false,
          data: expect.objectContaining({
            key: "existing",
          }),
        });
        expect(shortLinkCreatedCounter.inc).not.toHaveBeenCalled();
        expect(ShortLinkMetricsService.increment).not.toHaveBeenCalled();
      });
    });

    describe("URL generation", () => {
      it("should use PUBLIC_SHORT_BASE_URL when set", async () => {
        process.env.PUBLIC_SHORT_BASE_URL = "https://short.example.com";
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              url: "https://short.example.com/s/abc123",
            }),
          }),
        );
      });

      it("should strip trailing slash from PUBLIC_SHORT_BASE_URL", async () => {
        process.env.PUBLIC_SHORT_BASE_URL = "https://short.example.com/";
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              url: "https://short.example.com/s/abc123",
            }),
          }),
        );
      });

      it("should use FRONTEND_URL in development", async () => {
        process.env.FRONTEND_URL = "http://localhost:5173";
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;
        (mockReq.get as any).mockReturnValue("localhost:5001");

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              url: "http://localhost:5173/s/abc123",
            }),
          }),
        );
      });

      it("should auto-detect from request in development without FRONTEND_URL", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;
        (mockReq.get as any)
          .mockReturnValueOnce(undefined) // x-forwarded-proto
          .mockReturnValueOnce("localhost:5001"); // host

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              url: "http://localhost:5173/s/abc123",
            }),
          }),
        );
      });

      it("should use https in production with x-forwarded-proto", async () => {
        process.env.NODE_ENV = "production";
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;
        (mockReq.get as any)
          .mockReturnValueOnce("https") // x-forwarded-proto
          .mockReturnValueOnce("example.com"); // host

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              url: "https://example.com/s/abc123",
            }),
          }),
        );
      });

      it("should use secure flag when req.secure is true", async () => {
        process.env.NODE_ENV = "production";
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;
        (mockReq as any).secure = true;
        (mockReq.get as any)
          .mockReturnValueOnce(undefined) // x-forwarded-proto
          .mockReturnValueOnce("example.com"); // host

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockResolvedValue({
          created: true,
          shortLink: {
            key: "abc123",
            eventId: "event123",
            targetSlug: "test-event",
            expiresAt: new Date("2025-12-31"),
          },
        } as any);

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              url: "https://example.com/s/abc123",
            }),
          }),
        );
      });
    });

    describe("error handling", () => {
      it("should return 404 for event not found", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Event not found"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "not_found",
        });
      });

      it("should return 400 for custom key invalid", async () => {
        mockReq.body = { eventId: "event123", customKey: "ab" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Custom key invalid: too short"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          code: "CUSTOM_KEY_INVALID",
          message: "Custom key invalid: too short",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "custom_invalid",
        });
      });

      it("should return 400 for custom key reserved", async () => {
        mockReq.body = { eventId: "event123", customKey: "admin" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Custom key reserved"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          code: "CUSTOM_KEY_RESERVED",
          message: "Custom key reserved",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "custom_reserved",
        });
      });

      it("should return 409 for custom key taken", async () => {
        mockReq.body = { eventId: "event123", customKey: "popular" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Custom key taken"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          code: "CUSTOM_KEY_TAKEN",
          message: "Custom key taken",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "custom_taken",
        });
      });

      it("should return 400 for event not published", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Event not published"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not published",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "validation",
        });
      });

      it("should return 400 for no public roles", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Event has no public roles"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "validation",
        });
      });

      it("should return 400 for invalid eventId", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Invalid eventId format"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "validation",
        });
      });

      it("should return 500 for unexpected errors", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          new Error("Database connection failed"),
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create short link",
        });
        expect(shortLinkCreateFailureCounter.inc).toHaveBeenCalledWith({
          reason: "other",
        });
      });

      it("should use fallback message when error.message is not a string", async () => {
        mockReq.body = { eventId: "event123" };
        mockReq.user = { id: "user123" } as any;

        // Throw an error-like object with non-string message
        const weirdError = { message: 12345 };
        vi.mocked(ShortLinkService.getOrCreateForEvent).mockRejectedValue(
          weirdError,
        );

        await ShortLinkController.create(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to create short link",
        });
      });
    });
  });

  describe("resolve", () => {
    describe("validation", () => {
      it("should return 400 if key is missing", async () => {
        mockReq.params = {};

        await ShortLinkController.resolve(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing key",
        });
      });
    });

    describe("active link", () => {
      it("should resolve active short link successfully", async () => {
        mockReq.params = { key: "abc123" };

        const mockEndTimer = vi.fn();
        vi.mocked(shortLinkResolveDuration.startTimer).mockReturnValue(
          mockEndTimer,
        );

        vi.mocked(ShortLinkService.resolveKey).mockResolvedValue({
          status: "active",
          slug: "test-event",
          eventId: "event123",
        } as any);

        await ShortLinkController.resolve(
          mockReq as Request,
          mockRes as Response,
        );

        expect(ShortLinkService.resolveKey).toHaveBeenCalledWith("abc123");
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            status: "active",
            slug: "test-event",
            eventId: "event123",
          },
        });
        expect(shortLinkResolveCounter.inc).toHaveBeenCalledWith({
          status: "active",
        });
        expect(mockEndTimer).toHaveBeenCalledWith({ status: "active" });
        expect(ShortLinkMetricsService.increment).toHaveBeenCalledWith(
          "resolved_active",
        );
      });
    });

    describe("expired link", () => {
      it("should return 410 for expired short link", async () => {
        mockReq.params = { key: "expired123" };

        const mockEndTimer = vi.fn();
        vi.mocked(shortLinkResolveDuration.startTimer).mockReturnValue(
          mockEndTimer,
        );

        vi.mocked(ShortLinkService.resolveKey).mockResolvedValue({
          status: "expired",
        } as any);

        await ShortLinkController.resolve(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(410);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          status: "expired",
          message: "Short link expired",
        });
        expect(shortLinkResolveCounter.inc).toHaveBeenCalledWith({
          status: "expired",
        });
        expect(mockEndTimer).toHaveBeenCalledWith({ status: "expired" });
        expect(ShortLinkMetricsService.increment).toHaveBeenCalledWith(
          "resolved_expired",
        );
      });
    });

    describe("not found", () => {
      it("should return 404 for non-existent short link", async () => {
        mockReq.params = { key: "notfound" };

        const mockEndTimer = vi.fn();
        vi.mocked(shortLinkResolveDuration.startTimer).mockReturnValue(
          mockEndTimer,
        );

        vi.mocked(ShortLinkService.resolveKey).mockResolvedValue({
          status: "not_found",
        } as any);

        await ShortLinkController.resolve(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          status: "not_found",
          message: "Short link not found",
        });
        expect(shortLinkResolveCounter.inc).toHaveBeenCalledWith({
          status: "not_found",
        });
        expect(mockEndTimer).toHaveBeenCalledWith({ status: "not_found" });
        expect(ShortLinkMetricsService.increment).toHaveBeenCalledWith(
          "resolved_not_found",
        );
      });
    });

    describe("error handling", () => {
      it("should return 500 for service errors", async () => {
        mockReq.params = { key: "error123" };

        vi.mocked(ShortLinkService.resolveKey).mockRejectedValue(
          new Error("Database error"),
        );

        await ShortLinkController.resolve(
          mockReq as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to resolve short link",
        });
      });
    });
  });
});
