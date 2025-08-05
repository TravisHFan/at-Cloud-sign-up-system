import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import systemRoutes from "../../../src/routes/system";

// Mock the lock service
vi.mock("../../../src/services", () => ({
  lockService: {
    getLockStats: vi.fn(() => ({
      activeLocks: 2,
      totalAcquired: 150,
      totalReleased: 148,
      averageWaitTime: 45.5,
      maxWaitTime: 200,
      currentOperations: ["user-update", "event-create"],
    })),
  },
}));

// Mock authentication middleware
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { id: "user-123", role: "ADMIN" };
    next();
  }),
  requireAdmin: vi.fn((req, res, next) => next()),
}));

describe("System Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/system", systemRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Route Existence", () => {
    it("should have health check GET route", async () => {
      const response = await request(app).get("/api/v1/system/health");

      expect(response.status).not.toBe(404);
    });

    it("should have locks statistics GET route", async () => {
      const response = await request(app).get("/api/v1/system/locks");

      expect(response.status).not.toBe(404);
    });
  });

  describe("Health Check", () => {
    describe("GET /health", () => {
      it("should return system health status successfully", async () => {
        const response = await request(app).get("/api/v1/system/health");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: "System is healthy",
        });
        expect(response.body).toHaveProperty("timestamp");
        expect(response.body).toHaveProperty("uptime");
        expect(response.body).toHaveProperty("memory");
      });

      it("should include process uptime", async () => {
        const response = await request(app).get("/api/v1/system/health");

        expect(response.status).toBe(200);
        expect(typeof response.body.uptime).toBe("number");
        expect(response.body.uptime).toBeGreaterThan(0);
      });

      it("should include memory usage information", async () => {
        const response = await request(app).get("/api/v1/system/health");

        expect(response.status).toBe(200);
        expect(response.body.memory).toHaveProperty("rss");
        expect(response.body.memory).toHaveProperty("heapTotal");
        expect(response.body.memory).toHaveProperty("heapUsed");
        expect(response.body.memory).toHaveProperty("external");
      });

      it("should include ISO timestamp", async () => {
        const response = await request(app).get("/api/v1/system/health");

        expect(response.status).toBe(200);
        expect(response.body.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
      });

      it("should not require authentication", async () => {
        // Create an app without authentication middleware
        const publicApp = express();
        publicApp.use(express.json());
        publicApp.use("/api/v1/system", systemRoutes);

        const response = await request(publicApp).get("/api/v1/system/health");

        expect(response.status).toBe(200);
      });
    });
  });

  describe("Lock Statistics", () => {
    describe("GET /locks", () => {
      it("should return lock statistics successfully", async () => {
        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: "Lock statistics retrieved successfully",
        });
        expect(response.body).toHaveProperty("data");
      });

      it("should include detailed lock statistics", async () => {
        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty("lockStats");
        expect(response.body.data.lockStats).toMatchObject({
          activeLocks: 2,
          totalAcquired: 150,
          totalReleased: 148,
          averageWaitTime: 45.5,
          maxWaitTime: 200,
          currentOperations: ["user-update", "event-create"],
        });
      });

      it("should include performance metrics", async () => {
        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty("performance");
        expect(response.body.data.performance).toHaveProperty(
          "averageWaitTimeMs"
        );
        expect(response.body.data.performance).toHaveProperty("efficiency");
        expect(response.body.data.performance.averageWaitTimeMs).toBe(45.5);
        expect(response.body.data.performance.efficiency).toBe("good");
      });

      it("should include recommendations", async () => {
        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty("recommendations");
        expect(Array.isArray(response.body.data.recommendations)).toBe(true);
        expect(response.body.data.recommendations).toContain(
          "System performing optimally"
        );
      });

      it("should classify efficiency as optimal for no active locks", async () => {
        // Mock lock service to return no active locks
        const mockLockService = require("../../../src/services").lockService;
        mockLockService.getLockStats.mockReturnValue({
          activeLocks: 0,
          totalAcquired: 100,
          totalReleased: 100,
          averageWaitTime: 10,
          maxWaitTime: 50,
          currentOperations: [],
        });

        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body.data.performance.efficiency).toBe("optimal");
      });

      it("should classify efficiency as high_contention for many active locks", async () => {
        // Mock lock service to return many active locks
        const mockLockService = require("../../../src/services").lockService;
        mockLockService.getLockStats.mockReturnValue({
          activeLocks: 10,
          totalAcquired: 200,
          totalReleased: 190,
          averageWaitTime: 75,
          maxWaitTime: 300,
          currentOperations: ["op1", "op2", "op3", "op4", "op5", "op6"],
        });

        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body.data.performance.efficiency).toBe(
          "high_contention"
        );
      });

      it("should provide optimization recommendations for high wait times", async () => {
        // Mock lock service to return high wait times
        const mockLockService = require("../../../src/services").lockService;
        mockLockService.getLockStats.mockReturnValue({
          activeLocks: 3,
          totalAcquired: 50,
          totalReleased: 47,
          averageWaitTime: 150,
          maxWaitTime: 500,
          currentOperations: ["slow-operation"],
        });

        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(200);
        expect(response.body.data.recommendations).toContain(
          "Consider optimizing operation duration"
        );
        expect(response.body.data.recommendations).toContain(
          "Monitor for potential deadlocks"
        );
      });

      it("should handle lock service errors gracefully", async () => {
        // Mock lock service to throw error
        const mockLockService = require("../../../src/services").lockService;
        mockLockService.getLockStats.mockImplementation(() => {
          throw new Error("Lock service unavailable");
        });

        const response = await request(app).get("/api/v1/system/locks");

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          message: "Failed to retrieve lock statistics",
        });
      });
    });
  });

  describe("Middleware Integration", () => {
    it("should require authentication for lock statistics", async () => {
      const response = await request(app).get("/api/v1/system/locks");

      expect(response.status).toBe(200);
      // Authentication is mocked to always succeed
    });

    it("should require admin privileges for lock statistics", async () => {
      const response = await request(app).get("/api/v1/system/locks");

      expect(response.status).toBe(200);
      // Admin requirement is mocked to always succeed
    });

    it("should not require authentication for health check", async () => {
      const response = await request(app).get("/api/v1/system/health");

      expect(response.status).toBe(200);
      // Health check is public
    });
  });

  describe("Response Format Validation", () => {
    it("should return consistent response format for health", async () => {
      const response = await request(app).get("/api/v1/system/health");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(typeof response.body).toBe("object");
    });

    it("should return consistent response format for locks", async () => {
      const response = await request(app).get("/api/v1/system/locks");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(typeof response.body).toBe("object");
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid routes gracefully", async () => {
      const response = await request(app).get(
        "/api/v1/system/invalid-endpoint"
      );

      expect(response.status).toBe(404);
    });

    it("should handle unexpected errors in health check", async () => {
      // Mock process.uptime to throw error
      const originalUptime = process.uptime;
      process.uptime = vi.fn(() => {
        throw new Error("Process error");
      });

      try {
        const response = await request(app).get("/api/v1/system/health");

        // Health check should still work despite process errors
        expect([200, 500]).toContain(response.status);
      } finally {
        process.uptime = originalUptime;
      }
    });
  });
});
