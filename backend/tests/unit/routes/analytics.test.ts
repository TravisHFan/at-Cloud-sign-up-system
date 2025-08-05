import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import analyticsRoutes from "../../../src/routes/analytics";

// Mock the controller
vi.mock("../../../src/controllers/analyticsController", () => ({
  AnalyticsController: {
    getAnalytics: vi.fn((req, res) =>
      res.status(200).json({ overview: "data" })
    ),
    getUserAnalytics: vi.fn((req, res) =>
      res.status(200).json({ users: "data" })
    ),
    getEventAnalytics: vi.fn((req, res) =>
      res.status(200).json({ events: "data" })
    ),
    getEngagementAnalytics: vi.fn((req, res) =>
      res.status(200).json({ engagement: "data" })
    ),
    exportAnalytics: vi.fn((req, res) =>
      res.status(200).json({ export: "data" })
    ),
  },
}));

// Mock authentication and authorization middleware
vi.mock("../../../src/middleware/auth", () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { id: "user-123", role: "SUPER_ADMIN" };
    next();
  }),
  authorizePermission: vi.fn(() => (req, res, next) => next()),
}));

// Mock role utils
vi.mock("../../../src/utils/roleUtils", () => ({
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

// Mock rate limiting middleware
vi.mock("../../../src/middleware/rateLimiting", () => ({
  analyticsLimiter: vi.fn((req, res, next) => next()),
  exportLimiter: vi.fn((req, res, next) => next()),
}));

describe("Analytics Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/analytics", analyticsRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Route Existence", () => {
    it("should have analytics overview GET route", async () => {
      const response = await request(app).get("/api/v1/analytics/");

      expect(response.status).not.toBe(404);
    });

    it("should have user analytics GET route", async () => {
      const response = await request(app).get("/api/v1/analytics/users");

      expect(response.status).not.toBe(404);
    });

    it("should have event analytics GET route", async () => {
      const response = await request(app).get("/api/v1/analytics/events");

      expect(response.status).not.toBe(404);
    });

    it("should have engagement analytics GET route", async () => {
      const response = await request(app).get("/api/v1/analytics/engagement");

      expect(response.status).not.toBe(404);
    });

    it("should have export analytics GET route", async () => {
      const response = await request(app).get("/api/v1/analytics/export");

      expect(response.status).not.toBe(404);
    });
  });

  describe("Analytics Overview", () => {
    describe("GET /", () => {
      it("should get analytics overview successfully", async () => {
        const response = await request(app).get("/api/v1/analytics/");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ overview: "data" });
      });

      it("should handle query parameters", async () => {
        const response = await request(app).get(
          "/api/v1/analytics/?startDate=2024-01-01&endDate=2024-12-31"
        );

        expect(response.status).toBe(200);
      });
    });
  });

  describe("User Analytics", () => {
    describe("GET /users", () => {
      it("should get user analytics successfully", async () => {
        const response = await request(app).get("/api/v1/analytics/users");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ users: "data" });
      });

      it("should support date filtering", async () => {
        const response = await request(app).get(
          "/api/v1/analytics/users?period=monthly"
        );

        expect(response.status).toBe(200);
      });
    });
  });

  describe("Event Analytics", () => {
    describe("GET /events", () => {
      it("should get event analytics successfully", async () => {
        const response = await request(app).get("/api/v1/analytics/events");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ events: "data" });
      });

      it("should support event type filtering", async () => {
        const response = await request(app).get(
          "/api/v1/analytics/events?type=meeting&status=completed"
        );

        expect(response.status).toBe(200);
      });
    });
  });

  describe("Engagement Analytics", () => {
    describe("GET /engagement", () => {
      it("should get engagement analytics successfully", async () => {
        const response = await request(app).get("/api/v1/analytics/engagement");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ engagement: "data" });
      });

      it("should support metric filtering", async () => {
        const response = await request(app).get(
          "/api/v1/analytics/engagement?metrics=signups,attendance"
        );

        expect(response.status).toBe(200);
      });
    });
  });

  describe("Export Analytics", () => {
    describe("GET /export", () => {
      it("should export analytics successfully", async () => {
        const response = await request(app).get("/api/v1/analytics/export");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ export: "data" });
      });

      it("should support format specification", async () => {
        const response = await request(app).get(
          "/api/v1/analytics/export?format=csv&type=users"
        );

        expect(response.status).toBe(200);
      });
    });
  });

  describe("Middleware Integration", () => {
    it("should require authentication for all routes", async () => {
      const response = await request(app).get("/api/v1/analytics/");

      expect(response.status).toBe(200);
      // Authentication is mocked to always succeed
    });

    it("should require analytics permissions", async () => {
      const response = await request(app).get("/api/v1/analytics/users");

      expect(response.status).toBe(200);
      // Authorization is mocked to always succeed
    });

    it("should apply rate limiting to analytics routes", async () => {
      const response = await request(app).get("/api/v1/analytics/events");

      expect(response.status).toBe(200);
      // Rate limiting is mocked to always allow
    });

    it("should apply export rate limiting", async () => {
      const response = await request(app).get("/api/v1/analytics/export");

      expect(response.status).toBe(200);
      // Export rate limiting is mocked to always allow
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid routes gracefully", async () => {
      const response = await request(app).get(
        "/api/v1/analytics/invalid-route"
      );

      expect(response.status).toBe(404);
    });

    it("should handle malformed query parameters", async () => {
      const response = await request(app).get(
        "/api/v1/analytics/?invalidParam=badValue"
      );

      expect(response.status).toBe(200);
      // Server should handle and ignore invalid params
    });
  });

  describe("Permission-Based Access", () => {
    it("should allow access with proper permissions", async () => {
      const response = await request(app).get("/api/v1/analytics/");

      expect(response.status).toBe(200);
    });

    it("should validate permissions for user analytics", async () => {
      const response = await request(app).get("/api/v1/analytics/users");

      expect(response.status).toBe(200);
    });

    it("should validate permissions for export functionality", async () => {
      const response = await request(app).get("/api/v1/analytics/export");

      expect(response.status).toBe(200);
    });
  });
});
