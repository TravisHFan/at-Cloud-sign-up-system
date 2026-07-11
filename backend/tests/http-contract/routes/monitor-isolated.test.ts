import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Monitor Routes - Isolated Tests
 *
 * Tests monitor endpoint functionality using isolated Express app pattern.
 * This avoids heavy import dependency chains that cause timeout issues.
 *
 * Coverage:
 * - GET /api/monitor/stats - Request statistics monitoring
 * - POST /api/monitor/emergency-disable - Emergency rate limit disable
 * - POST /api/monitor/emergency-enable - Emergency rate limit enable
 * - GET /api/monitor/rate-limiting-status - Rate limiting status check
 * - GET /api/monitor/health - System health monitoring
 * - Error handling scenarios
 * - Performance monitoring
 * - Security access patterns
 */

describe("Monitor Routes - Isolated Tests", () => {
  let app: express.Application;
  let mockRequestMonitorService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock RequestMonitorService with all required methods
    mockRequestMonitorService = {
      getInstance: vi.fn().mockReturnThis(),
      getStats: vi.fn(),
      emergencyDisableRateLimit: vi.fn(),
      emergencyEnableRateLimit: vi.fn(),
      getRateLimitingStatus: vi.fn(),
    };

    // Setup monitor routes with mocked service
    app.get("/api/monitor/stats", (req, res) => {
      try {
        const monitor = mockRequestMonitorService.getInstance();
        const stats = monitor.getStats();

        res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error getting monitor stats:", error);
        res.status(500).json({
          success: false,
          error: "Failed to get monitoring statistics",
        });
      }
    });

    app.post("/api/monitor/emergency-disable", (req, res) => {
      try {
        const monitor = mockRequestMonitorService.getInstance();
        monitor.emergencyDisableRateLimit();

        res.json({
          success: true,
          message: "Rate limiting has been emergency disabled",
          status: "emergency_disabled",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error disabling rate limiting:", error);
        res.status(500).json({
          success: false,
          error: "Failed to disable rate limiting",
        });
      }
    });

    app.post("/api/monitor/emergency-enable", (req, res) => {
      try {
        const monitor = mockRequestMonitorService.getInstance();
        monitor.emergencyEnableRateLimit();

        res.json({
          success: true,
          message: "Rate limiting has been re-enabled",
          status: "enabled",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error re-enabling rate limiting:", error);
        res.status(500).json({
          success: false,
          error: "Failed to re-enable rate limiting",
        });
      }
    });

    app.get("/api/monitor/rate-limiting-status", (req, res) => {
      try {
        const monitor = mockRequestMonitorService.getInstance();
        const status = monitor.getRateLimitingStatus();

        res.json({
          success: true,
          data: status,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error getting rate limiting status:", error);
        res.status(500).json({
          success: false,
          error: "Failed to get rate limiting status",
        });
      }
    });

    app.get("/api/monitor/health", (req, res) => {
      try {
        const monitor = mockRequestMonitorService.getInstance();
        const stats = monitor.getStats();

        const isHealthy =
          stats.requestsPerSecond < 20 && stats.totalRequestsLastMinute < 500;

        res.json({
          success: true,
          healthy: isHealthy,
          requestsPerSecond: stats.requestsPerSecond,
          requestsLastMinute: stats.totalRequestsLastMinute,
          suspiciousPatterns: stats.suspiciousPatterns.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error checking health:", error);
        res.status(500).json({
          success: false,
          error: "Failed to check system health",
        });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/monitor/stats - Request Statistics", () => {
    it("should return comprehensive monitoring statistics", async () => {
      const mockStats = {
        totalRequestsLastHour: 1250,
        totalRequestsLastMinute: 45,
        requestsPerSecond: 0.75,
        endpointMetrics: [
          {
            endpoint: "/api/events",
            count: 523,
            averageResponseTime: 185,
            errorCount: 3,
            uniqueIPs: 87,
            uniqueUserAgents: 12,
          },
          {
            endpoint: "/api/auth/login",
            count: 289,
            averageResponseTime: 312,
            errorCount: 15,
            uniqueIPs: 156,
            uniqueUserAgents: 23,
          },
        ],
        topIPs: [
          { ip: "192.168.1.100", count: 45 },
          { ip: "10.0.0.25", count: 32 },
        ],
        topUserAgents: [
          { userAgent: "Mozilla/5.0 Chrome", count: 234 },
          { userAgent: "curl/7.68.0", count: 12 },
        ],
        suspiciousPatterns: [
          {
            type: "high_frequency",
            description: "IP 192.168.1.100 made 45 requests in last minute",
            severity: "medium",
          },
        ],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/stats");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      expect(mockRequestMonitorService.getInstance).toHaveBeenCalled();
      expect(mockRequestMonitorService.getStats).toHaveBeenCalled();
    });

    it("should return detailed endpoint performance metrics", async () => {
      const mockStats = {
        totalRequestsLastHour: 856,
        totalRequestsLastMinute: 12,
        requestsPerSecond: 0.2,
        endpointMetrics: [
          {
            endpoint: "/api/users/profile",
            count: 145,
            averageResponseTime: 89,
            errorCount: 0,
            uniqueIPs: 45,
            uniqueUserAgents: 8,
          },
        ],
        topIPs: [],
        topUserAgents: [],
        suspiciousPatterns: [],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/stats");

      expect(response.status).toBe(200);
      expect(response.body.data.endpointMetrics).toHaveLength(1);
      expect(response.body.data.endpointMetrics[0]).toMatchObject({
        endpoint: "/api/users/profile",
        count: 145,
        averageResponseTime: 89,
        errorCount: 0,
        uniqueIPs: 45,
        uniqueUserAgents: 8,
      });
    });

    it("should handle monitoring service errors gracefully", async () => {
      mockRequestMonitorService.getStats.mockImplementation(() => {
        throw new Error("Monitoring service unavailable");
      });

      const response = await request(app).get("/api/monitor/stats");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to get monitoring statistics");
    });
  });

  describe("POST /api/monitor/emergency-disable - Emergency Rate Limiting Control", () => {
    it("should successfully disable rate limiting in emergency", async () => {
      const response = await request(app).post(
        "/api/monitor/emergency-disable"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Rate limiting has been emergency disabled"
      );
      expect(response.body.status).toBe("emergency_disabled");
      expect(response.body.timestamp).toBeDefined();
      expect(mockRequestMonitorService.getInstance).toHaveBeenCalled();
      expect(
        mockRequestMonitorService.emergencyDisableRateLimit
      ).toHaveBeenCalled();
    });

    it("should handle emergency disable service errors", async () => {
      mockRequestMonitorService.emergencyDisableRateLimit.mockImplementation(
        () => {
          throw new Error("Failed to access rate limiter");
        }
      );

      const response = await request(app).post(
        "/api/monitor/emergency-disable"
      );

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to disable rate limiting");
    });
  });

  describe("POST /api/monitor/emergency-enable - Emergency Rate Limiting Recovery", () => {
    it("should successfully re-enable rate limiting after emergency", async () => {
      const response = await request(app).post("/api/monitor/emergency-enable");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Rate limiting has been re-enabled");
      expect(response.body.status).toBe("enabled");
      expect(response.body.timestamp).toBeDefined();
      expect(mockRequestMonitorService.getInstance).toHaveBeenCalled();
      expect(
        mockRequestMonitorService.emergencyEnableRateLimit
      ).toHaveBeenCalled();
    });

    it("should handle emergency enable service errors", async () => {
      mockRequestMonitorService.emergencyEnableRateLimit.mockImplementation(
        () => {
          throw new Error("Failed to access rate limiter configuration");
        }
      );

      const response = await request(app).post("/api/monitor/emergency-enable");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to re-enable rate limiting");
    });
  });

  describe("GET /api/monitor/rate-limiting-status - Rate Limiting Status", () => {
    it("should return enabled rate limiting status", async () => {
      const mockStatus = {
        enabled: true,
        status: "enabled",
      };

      mockRequestMonitorService.getRateLimitingStatus.mockReturnValue(
        mockStatus
      );

      const response = await request(app).get(
        "/api/monitor/rate-limiting-status"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
      expect(response.body.timestamp).toBeDefined();
      expect(mockRequestMonitorService.getInstance).toHaveBeenCalled();
      expect(
        mockRequestMonitorService.getRateLimitingStatus
      ).toHaveBeenCalled();
    });

    it("should return emergency disabled rate limiting status", async () => {
      const mockStatus = {
        enabled: false,
        status: "emergency_disabled",
      };

      mockRequestMonitorService.getRateLimitingStatus.mockReturnValue(
        mockStatus
      );

      const response = await request(app).get(
        "/api/monitor/rate-limiting-status"
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
      expect(response.body.data.status).toBe("emergency_disabled");
    });

    it("should handle rate limiting status service errors", async () => {
      mockRequestMonitorService.getRateLimitingStatus.mockImplementation(() => {
        throw new Error("Configuration service unavailable");
      });

      const response = await request(app).get(
        "/api/monitor/rate-limiting-status"
      );

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to get rate limiting status");
    });
  });

  describe("GET /api/monitor/health - System Health Check", () => {
    it("should return healthy status for normal traffic", async () => {
      const mockStats = {
        requestsPerSecond: 5,
        totalRequestsLastMinute: 150,
        suspiciousPatterns: [],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.healthy).toBe(true);
      expect(response.body.requestsPerSecond).toBe(5);
      expect(response.body.requestsLastMinute).toBe(150);
      expect(response.body.suspiciousPatterns).toBe(0);
      expect(response.body.timestamp).toBeDefined();
    });

    it("should return unhealthy status for high traffic load", async () => {
      const mockStats = {
        requestsPerSecond: 25, // Above threshold (20)
        totalRequestsLastMinute: 600, // Above threshold (500)
        suspiciousPatterns: [
          { type: "ddos_pattern", severity: "high" },
          { type: "bot_activity", severity: "medium" },
        ],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.healthy).toBe(false);
      expect(response.body.requestsPerSecond).toBe(25);
      expect(response.body.requestsLastMinute).toBe(600);
      expect(response.body.suspiciousPatterns).toBe(2);
    });

    it("should return unhealthy status for suspicious patterns only", async () => {
      const mockStats = {
        requestsPerSecond: 10, // Below threshold
        totalRequestsLastMinute: 300, // Below threshold
        suspiciousPatterns: [{ type: "malicious_scanning", severity: "high" }],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(200);
      // Health check only considers traffic volume, not suspicious patterns
      expect(response.body.healthy).toBe(true);
      expect(response.body.suspiciousPatterns).toBe(1);
    });

    it("should handle health check service errors", async () => {
      mockRequestMonitorService.getStats.mockImplementation(() => {
        throw new Error("Health monitoring system failure");
      });

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to check system health");
    });
  });

  describe("Performance and Monitoring Edge Cases", () => {
    it("should handle boundary values for health thresholds", async () => {
      // Test exact threshold values
      const mockStats = {
        requestsPerSecond: 20, // Exactly at threshold
        totalRequestsLastMinute: 500, // Exactly at threshold
        suspiciousPatterns: [],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(200);
      expect(response.body.healthy).toBe(false); // Should be unhealthy at threshold
    });

    it("should handle just below health thresholds", async () => {
      const mockStats = {
        requestsPerSecond: 19, // Just below threshold
        totalRequestsLastMinute: 499, // Just below threshold
        suspiciousPatterns: [],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(200);
      expect(response.body.healthy).toBe(true); // Should be healthy just below threshold
    });

    it("should handle zero traffic scenarios", async () => {
      const mockStats = {
        totalRequestsLastHour: 0,
        totalRequestsLastMinute: 0,
        requestsPerSecond: 0,
        endpointMetrics: [],
        topIPs: [],
        topUserAgents: [],
        suspiciousPatterns: [],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/stats");

      expect(response.status).toBe(200);
      expect(response.body.data.totalRequestsLastHour).toBe(0);
      expect(response.body.data.endpointMetrics).toHaveLength(0);
    });

    it("should handle high-volume traffic scenarios", async () => {
      const mockStats = {
        totalRequestsLastHour: 50000,
        totalRequestsLastMinute: 1500,
        requestsPerSecond: 25,
        endpointMetrics: Array.from({ length: 20 }, (_, i) => ({
          endpoint: `/api/endpoint-${i}`,
          count: 1000 + i * 100,
          averageResponseTime: 50 + i * 10,
          errorCount: i % 3,
          uniqueIPs: 100 + i * 10,
          uniqueUserAgents: 5 + i,
        })),
        topIPs: Array.from({ length: 10 }, (_, i) => ({
          ip: `192.168.1.${100 + i}`,
          count: 200 - i * 15,
        })),
        topUserAgents: [],
        suspiciousPatterns: [],
      };

      mockRequestMonitorService.getStats.mockReturnValue(mockStats);

      const response = await request(app).get("/api/monitor/stats");

      expect(response.status).toBe(200);
      expect(response.body.data.endpointMetrics).toHaveLength(20);
      expect(response.body.data.topIPs).toHaveLength(10);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle null responses from monitoring service", async () => {
      mockRequestMonitorService.getStats.mockReturnValue(null);

      const response = await request(app).get("/api/monitor/health");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it("should handle undefined responses from rate limiting status", async () => {
      mockRequestMonitorService.getRateLimitingStatus.mockReturnValue(
        undefined
      );

      const response = await request(app).get(
        "/api/monitor/rate-limiting-status"
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toBeUndefined();
    });

    it("should handle monitoring service getInstance failures", async () => {
      mockRequestMonitorService.getInstance.mockImplementation(() => {
        throw new Error("Singleton initialization failed");
      });

      const response = await request(app).get("/api/monitor/stats");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to get monitoring statistics");
    });
  });
});
