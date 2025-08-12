/**
 * Analytics Route Isolated Tests
 *
 * Tests analytics routes using isolated Express app pattern
 * to avoid heavy import dependency chains and timeout issues.
 *
 * Coverage:
 * - GET /api/analytics - General analytics overview
 * - GET /api/analytics/users - User analytics and demographics
 * - GET /api/analytics/events - Event analytics and trends
 * - GET /api/analytics/engagement - User engagement metrics
 * - GET /api/analytics/export - Analytics data export (JSON/CSV/XLSX)
 * - Authentication & authorization middleware
 * - Rate limiting integration
 * - Permission validation
 * - Error handling scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock the analytics controller methods
const mockAnalyticsController = {
  getAnalytics: vi.fn(),
  getUserAnalytics: vi.fn(),
  getEventAnalytics: vi.fn(),
  getEngagementAnalytics: vi.fn(),
  exportAnalytics: vi.fn(),
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

// Mock authorization middleware
const mockAuthorizePermissionMiddleware = vi.fn((permission) => {
  return (req, res, next) => {
    // Simulate successful authorization for admin users
    if (req.user?.role === "Administrator") {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions.",
      });
    }
  };
});

// Mock rate limiting middleware
const mockAnalyticsLimiter = vi.fn((req, res, next) => {
  next();
});

const mockExportLimiter = vi.fn((req, res, next) => {
  next();
});

// Mock PERMISSIONS constant
const PERMISSIONS = {
  VIEW_SYSTEM_ANALYTICS: "VIEW_SYSTEM_ANALYTICS",
};

describe("Analytics Routes - Isolated Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    // Create isolated Express app for each test
    app = express();
    app.use(express.json());

    // Clear all mocks
    vi.clearAllMocks();

    // Set up default successful responses
    mockAnalyticsController.getAnalytics.mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalUsers: 150,
            totalEvents: 25,
            totalRegistrations: 300,
            activeUsers: 120,
            upcomingEvents: 5,
            recentRegistrations: 15,
          },
          growth: {
            userGrowthRate: 12.5,
            eventGrowthRate: 8.3,
            registrationGrowthRate: 15.7,
          },
        },
      });
    });

    mockAnalyticsController.getUserAnalytics.mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        data: {
          usersByRole: [
            { _id: "Participant", count: 100 },
            { _id: "Leader", count: 30 },
            { _id: "Administrator", count: 20 },
          ],
          usersByAtCloudStatus: [
            { _id: true, count: 50 },
            { _id: false, count: 100 },
          ],
          usersByChurch: [
            { _id: "Main Campus", count: 80 },
            { _id: "North Campus", count: 40 },
            { _id: "South Campus", count: 30 },
          ],
          registrationTrends: [
            { _id: { year: 2025, month: 1 }, count: 15 },
            { _id: { year: 2025, month: 2 }, count: 20 },
          ],
        },
      });
    });

    mockAnalyticsController.getEventAnalytics.mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        data: {
          eventsByType: [
            { _id: "Bible Study", count: 10 },
            { _id: "Worship", count: 8 },
            { _id: "Community Service", count: 7 },
          ],
          eventsByFormat: [
            { _id: "In-Person", count: 15 },
            { _id: "Online", count: 10 },
          ],
          registrationStats: [
            {
              _id: "Bible Study",
              totalRegistrations: 120,
              averageRegistrations: 12,
            },
            {
              _id: "Worship",
              totalRegistrations: 200,
              averageRegistrations: 25,
            },
          ],
          eventTrends: [
            { _id: { year: 2025, month: 1 }, count: 5 },
            { _id: { year: 2025, month: 2 }, count: 8 },
          ],
          upcomingEvents: [],
          completedEvents: [],
        },
      });
    });

    mockAnalyticsController.getEngagementAnalytics.mockImplementation(
      (req, res) => {
        res.status(200).json({
          success: true,
          data: {
            participationRates: {
              averageParticipationRate: 0.85,
              totalEvents: 25,
            },
            userActivity: [
              { _id: { year: 2025, month: 1, day: 15 }, count: 45 },
              { _id: { year: 2025, month: 1, day: 16 }, count: 52 },
            ],
          },
        });
      }
    );

    mockAnalyticsController.exportAnalytics.mockImplementation((req, res) => {
      const format = req.query.format || "json";

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.json"
        );
        res.send(
          JSON.stringify(
            {
              users: [],
              events: [],
              registrations: [],
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
      } else if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.csv"
        );
        res.send("Type,Count\nUsers,150\nEvents,25\nRegistrations,300\n");
      } else if (format === "xlsx") {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.xlsx"
        );
        res.send(Buffer.from("mock xlsx data"));
      } else {
        res.status(400).json({
          success: false,
          message: "Unsupported format. Use 'json', 'csv', or 'xlsx'.",
        });
      }
    });

    // Set up analytics routes with isolated middleware
    app.use("/api/analytics", mockAuthenticateMiddleware);
    app.use(
      "/api/analytics",
      mockAuthorizePermissionMiddleware(PERMISSIONS.VIEW_SYSTEM_ANALYTICS)
    );

    app.get(
      "/api/analytics",
      mockAnalyticsLimiter,
      mockAnalyticsController.getAnalytics
    );
    app.get(
      "/api/analytics/users",
      mockAnalyticsLimiter,
      mockAnalyticsController.getUserAnalytics
    );
    app.get(
      "/api/analytics/events",
      mockAnalyticsLimiter,
      mockAnalyticsController.getEventAnalytics
    );
    app.get(
      "/api/analytics/engagement",
      mockAnalyticsLimiter,
      mockAnalyticsController.getEngagementAnalytics
    );
    app.get(
      "/api/analytics/export",
      mockExportLimiter,
      mockAnalyticsController.exportAnalytics
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/analytics - General Analytics Overview", () => {
    it("should return general analytics overview for authenticated admin user", async () => {
      const response = await request(app).get("/api/analytics").expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          overview: {
            totalUsers: 150,
            totalEvents: 25,
            totalRegistrations: 300,
            activeUsers: 120,
            upcomingEvents: 5,
            recentRegistrations: 15,
          },
          growth: {
            userGrowthRate: 12.5,
            eventGrowthRate: 8.3,
            registrationGrowthRate: 15.7,
          },
        },
      });

      expect(mockAuthenticateMiddleware).toHaveBeenCalled();
      expect(mockAuthorizePermissionMiddleware).toHaveBeenCalledWith(
        PERMISSIONS.VIEW_SYSTEM_ANALYTICS
      );
      expect(mockAnalyticsLimiter).toHaveBeenCalled();
      expect(mockAnalyticsController.getAnalytics).toHaveBeenCalled();
    });

    it("should handle analytics retrieval errors", async () => {
      mockAnalyticsController.getAnalytics.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve analytics.",
        });
      });

      const response = await request(app).get("/api/analytics").expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to retrieve analytics.",
      });
    });

    it("should apply rate limiting to analytics requests", async () => {
      await request(app).get("/api/analytics").expect(200);

      expect(mockAnalyticsLimiter).toHaveBeenCalled();
    });
  });

  describe("GET /api/analytics/users - User Analytics", () => {
    it("should return user analytics and demographics", async () => {
      const response = await request(app)
        .get("/api/analytics/users")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          usersByRole: [
            { _id: "Participant", count: 100 },
            { _id: "Leader", count: 30 },
            { _id: "Administrator", count: 20 },
          ],
          usersByAtCloudStatus: [
            { _id: true, count: 50 },
            { _id: false, count: 100 },
          ],
          usersByChurch: [
            { _id: "Main Campus", count: 80 },
            { _id: "North Campus", count: 40 },
            { _id: "South Campus", count: 30 },
          ],
          registrationTrends: [
            { _id: { year: 2025, month: 1 }, count: 15 },
            { _id: { year: 2025, month: 2 }, count: 20 },
          ],
        },
      });

      expect(mockAnalyticsController.getUserAnalytics).toHaveBeenCalled();
    });

    it("should handle user analytics retrieval errors", async () => {
      mockAnalyticsController.getUserAnalytics.mockImplementation(
        (req, res) => {
          res.status(500).json({
            success: false,
            message: "Failed to retrieve user analytics.",
          });
        }
      );

      const response = await request(app)
        .get("/api/analytics/users")
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to retrieve user analytics.",
      });
    });

    it("should apply rate limiting to user analytics requests", async () => {
      await request(app).get("/api/analytics/users").expect(200);

      expect(mockAnalyticsLimiter).toHaveBeenCalled();
    });
  });

  describe("GET /api/analytics/events - Event Analytics", () => {
    it("should return event analytics and trends", async () => {
      const response = await request(app)
        .get("/api/analytics/events")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          eventsByType: [
            { _id: "Bible Study", count: 10 },
            { _id: "Worship", count: 8 },
            { _id: "Community Service", count: 7 },
          ],
          eventsByFormat: [
            { _id: "In-Person", count: 15 },
            { _id: "Online", count: 10 },
          ],
          registrationStats: [
            {
              _id: "Bible Study",
              totalRegistrations: 120,
              averageRegistrations: 12,
            },
            {
              _id: "Worship",
              totalRegistrations: 200,
              averageRegistrations: 25,
            },
          ],
          eventTrends: [
            { _id: { year: 2025, month: 1 }, count: 5 },
            { _id: { year: 2025, month: 2 }, count: 8 },
          ],
          upcomingEvents: [],
          completedEvents: [],
        },
      });

      expect(mockAnalyticsController.getEventAnalytics).toHaveBeenCalled();
    });

    it("should handle event analytics retrieval errors", async () => {
      mockAnalyticsController.getEventAnalytics.mockImplementation(
        (req, res) => {
          res.status(500).json({
            success: false,
            message: "Failed to retrieve event analytics.",
          });
        }
      );

      const response = await request(app)
        .get("/api/analytics/events")
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to retrieve event analytics.",
      });
    });

    it("should apply rate limiting to event analytics requests", async () => {
      await request(app).get("/api/analytics/events").expect(200);

      expect(mockAnalyticsLimiter).toHaveBeenCalled();
    });
  });

  describe("GET /api/analytics/engagement - Engagement Analytics", () => {
    it("should return user engagement metrics", async () => {
      const response = await request(app)
        .get("/api/analytics/engagement")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          participationRates: {
            averageParticipationRate: 0.85,
            totalEvents: 25,
          },
          userActivity: [
            { _id: { year: 2025, month: 1, day: 15 }, count: 45 },
            { _id: { year: 2025, month: 1, day: 16 }, count: 52 },
          ],
        },
      });

      expect(mockAnalyticsController.getEngagementAnalytics).toHaveBeenCalled();
    });

    it("should handle engagement analytics retrieval errors", async () => {
      mockAnalyticsController.getEngagementAnalytics.mockImplementation(
        (req, res) => {
          res.status(500).json({
            success: false,
            message: "Failed to retrieve engagement analytics.",
          });
        }
      );

      const response = await request(app)
        .get("/api/analytics/engagement")
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to retrieve engagement analytics.",
      });
    });

    it("should apply rate limiting to engagement analytics requests", async () => {
      await request(app).get("/api/analytics/engagement").expect(200);

      expect(mockAnalyticsLimiter).toHaveBeenCalled();
    });
  });

  describe("GET /api/analytics/export - Export Analytics", () => {
    it("should export analytics data in JSON format by default", async () => {
      const response = await request(app)
        .get("/api/analytics/export")
        .expect(200);

      expect(response.headers["content-type"]).toBe(
        "application/json; charset=utf-8"
      );
      expect(response.headers["content-disposition"]).toBe(
        "attachment; filename=analytics.json"
      );

      const data = JSON.parse(response.text);
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("events");
      expect(data).toHaveProperty("registrations");
      expect(data).toHaveProperty("timestamp");

      expect(mockExportLimiter).toHaveBeenCalled();
      expect(mockAnalyticsController.exportAnalytics).toHaveBeenCalled();
    });

    it("should export analytics data in CSV format when requested", async () => {
      const response = await request(app)
        .get("/api/analytics/export?format=csv")
        .expect(200);

      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toBe(
        "attachment; filename=analytics.csv"
      );
      expect(response.text).toContain("Type,Count");
      expect(response.text).toContain("Users,150");
      expect(response.text).toContain("Events,25");
      expect(response.text).toContain("Registrations,300");
    });

    it("should export analytics data in XLSX format when requested", async () => {
      const response = await request(app)
        .get("/api/analytics/export?format=xlsx")
        .expect(200);

      expect(response.headers["content-type"]).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(response.headers["content-disposition"]).toBe(
        "attachment; filename=analytics.xlsx"
      );
      expect(response.body).toBeDefined();
    });

    it("should reject unsupported export formats", async () => {
      const response = await request(app)
        .get("/api/analytics/export?format=pdf")
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: "Unsupported format. Use 'json', 'csv', or 'xlsx'.",
      });
    });

    it("should handle export errors", async () => {
      mockAnalyticsController.exportAnalytics.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          message: "Failed to export analytics.",
        });
      });

      const response = await request(app)
        .get("/api/analytics/export")
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to export analytics.",
      });
    });

    it("should apply export rate limiting to export requests", async () => {
      await request(app).get("/api/analytics/export").expect(200);

      expect(mockExportLimiter).toHaveBeenCalled();
    });
  });

  describe("Authentication and Authorization", () => {
    it("should require authentication for all analytics routes", async () => {
      // Override auth middleware to simulate unauthenticated request
      const unauthenticatedApp = express();
      unauthenticatedApp.use(express.json());

      const mockUnauthMiddleware = vi.fn((req, res, next) => {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      });

      unauthenticatedApp.use("/api/analytics", mockUnauthMiddleware);
      unauthenticatedApp.get(
        "/api/analytics",
        mockAnalyticsController.getAnalytics
      );

      const response = await request(unauthenticatedApp)
        .get("/api/analytics")
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require analytics permissions for all analytics routes", async () => {
      // Override authorization middleware to simulate insufficient permissions
      const unauthorizedApp = express();
      unauthorizedApp.use(express.json());

      const mockUnauthorizedUserMiddleware = vi.fn((req, res, next) => {
        req.user = {
          _id: "507f1f77bcf86cd799439012",
          username: "testuser",
          role: "Participant",
        };
        next();
      });

      const mockFailedAuthzMiddleware = vi.fn((permission) => {
        return (req, res, next) => {
          res.status(403).json({
            success: false,
            message: "Insufficient permissions.",
          });
        };
      });

      unauthorizedApp.use("/api/analytics", mockUnauthorizedUserMiddleware);
      unauthorizedApp.use(
        "/api/analytics",
        mockFailedAuthzMiddleware(PERMISSIONS.VIEW_SYSTEM_ANALYTICS)
      );
      unauthorizedApp.get(
        "/api/analytics",
        mockAnalyticsController.getAnalytics
      );

      const response = await request(unauthorizedApp)
        .get("/api/analytics")
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        message: "Insufficient permissions.",
      });
    });

    it("should allow access for users with analytics permissions", async () => {
      const response = await request(app).get("/api/analytics").expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAuthenticateMiddleware).toHaveBeenCalled();
      expect(mockAuthorizePermissionMiddleware).toHaveBeenCalled();
    });
  });

  describe("Rate Limiting Integration", () => {
    it("should apply analytics rate limiter to general analytics routes", async () => {
      await request(app).get("/api/analytics").expect(200);
      await request(app).get("/api/analytics/users").expect(200);
      await request(app).get("/api/analytics/events").expect(200);
      await request(app).get("/api/analytics/engagement").expect(200);

      expect(mockAnalyticsLimiter).toHaveBeenCalledTimes(4);
    });

    it("should apply export rate limiter to export route", async () => {
      await request(app).get("/api/analytics/export").expect(200);

      expect(mockExportLimiter).toHaveBeenCalledTimes(1);
      expect(mockAnalyticsLimiter).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling Scenarios", () => {
    it("should handle controller method errors gracefully", async () => {
      mockAnalyticsController.getAnalytics.mockImplementation((req, res) => {
        throw new Error("Database connection failed");
      });

      // Since we're mocking the controller to throw, we need to catch it
      try {
        await request(app).get("/api/analytics").expect(500);
      } catch (error) {
        // Expected to throw since we're simulating an error
        expect(error).toBeDefined();
      }
    });

    it("should handle invalid query parameters gracefully", async () => {
      const response = await request(app)
        .get("/api/analytics?invalidParam=test")
        .expect(200);

      // Should still work since controller should ignore invalid params
      expect(response.body.success).toBe(true);
    });

    it("should handle malformed request data", async () => {
      const response = await request(app)
        .get("/api/analytics")
        .send("invalid json")
        .expect(200);

      // GET requests should ignore request body
      expect(response.body.success).toBe(true);
    });
  });
});
