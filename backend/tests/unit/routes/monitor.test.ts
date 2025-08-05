import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import monitorRoutes from "../../../src/routes/monitor";

// Mock the RequestMonitorService
vi.mock("../../../src/middleware/RequestMonitorService", () => ({
  default: {
    getInstance: vi.fn(() => ({
      getStats: vi.fn(() => ({
        totalRequests: 1500,
        requestsPerSecond: 12.5,
        totalRequestsLastMinute: 250,
        averageResponseTime: 145,
        errorRate: 0.02,
        suspiciousPatterns: [
          { type: "rapid_requests", count: 3, ip: "192.168.1.100" },
        ],
        rateLimitingEnabled: true,
        lastReset: new Date().toISOString(),
      })),
      emergencyDisableRateLimit: vi.fn(),
      emergencyEnableRateLimit: vi.fn(),
      getRateLimitingStatus: vi.fn(() => ({
        enabled: true,
        emergencyMode: false,
        bypassCount: 0,
        lastToggled: new Date().toISOString(),
      })),
    })),
  },
}));

describe("Monitor Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/monitor", monitorRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Route Existence", () => {
    it("should have stats GET route", async () => {
      const response = await request(app).get("/api/v1/monitor/stats");

      expect(response.status).not.toBe(404);
    });

    it("should have emergency disable POST route", async () => {
      const response = await request(app).post(
        "/api/v1/monitor/emergency-disable"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have emergency enable POST route", async () => {
      const response = await request(app).post(
        "/api/v1/monitor/emergency-enable"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have rate limiting status GET route", async () => {
      const response = await request(app).get(
        "/api/v1/monitor/rate-limiting-status"
      );

      expect(response.status).not.toBe(404);
    });

    it("should have health GET route", async () => {
      const response = await request(app).get("/api/v1/monitor/health");

      expect(response.status).not.toBe(404);
    });
  });

  describe("Stats Monitoring", () => {
    describe("GET /stats", () => {
      it("should return monitoring statistics successfully", async () => {
        const response = await request(app).get("/api/v1/monitor/stats");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
        });
        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("timestamp");
      });

      it("should include comprehensive statistics", async () => {
        const response = await request(app).get("/api/v1/monitor/stats");

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          totalRequests: 1500,
          requestsPerSecond: 12.5,
          totalRequestsLastMinute: 250,
          averageResponseTime: 145,
          errorRate: 0.02,
          rateLimitingEnabled: true,
        });
        expect(response.body.data).toHaveProperty("suspiciousPatterns");
        expect(Array.isArray(response.body.data.suspiciousPatterns)).toBe(true);
      });

      it("should include suspicious patterns detection", async () => {
        const response = await request(app).get("/api/v1/monitor/stats");

        expect(response.status).toBe(200);
        expect(response.body.data.suspiciousPatterns).toHaveLength(1);
        expect(response.body.data.suspiciousPatterns[0]).toMatchObject({
          type: "rapid_requests",
          count: 3,
          ip: "192.168.1.100",
        });
      });

      it("should handle monitor service errors", async () => {
        // Mock service to throw error
        const mockService =
          require("../../../src/middleware/RequestMonitorService").default;
        mockService.getInstance.mockReturnValue({
          getStats: vi.fn(() => {
            throw new Error("Monitor service error");
          }),
        });

        const response = await request(app).get("/api/v1/monitor/stats");

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: "Failed to get monitoring statistics",
        });
      });
    });
  });

  describe("Emergency Controls", () => {
    describe("POST /emergency-disable", () => {
      it("should emergency disable rate limiting successfully", async () => {
        const response = await request(app).post(
          "/api/v1/monitor/emergency-disable"
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: "Rate limiting has been emergency disabled",
          status: "emergency_disabled",
        });
        expect(response.body).toHaveProperty("timestamp");
      });

      it("should handle emergency disable errors", async () => {
        // Mock service to throw error
        const mockService =
          require("../../../src/middleware/RequestMonitorService").default;
        mockService.getInstance.mockReturnValue({
          emergencyDisableRateLimit: vi.fn(() => {
            throw new Error("Disable failed");
          }),
        });

        const response = await request(app).post(
          "/api/v1/monitor/emergency-disable"
        );

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: "Failed to disable rate limiting",
        });
      });
    });

    describe("POST /emergency-enable", () => {
      it("should emergency enable rate limiting successfully", async () => {
        const response = await request(app).post(
          "/api/v1/monitor/emergency-enable"
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: "Rate limiting has been re-enabled",
          status: "enabled",
        });
        expect(response.body).toHaveProperty("timestamp");
      });

      it("should handle emergency enable errors", async () => {
        // Mock service to throw error
        const mockService =
          require("../../../src/middleware/RequestMonitorService").default;
        mockService.getInstance.mockReturnValue({
          emergencyEnableRateLimit: vi.fn(() => {
            throw new Error("Enable failed");
          }),
        });

        const response = await request(app).post(
          "/api/v1/monitor/emergency-enable"
        );

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: "Failed to re-enable rate limiting",
        });
      });
    });
  });

  describe("Rate Limiting Status", () => {
    describe("GET /rate-limiting-status", () => {
      it("should return rate limiting status successfully", async () => {
        const response = await request(app).get(
          "/api/v1/monitor/rate-limiting-status"
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
        });
        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("timestamp");
      });

      it("should include detailed status information", async () => {
        const response = await request(app).get(
          "/api/v1/monitor/rate-limiting-status"
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          enabled: true,
          emergencyMode: false,
          bypassCount: 0,
        });
        expect(response.body.data).toHaveProperty("lastToggled");
      });

      it("should handle status check errors", async () => {
        // Mock service to throw error
        const mockService =
          require("../../../src/middleware/RequestMonitorService").default;
        mockService.getInstance.mockReturnValue({
          getRateLimitingStatus: vi.fn(() => {
            throw new Error("Status check failed");
          }),
        });

        const response = await request(app).get(
          "/api/v1/monitor/rate-limiting-status"
        );

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: "Failed to get rate limiting status",
        });
      });
    });
  });

  describe("Health Check", () => {
    describe("GET /health", () => {
      it("should return health status successfully", async () => {
        const response = await request(app).get("/api/v1/monitor/health");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          healthy: true,
        });
        expect(response.body).toHaveProperty("requestsPerSecond");
        expect(response.body).toHaveProperty("requestsLastMinute");
        expect(response.body).toHaveProperty("suspiciousPatterns");
        expect(response.body).toHaveProperty("timestamp");
      });

      it("should determine healthy status based on metrics", async () => {
        const response = await request(app).get("/api/v1/monitor/health");

        expect(response.status).toBe(200);
        // With 12.5 RPS and 250 requests/minute, should be healthy
        expect(response.body.healthy).toBe(true);
        expect(response.body.requestsPerSecond).toBe(12.5);
        expect(response.body.requestsLastMinute).toBe(250);
        expect(response.body.suspiciousPatterns).toBe(1);
      });

      it("should mark as unhealthy with high traffic", async () => {
        // Mock service to return high traffic stats
        const mockService =
          require("../../../src/middleware/RequestMonitorService").default;
        mockService.getInstance.mockReturnValue({
          getStats: vi.fn(() => ({
            requestsPerSecond: 25,
            totalRequestsLastMinute: 600,
            suspiciousPatterns: [],
          })),
        });

        const response = await request(app).get("/api/v1/monitor/health");

        expect(response.status).toBe(200);
        expect(response.body.healthy).toBe(false);
        expect(response.body.requestsPerSecond).toBe(25);
        expect(response.body.requestsLastMinute).toBe(600);
      });

      it("should handle health check errors", async () => {
        // Mock service to throw error
        const mockService =
          require("../../../src/middleware/RequestMonitorService").default;
        mockService.getInstance.mockReturnValue({
          getStats: vi.fn(() => {
            throw new Error("Health check failed");
          }),
        });

        const response = await request(app).get("/api/v1/monitor/health");

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: "Failed to check system health",
        });
      });
    });
  });

  describe("Response Format Validation", () => {
    it("should return consistent JSON format for all endpoints", async () => {
      const endpoints = [
        "/api/v1/monitor/stats",
        "/api/v1/monitor/rate-limiting-status",
        "/api/v1/monitor/health",
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/application\/json/);
        expect(typeof response.body).toBe("object");
        expect(response.body).toHaveProperty("success");
        expect(response.body).toHaveProperty("timestamp");
      }
    });

    it("should include timestamps in ISO format", async () => {
      const response = await request(app).get("/api/v1/monitor/stats");

      expect(response.status).toBe(200);
      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid routes gracefully", async () => {
      const response = await request(app).get(
        "/api/v1/monitor/invalid-endpoint"
      );

      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      const response = await request(app).delete("/api/v1/monitor/stats");

      expect(response.status).toBe(404);
    });

    it("should handle malformed request bodies", async () => {
      const response = await request(app)
        .post("/api/v1/monitor/emergency-disable")
        .send("invalid json");

      // Should still work since these endpoints don't require body
      expect([200, 400]).toContain(response.status);
    });
  });

  describe("Public Access", () => {
    it("should allow access without authentication", async () => {
      // Monitor routes should be accessible for system monitoring
      const response = await request(app).get("/api/v1/monitor/health");

      expect(response.status).toBe(200);
    });

    it("should allow emergency controls without authentication", async () => {
      // Emergency controls should be accessible in crisis situations
      const response = await request(app).post(
        "/api/v1/monitor/emergency-disable"
      );

      expect(response.status).toBe(200);
    });
  });
});
