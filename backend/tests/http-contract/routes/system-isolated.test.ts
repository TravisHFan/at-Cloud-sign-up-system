/**
 * System Routes Isolated Tests
 *
 * Tests system health and monitoring routes using isolated Express app pattern
 * to avoid heavy import dependency chains and timeout issues.
 *
 * Coverage:
 * - GET /api/system/health - Basic system health check
 * - GET /api/system/locks - Lock statistics and monitoring (Admin only)
 * - Authentication & authorization middleware
 * - Performance metrics and recommendations
 * - Error handling scenarios
 * - System monitoring functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock lock service
const mockLockService = {
  getLockStats: vi.fn(),
};

// Mock authentication middleware
const mockAuthenticateMiddleware = vi.fn((req, res, next) => {
  // Simulate successful authentication
  req.user = {
    _id: "507f1f77bcf86cd799439011",
    username: "testadmin",
    firstName: "Test",
    lastName: "Admin",
    email: "admin@test.com",
    role: "Administrator",
    isAtCloudLeader: true,
    isActive: true,
  };
  next();
});

// Mock admin requirement middleware
const mockRequireAdminMiddleware = vi.fn((req, res, next) => {
  if (req.user?.role === "Administrator") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }
});

describe("System Routes - Isolated Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    // Create isolated Express app for each test
    app = express();
    app.use(express.json());

    // Clear all mocks
    vi.clearAllMocks();

    // Set up default successful lock stats response
    mockLockService.getLockStats.mockReturnValue({
      activeLocks: 2,
      totalLocksAcquired: 150,
      averageWaitTime: 25.5,
    });

    // Set up system routes with isolated middleware
    app.get("/api/system/health", (req, res) => {
      res.status(200).json({
        success: true,
        message: "System is healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    app.get(
      "/api/system/locks",
      mockAuthenticateMiddleware,
      mockRequireAdminMiddleware,
      (req, res) => {
        try {
          const stats = mockLockService.getLockStats();

          res.status(200).json({
            success: true,
            message: "Lock statistics retrieved successfully",
            data: {
              lockStats: stats,
              performance: {
                averageWaitTimeMs:
                  Math.round(stats.averageWaitTime * 100) / 100,
                efficiency:
                  stats.activeLocks === 0
                    ? "optimal"
                    : stats.activeLocks <= 5
                    ? "good"
                    : "high_contention",
              },
              recommendations:
                stats.averageWaitTime > 100
                  ? [
                      "Consider optimizing operation duration",
                      "Monitor for potential deadlocks",
                    ]
                  : ["System performing optimally"],
            },
          });
        } catch (error: any) {
          console.error("Error getting lock stats:", error);
          res.status(500).json({
            success: false,
            message: "Failed to retrieve lock statistics",
          });
        }
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/system/health - System Health Check", () => {
    it("should return system health status without authentication", async () => {
      // Occasionally, Node's HTTP parser can throw a transient "Expected HTTP/"
      // (HPE_INVALID_CONSTANT) error under heavy parallel test load. To keep this
      // test deterministic without touching production code, retry once on that
      // specific low-level parse error.
      const doReq = () => request(app).get("/api/system/health").expect(200);
      let response: any;
      try {
        response = await doReq();
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        const code = (err && (err.code || err?.cause?.code)) as
          | string
          | undefined;
        const isParserGlitch =
          msg.includes("Expected HTTP/") || code === "HPE_INVALID_CONSTANT";
        if (isParserGlitch) {
          response = await doReq();
        } else {
          throw err;
        }
      }

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          message: "System is healthy",
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.objectContaining({
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number),
            arrayBuffers: expect.any(Number),
          }),
        })
      );

      // Verify timestamp is recent (within last 5 seconds)
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      const timeDiff = now.getTime() - timestamp.getTime();
      expect(timeDiff).toBeLessThan(5000);

      // Verify uptime is positive
      expect(response.body.uptime).toBeGreaterThan(0);

      // Verify memory usage values are reasonable
      expect(response.body.memory.heapUsed).toBeGreaterThan(0);
      expect(response.body.memory.heapUsed).toBeLessThanOrEqual(
        response.body.memory.heapTotal
      );
    });

    it("should return consistent health check format", async () => {
      const response1 = await request(app)
        .get("/api/system/health")
        .expect(200);

      const response2 = await request(app)
        .get("/api/system/health")
        .expect(200);

      // Both responses should have same structure
      expect(Object.keys(response1.body)).toEqual(Object.keys(response2.body));
      expect(Object.keys(response1.body.memory)).toEqual(
        Object.keys(response2.body.memory)
      );

      // Uptime should increase between calls
      expect(response2.body.uptime).toBeGreaterThanOrEqual(
        response1.body.uptime
      );
    });

    it("should not require authentication for health check", async () => {
      // Override app to not include any auth middleware
      const publicApp = express();
      publicApp.use(express.json());

      publicApp.get("/api/system/health", (req, res) => {
        res.status(200).json({
          success: true,
          message: "System is healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        });
      });

      const response = await request(publicApp)
        .get("/api/system/health")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("System is healthy");
    });
  });

  describe("GET /api/system/locks - Lock Statistics (Admin Only)", () => {
    it("should return lock statistics for authenticated admin user", async () => {
      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Lock statistics retrieved successfully",
        data: {
          lockStats: {
            activeLocks: 2,
            totalLocksAcquired: 150,
            averageWaitTime: 25.5,
          },
          performance: {
            averageWaitTimeMs: 25.5,
            efficiency: "good",
          },
          recommendations: ["System performing optimally"],
        },
      });

      expect(mockAuthenticateMiddleware).toHaveBeenCalled();
      expect(mockRequireAdminMiddleware).toHaveBeenCalled();
      expect(mockLockService.getLockStats).toHaveBeenCalled();
    });

    it("should calculate optimal efficiency when no active locks", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 0,
        totalLocksAcquired: 100,
        averageWaitTime: 15.0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.performance.efficiency).toBe("optimal");
      expect(response.body.data.recommendations).toEqual([
        "System performing optimally",
      ]);
    });

    it("should identify high contention when many active locks", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 10,
        totalLocksAcquired: 200,
        averageWaitTime: 45.0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.performance.efficiency).toBe("high_contention");
      expect(response.body.data.recommendations).toEqual([
        "System performing optimally",
      ]);
    });

    it("should provide optimization recommendations for high wait times", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 3,
        totalLocksAcquired: 80,
        averageWaitTime: 150.0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.performance.averageWaitTimeMs).toBe(150.0);
      expect(response.body.data.recommendations).toEqual([
        "Consider optimizing operation duration",
        "Monitor for potential deadlocks",
      ]);
    });

    it("should round average wait time to 2 decimal places", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 1,
        totalLocksAcquired: 50,
        averageWaitTime: 33.456789,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.performance.averageWaitTimeMs).toBe(33.46);
    });

    it("should handle lock service errors gracefully", async () => {
      mockLockService.getLockStats.mockImplementation(() => {
        throw new Error("Lock service unavailable");
      });

      const response = await request(app).get("/api/system/locks").expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to retrieve lock statistics",
      });
    });
  });

  describe("Authentication and Authorization", () => {
    it("should require authentication for lock statistics", async () => {
      // Override auth middleware to simulate unauthenticated request
      const unauthenticatedApp = express();
      unauthenticatedApp.use(express.json());

      const mockUnauthMiddleware = vi.fn((req, res, next) => {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      });

      unauthenticatedApp.get(
        "/api/system/locks",
        mockUnauthMiddleware,
        mockRequireAdminMiddleware,
        (req, res) => {
          // This shouldn't be reached
          res.status(200).json({ success: true });
        }
      );

      const response = await request(unauthenticatedApp)
        .get("/api/system/locks")
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require admin role for lock statistics", async () => {
      // Override auth middleware to simulate non-admin user
      const nonAdminApp = express();
      nonAdminApp.use(express.json());

      const mockNonAdminAuthMiddleware = vi.fn((req, res, next) => {
        req.user = {
          _id: "507f1f77bcf86cd799439012",
          username: "regularuser",
          role: "Participant",
        };
        next();
      });

      const mockFailedAdminMiddleware = vi.fn((req, res, next) => {
        res.status(403).json({
          success: false,
          message: "Admin access required.",
        });
      });

      nonAdminApp.get(
        "/api/system/locks",
        mockNonAdminAuthMiddleware,
        mockFailedAdminMiddleware,
        (req, res) => {
          // This shouldn't be reached
          res.status(200).json({ success: true });
        }
      );

      const response = await request(nonAdminApp)
        .get("/api/system/locks")
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        message: "Admin access required.",
      });
    });

    it("should allow access for admin users", async () => {
      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAuthenticateMiddleware).toHaveBeenCalled();
      expect(mockRequireAdminMiddleware).toHaveBeenCalled();
    });
  });

  describe("Performance and Monitoring Scenarios", () => {
    it("should handle zero locks acquired scenario", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 0,
        totalLocksAcquired: 0,
        averageWaitTime: 0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.lockStats.totalLocksAcquired).toBe(0);
      expect(response.body.data.performance.averageWaitTimeMs).toBe(0);
      expect(response.body.data.performance.efficiency).toBe("optimal");
    });

    it("should handle edge case of very high lock contention", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 50,
        totalLocksAcquired: 1000,
        averageWaitTime: 500.0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.performance.efficiency).toBe("high_contention");
      expect(response.body.data.recommendations).toEqual([
        "Consider optimizing operation duration",
        "Monitor for potential deadlocks",
      ]);
    });

    it("should handle boundary cases for efficiency classification", async () => {
      // Test exactly 5 active locks (boundary between good and high_contention)
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 5,
        totalLocksAcquired: 100,
        averageWaitTime: 30.0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.performance.efficiency).toBe("good");
    });

    it("should handle boundary case for wait time recommendations", async () => {
      // Test exactly 100ms wait time (boundary for recommendations)
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 2,
        totalLocksAcquired: 75,
        averageWaitTime: 100.0,
      });

      const response = await request(app).get("/api/system/locks").expect(200);

      expect(response.body.data.recommendations).toEqual([
        "System performing optimally",
      ]);
    });

    it("should handle very small wait times correctly", async () => {
      mockLockService.getLockStats.mockReturnValue({
        activeLocks: 1,
        totalLocksAcquired: 25,
        averageWaitTime: 0.123456,
      });

      // Rarely, Node's HTTP parser can throw a transient "Expected HTTP/" error
      // (HPE_INVALID_CONSTANT) under parallel test load. Retry once to keep
      // this deterministic without touching production code.
      const doReq = () => request(app).get("/api/system/locks").expect(200);
      let response: any;
      try {
        response = await doReq();
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        const code = (err && (err.code || err?.cause?.code)) as
          | string
          | undefined;
        const isParserGlitch =
          msg.includes("Expected HTTP/") || code === "HPE_INVALID_CONSTANT";
        if (isParserGlitch) {
          response = await doReq();
        } else {
          throw err;
        }
      }

      expect(response.body.data.performance.averageWaitTimeMs).toBe(0.12);
    });
  });

  describe("Error Handling Scenarios", () => {
    it("should handle invalid query parameters gracefully", async () => {
      const response = await request(app)
        .get("/api/system/health?invalidParam=test")
        .expect(200);

      // Health check should ignore invalid params
      expect(response.body.success).toBe(true);
    });

    it("should handle lock service returning null/undefined", async () => {
      mockLockService.getLockStats.mockReturnValue(null);

      const response = await request(app).get("/api/system/locks").expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to retrieve lock statistics",
      });
    });

    it("should handle malformed request data", async () => {
      const response = await request(app)
        .get("/api/system/health")
        .send("invalid json")
        .expect(200);

      // GET requests should ignore request body
      expect(response.body.success).toBe(true);
    });

    it("should handle concurrent requests to health endpoint", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => request(app).get("/api/system/health"));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe("System Monitoring Integration", () => {
    it("should provide comprehensive lock statistics data structure", async () => {
      const response = await request(app).get("/api/system/locks").expect(200);

      // Verify complete data structure
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("data");

      const data = response.body.data;
      expect(data).toHaveProperty("lockStats");
      expect(data).toHaveProperty("performance");
      expect(data).toHaveProperty("recommendations");

      expect(data.lockStats).toHaveProperty("activeLocks");
      expect(data.lockStats).toHaveProperty("totalLocksAcquired");
      expect(data.lockStats).toHaveProperty("averageWaitTime");

      expect(data.performance).toHaveProperty("averageWaitTimeMs");
      expect(data.performance).toHaveProperty("efficiency");

      expect(Array.isArray(data.recommendations)).toBe(true);
    });

    it("should maintain consistent response times for health checks", async () => {
      const startTime = Date.now();

      const response = await request(app).get("/api/system/health").expect(200);

      const responseTime = Date.now() - startTime;

      // Health check should be very fast (under 100ms)
      expect(responseTime).toBeLessThan(100);
      expect(response.body.success).toBe(true);
    });

    it("should track lock service calls correctly", async () => {
      await request(app).get("/api/system/locks").expect(200);

      await request(app).get("/api/system/locks").expect(200);

      expect(mockLockService.getLockStats).toHaveBeenCalledTimes(2);
    });
  });
});
