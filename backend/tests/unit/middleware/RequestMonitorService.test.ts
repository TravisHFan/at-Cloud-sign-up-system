import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import RequestMonitorService from "../../../src/middleware/RequestMonitorService";

// Mock fs module for file operations
vi.mock("fs", () => ({
  default: {
    appendFileSync: vi.fn(),
  },
}));

// Mock path module
vi.mock("path", () => ({
  default: {
    join: vi.fn().mockReturnValue("/mocked/path/to/file.log"),
  },
}));

/**
 * RequestMonitorService Tests
 *
 * Tests comprehensive request monitoring, alerting, and security features.
 *
 * Coverage Areas:
 * - Singleton pattern implementation
 * - Express middleware functionality
 * - Request tracking and metrics collection
 * - Alert system for suspicious patterns
 * - Memory cleanup and performance optimization
 * - Emergency rate limiting controls
 * - Statistics generation and reporting
 * - IP detection and user agent tracking
 * - Error handling and logging
 */

describe("RequestMonitorService", () => {
  let service: RequestMonitorService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset environment variables
    delete process.env.ENABLE_RATE_LIMITING;

    // Get fresh instance (singleton, but reset internal state for testing)
    service = RequestMonitorService.getInstance();

    // Reset internal state for testing
    (service as any).requestStats = [];
    (service as any).endpointMetrics = new Map();

    // Mock request object
    mockRequest = {
      method: "GET",
      path: "/api/test",
      headers: {
        "user-agent": "Test Agent 1.0",
      },
      connection: {
        remoteAddress: "192.168.1.1",
      } as any,
      get: vi.fn().mockImplementation((header: string) => {
        if (header === "User-Agent") return "Test Agent 1.0";
        return undefined;
      }),
    };

    // Mock response object
    mockResponse = {
      statusCode: 200,
      end: vi.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // Helper function to simulate complete request-response cycle
  const simulateRequest = (req: any, res: any, next: any) => {
    const middleware = service.middleware();
    // Create a fresh response object for each request to avoid function override issues
    const freshRes = {
      ...res,
      end: vi.fn().mockReturnThis(),
    };
    middleware(req, freshRes as any, next);
    // Simulate response completion to trigger endpoint metrics update
    (freshRes.end as any)();
  };

  describe("Singleton Pattern", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = RequestMonitorService.getInstance();
      const instance2 = RequestMonitorService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(RequestMonitorService);
    });

    it("should initialize with default configuration", () => {
      const instance = RequestMonitorService.getInstance();

      expect(instance).toBeDefined();
      expect(typeof instance.middleware).toBe("function");
      expect(typeof instance.getStats).toBe("function");
    });
  });

  describe("Middleware Functionality", () => {
    it("should exist and be a function", () => {
      expect(typeof service.middleware).toBe("function");
    });

    it("should return a middleware function when called", () => {
      const middleware = service.middleware();

      expect(typeof middleware).toBe("function");
      expect(middleware.length).toBe(3); // req, res, next
    });

    it("should successfully process a request through middleware", () => {
      const middleware = service.middleware();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("GET /api/test - IP: 192.168.1.1")
      );
    });

    it("should track request start time correctly", () => {
      const startTime = Date.now();
      const middleware = service.middleware();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Check that request was logged with current timestamp
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
      );
    });

    it("should override res.end to capture response details", () => {
      const middleware = service.middleware();
      const originalEnd = mockResponse.end;

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // res.end should be overridden
      expect(mockResponse.end).not.toBe(originalEnd);
      expect(typeof mockResponse.end).toBe("function");
    });

    it("should track response time and status code when request completes", () => {
      const middleware = service.middleware();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response completion
      const responseEnd = mockResponse.end as any;
      responseEnd();

      // Should log completion with response time
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("GET /api/test - 200 -")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("ms"));
    });

    it("should handle requests with authenticated users", () => {
      const authenticatedRequest = {
        ...mockRequest,
        user: { id: "user123" },
      };

      const middleware = service.middleware();

      middleware(
        authenticatedRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("IP Address Detection", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const requestWithForwardedFor = {
        ...mockRequest,
        headers: {
          "x-forwarded-for": "203.0.113.1",
          "user-agent": "Test Agent 1.0",
        },
      };

      const middleware = service.middleware();

      middleware(
        requestWithForwardedFor as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("IP: 203.0.113.1")
      );
    });

    it("should extract IP from x-real-ip header when x-forwarded-for is not available", () => {
      const requestWithRealIP = {
        ...mockRequest,
        headers: {
          "x-real-ip": "198.51.100.1",
          "user-agent": "Test Agent 1.0",
        },
      };

      const middleware = service.middleware();

      middleware(
        requestWithRealIP as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("IP: 198.51.100.1")
      );
    });

    it("should fall back to connection.remoteAddress", () => {
      const requestWithRemoteAddress = {
        ...mockRequest,
        headers: {
          "user-agent": "Test Agent 1.0",
        },
        connection: {
          remoteAddress: "172.16.0.1",
        } as any,
      };

      const middleware = service.middleware();

      middleware(
        requestWithRemoteAddress as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("IP: 172.16.0.1")
      );
    });

    it("should handle unknown IP when no IP sources are available", () => {
      const requestWithoutIP = {
        ...mockRequest,
        headers: {
          "user-agent": "Test Agent 1.0",
        },
        connection: {} as any,
        socket: {} as any,
      };

      const middleware = service.middleware();

      middleware(
        requestWithoutIP as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("IP: unknown")
      );
    });
  });

  describe("Request Statistics Collection", () => {
    it("should collect basic request statistics", () => {
      simulateRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const stats = service.getStats();

      expect(stats.totalRequestsLastHour).toBe(1);
      expect(stats.totalRequestsLastMinute).toBe(1);
      expect(stats.endpointMetrics).toHaveLength(1);
      expect(stats.endpointMetrics[0].endpoint).toBe("GET /api/test");
    });

    it("should track multiple requests to the same endpoint", () => {
      // Ensure clean state
      (service as any).requestStats = [];
      (service as any).endpointMetrics = new Map();

      // Make 3 requests to the same endpoint
      for (let i = 0; i < 3; i++) {
        simulateRequest(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }

      const stats = service.getStats();

      // Debug: check the actual content
      expect(stats.totalRequestsLastHour).toBe(3);
      expect(stats.endpointMetrics).toHaveLength(1);
      expect(stats.endpointMetrics[0].endpoint).toBe("GET /api/test");
      expect(stats.endpointMetrics[0].count).toBe(3);
    });

    it("should track requests to different endpoints separately", () => {
      // Request to first endpoint
      simulateRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Request to different endpoint
      const secondRequest = {
        ...mockRequest,
        method: "POST",
        path: "/api/users",
      };

      simulateRequest(
        secondRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const stats = service.getStats();

      expect(stats.totalRequestsLastHour).toBe(2);
      expect(stats.endpointMetrics).toHaveLength(2);

      const endpoints = stats.endpointMetrics.map((m) => m.endpoint);
      expect(endpoints).toContain("GET /api/test");
      expect(endpoints).toContain("POST /api/users");
    });

    it("should track unique IPs per endpoint", () => {
      // Request from first IP
      simulateRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Request from different IP
      const secondRequest = {
        ...mockRequest,
        connection: { remoteAddress: "192.168.1.2" } as any,
      };

      simulateRequest(
        secondRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      expect(endpointMetric?.uniqueIPs).toBe(2);
    });

    it("should track unique user agents per endpoint", () => {
      // Request with first user agent
      simulateRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Request with different user agent
      const secondRequest = {
        ...mockRequest,
        headers: { "user-agent": "Different Agent 2.0" },
        get: vi.fn().mockImplementation((header: string) => {
          if (header === "User-Agent") return "Different Agent 2.0";
          return undefined;
        }),
      };

      simulateRequest(
        secondRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      expect(endpointMetric?.uniqueUserAgents).toBe(2);
    });
  });

  describe("Response Time Tracking", () => {
    it("should calculate and track average response time", () => {
      const middleware = service.middleware();

      // Simulate first request
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Advance time and complete request
      vi.advanceTimersByTime(100); // 100ms response time
      (mockResponse.end as any)();

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      expect(endpointMetric?.averageResponseTime).toBe(100);
    });

    it("should update average response time across multiple requests", () => {
      const simulateTimedRequest = (req: any, responseTimeMs: number) => {
        const middleware = service.middleware();
        const timedResponse = {
          ...mockResponse,
          end: vi.fn().mockReturnThis(),
        };

        middleware(req, timedResponse as unknown as Response, mockNext);
        vi.advanceTimersByTime(responseTimeMs);
        (timedResponse.end as any)();
      };

      // First request - 100ms
      simulateTimedRequest(mockRequest, 100);

      // Second request - 200ms
      simulateTimedRequest(mockRequest, 200);

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      // Average should be (100 + 200) / 2 = 150
      expect(endpointMetric?.averageResponseTime).toBe(150);
    });
  });

  describe("Error Tracking", () => {
    it("should count 4xx and 5xx responses as errors", () => {
      const middleware = service.middleware();
      const errorResponse = {
        ...mockResponse,
        statusCode: 500,
        end: vi.fn().mockReturnThis(),
      };

      middleware(
        mockRequest as Request,
        errorResponse as unknown as Response,
        mockNext
      );

      (errorResponse.end as any)();

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      expect(endpointMetric?.errorCount).toBe(1);
    });

    it("should not count 401/403 on auth endpoints as errors", () => {
      const middleware = service.middleware();
      const authRequest = { ...mockRequest, path: "/auth/login" };
      const unauthorizedResponse = {
        ...mockResponse,
        statusCode: 401,
        end: vi.fn().mockReturnThis(),
      };

      middleware(
        authRequest as Request,
        unauthorizedResponse as unknown as Response,
        mockNext
      );

      (unauthorizedResponse.end as any)();

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /auth/login"
      );

      expect(endpointMetric?.errorCount).toBe(0);
    });

    it("should count other 4xx errors on auth endpoints", () => {
      const middleware = service.middleware();
      const authRequest = { ...mockRequest, path: "/auth/register" };
      const badRequestResponse = {
        ...mockResponse,
        statusCode: 400,
        end: vi.fn().mockReturnThis(),
      };

      middleware(
        authRequest as Request,
        badRequestResponse as unknown as Response,
        mockNext
      );

      (badRequestResponse.end as any)();

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /auth/register"
      );

      expect(endpointMetric?.errorCount).toBe(1);
    });
  });

  describe("Memory Cleanup", () => {
    it("should automatically clean up old request stats", () => {
      // Add requests to the service
      const middleware = service.middleware();

      for (let i = 0; i < 5; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Verify requests are recorded
      expect((service as any).requestStats.length).toBe(5);

      // Advance time by more than 1 hour (cleanup threshold)
      vi.advanceTimersByTime(61 * 60 * 1000);

      // Trigger cleanup (which happens automatically via setInterval)
      (service as any).cleanupOldStats();

      // Old stats should be cleaned up
      expect((service as any).requestStats.length).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up 5 old request stats")
      );
    });

    it("should not clean up recent request stats", () => {
      const middleware = service.middleware();

      // Add recent requests
      for (let i = 0; i < 3; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Verify requests are recorded
      expect((service as any).requestStats.length).toBe(3);

      // Advance time by less than 1 hour
      vi.advanceTimersByTime(30 * 60 * 1000);

      // Trigger cleanup
      (service as any).cleanupOldStats();

      // Recent stats should remain
      expect((service as any).requestStats.length).toBe(3);
    });
  });

  describe("Alert System", () => {
    beforeEach(() => {
      // Reset alert thresholds for testing
      (service as any).alertThresholds = {
        requestsPerMinute: 5,
        requestsPerSecond: 3,
        duplicateRequestsFromSameIP: 4,
        suspiciousUserAgent: 3,
      };
    });

    it("should detect high request rate per minute", () => {
      const middleware = service.middleware();

      // Generate requests exceeding the threshold
      for (let i = 0; i < 6; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Trigger alert check
      (service as any).checkForAlerts();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("🚨 ALERT:")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("HIGH_REQUEST_RATE")
      );
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it("should detect very high request rate per second", () => {
      const middleware = service.middleware();

      // Generate requests exceeding the per-second threshold
      for (let i = 0; i < 4; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Trigger alert check
      (service as any).checkForAlerts();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("VERY_HIGH_REQUEST_RATE")
      );
    });

    it("should detect suspicious IP activity", () => {
      const middleware = service.middleware();

      // Generate requests from same IP exceeding threshold
      for (let i = 0; i < 5; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Trigger alert check
      (service as any).checkForAlerts();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("SUSPICIOUS_IP_ACTIVITY")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("192.168.1.1")
      );
    });

    it("should detect suspicious user agent activity", () => {
      const middleware = service.middleware();

      // Generate requests from same user agent exceeding threshold
      for (let i = 0; i < 4; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Trigger alert check
      (service as any).checkForAlerts();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("SUSPICIOUS_USER_AGENT")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test Agent 1.0")
      );
    });

    it("should write alerts to file", () => {
      const middleware = service.middleware();

      // Generate requests to trigger alert
      for (let i = 0; i < 6; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      (service as any).checkForAlerts();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/mocked/path/to/file.log",
        expect.stringContaining("HIGH_REQUEST_RATE")
      );
    });
  });

  describe("Emergency Rate Limiting Controls", () => {
    it("should emergency disable rate limiting", () => {
      service.emergencyDisableRateLimit();

      expect(process.env.ENABLE_RATE_LIMITING).toBe("false");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("🚨 EMERGENCY: Rate limiting disabled")
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/mocked/path/to/file.log",
        expect.stringContaining("EMERGENCY: Rate limiting disabled")
      );
    });

    it("should emergency enable rate limiting", () => {
      service.emergencyEnableRateLimit();

      expect(process.env.ENABLE_RATE_LIMITING).toBe("true");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("✅ RECOVERY: Rate limiting re-enabled")
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/mocked/path/to/file.log",
        expect.stringContaining("RECOVERY: Rate limiting re-enabled")
      );
    });

    it("should return correct rate limiting status when enabled", () => {
      process.env.ENABLE_RATE_LIMITING = "true";

      const status = service.getRateLimitingStatus();

      expect(status.enabled).toBe(true);
      expect(status.status).toBe("enabled");
    });

    it("should return correct rate limiting status when disabled", () => {
      process.env.ENABLE_RATE_LIMITING = "false";

      const status = service.getRateLimitingStatus();

      expect(status.enabled).toBe(false);
      expect(status.status).toBe("emergency_disabled");
    });

    it("should default to enabled when environment variable is not set", () => {
      delete process.env.ENABLE_RATE_LIMITING;

      const status = service.getRateLimitingStatus();

      expect(status.enabled).toBe(true);
      expect(status.status).toBe("enabled");
    });
  });

  describe("Statistics Generation", () => {
    it("should generate comprehensive statistics", () => {
      const middleware = service.middleware();

      // Add various requests
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const differentIPRequest = {
        ...mockRequest,
        connection: { remoteAddress: "192.168.1.2" } as any,
      };

      middleware(
        differentIPRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const stats = service.getStats();

      expect(stats).toHaveProperty("totalRequestsLastHour");
      expect(stats).toHaveProperty("totalRequestsLastMinute");
      expect(stats).toHaveProperty("requestsPerSecond");
      expect(stats).toHaveProperty("endpointMetrics");
      expect(stats).toHaveProperty("topIPs");
      expect(stats).toHaveProperty("topUserAgents");
      expect(stats).toHaveProperty("suspiciousPatterns");

      expect(stats.totalRequestsLastHour).toBe(2);
      expect(stats.totalRequestsLastMinute).toBe(2);
      expect(stats.topIPs).toHaveLength(2);
    });

    it("should sort endpoint metrics by request count", () => {
      // Ensure clean state
      (service as any).requestStats = [];
      (service as any).endpointMetrics = new Map();

      // Make more requests to second endpoint
      const endpoint1Request = { ...mockRequest, path: "/api/endpoint1" };
      const endpoint2Request = { ...mockRequest, path: "/api/endpoint2" };

      // 1 request to endpoint1
      simulateRequest(
        endpoint1Request as Request,
        mockResponse as Response,
        mockNext
      );

      // 3 requests to endpoint2
      for (let i = 0; i < 3; i++) {
        simulateRequest(
          endpoint2Request as Request,
          mockResponse as Response,
          mockNext
        );
      }

      const stats = service.getStats();

      // Should be sorted by count (highest first)
      expect(stats.endpointMetrics[0].endpoint).toBe("GET /api/endpoint2");
      expect(stats.endpointMetrics[0].count).toBe(3);
      expect(stats.endpointMetrics[1].endpoint).toBe("GET /api/endpoint1");
      expect(stats.endpointMetrics[1].count).toBe(1);
    });

    it("should detect potential polling loops", () => {
      const middleware = service.middleware();

      // Simulate many requests to same endpoint (potential polling)
      for (let i = 0; i < 105; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      const stats = service.getStats();

      expect(stats.suspiciousPatterns).toHaveLength(1);
      expect(stats.suspiciousPatterns[0].type).toBe("POTENTIAL_POLLING_LOOP");
      expect(stats.suspiciousPatterns[0].severity).toBe("MEDIUM");
    });

    it("should mark high frequency polling as high severity", () => {
      const middleware = service.middleware();

      // Simulate very high request count (high severity threshold)
      for (let i = 0; i < 505; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      const stats = service.getStats();

      expect(stats.suspiciousPatterns[0].severity).toBe("HIGH");
    });
  });

  describe("Top Statistics Generation", () => {
    it("should generate top IPs with correct counts", () => {
      const middleware = service.middleware();

      // Generate requests from different IPs
      const ips = ["192.168.1.1", "192.168.1.2", "192.168.1.3"];
      const requestCounts = [5, 3, 1]; // Different request counts per IP

      ips.forEach((ip, index) => {
        const requestWithIP = {
          ...mockRequest,
          connection: { remoteAddress: ip } as any,
        };

        for (let i = 0; i < requestCounts[index]; i++) {
          middleware(
            requestWithIP as Request,
            mockResponse as Response,
            mockNext
          );
        }
      });

      const stats = service.getStats();

      // Should be sorted by count (highest first)
      expect(stats.topIPs[0]).toEqual({ ip: "192.168.1.1", count: 5 });
      expect(stats.topIPs[1]).toEqual({ ip: "192.168.1.2", count: 3 });
      expect(stats.topIPs[2]).toEqual({ ip: "192.168.1.3", count: 1 });
    });

    it("should generate top user agents with correct counts", () => {
      const middleware = service.middleware();

      const userAgents = [
        "Mozilla/5.0 Chrome",
        "Mozilla/5.0 Firefox",
        "Safari Browser",
      ];
      const requestCounts = [4, 2, 1];

      userAgents.forEach((userAgent, index) => {
        const requestWithUA = {
          ...mockRequest,
          headers: { "user-agent": userAgent },
          get: vi.fn().mockImplementation((header: string) => {
            if (header === "User-Agent") return userAgent;
            return undefined;
          }),
        };

        for (let i = 0; i < requestCounts[index]; i++) {
          middleware(
            requestWithUA as Request,
            mockResponse as Response,
            mockNext
          );
        }
      });

      const stats = service.getStats();

      // Should be sorted by count and truncated to 100 chars
      expect(stats.topUserAgents[0]).toEqual({
        userAgent: "Mozilla/5.0 Chrome",
        count: 4,
      });
      expect(stats.topUserAgents[1]).toEqual({
        userAgent: "Mozilla/5.0 Firefox",
        count: 2,
      });
      expect(stats.topUserAgents[2]).toEqual({
        userAgent: "Safari Browser",
        count: 1,
      });
    });

    it("should limit top lists to 10 items", () => {
      const middleware = service.middleware();

      // Generate 15 different IPs with 1 request each
      for (let i = 0; i < 15; i++) {
        const requestWithIP = {
          ...mockRequest,
          connection: { remoteAddress: `192.168.1.${i}` } as any,
        };

        middleware(
          requestWithIP as Request,
          mockResponse as Response,
          mockNext
        );
      }

      const stats = service.getStats();

      // Should be limited to 10 items
      expect(stats.topIPs).toHaveLength(10);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing user agent header", () => {
      const requestWithoutUA = {
        ...mockRequest,
        headers: {},
        get: vi.fn().mockReturnValue(undefined),
      };

      const middleware = service.middleware();

      middleware(
        requestWithoutUA as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("UserAgent: Unknown")
      );
    });

    it("should handle requests without response time", () => {
      const middleware = service.middleware();

      // Create a request stat manually without response time
      const requestStat = {
        endpoint: "GET /api/test",
        method: "GET",
        userAgent: "Test Agent",
        ip: "127.0.0.1",
        timestamp: Date.now(),
      };

      // Update endpoint metrics directly to simulate request without response time
      (service as any).updateEndpointMetrics(requestStat);

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      expect(endpointMetric?.averageResponseTime).toBe(0);
    });

    it("should handle requests without status code", () => {
      const responseWithoutStatus = {
        ...mockResponse,
        statusCode: undefined as any,
        end: vi.fn().mockReturnThis(),
      };

      const middleware = service.middleware();

      middleware(
        mockRequest as Request,
        responseWithoutStatus as unknown as Response,
        mockNext
      );

      (responseWithoutStatus.end as any)();

      const stats = service.getStats();
      const endpointMetric = stats.endpointMetrics.find(
        (m) => m.endpoint === "GET /api/test"
      );

      expect(endpointMetric?.errorCount).toBe(0);
    });
  });

  describe("File Operations", () => {
    it("should write alerts to the correct file path", () => {
      const middleware = service.middleware();

      // Generate requests to trigger alert
      for (let i = 0; i < 6; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }

      // Set low threshold to trigger alert
      (service as any).alertThresholds.requestsPerMinute = 5;
      (service as any).checkForAlerts();

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/mocked/path/to/file.log",
        expect.stringContaining("[HIGH_REQUEST_RATE]")
      );
    });

    it("should handle file write operations for emergency controls", () => {
      service.emergencyDisableRateLimit();
      service.emergencyEnableRateLimit();

      expect(fs.appendFileSync).toHaveBeenCalledTimes(2);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/mocked/path/to/file.log",
        expect.stringContaining("EMERGENCY")
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        "/mocked/path/to/file.log",
        expect.stringContaining("RECOVERY")
      );
    });
  });
});
