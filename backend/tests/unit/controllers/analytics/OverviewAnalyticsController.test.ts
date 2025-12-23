import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import OverviewAnalyticsController from "../../../../src/controllers/analytics/OverviewAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  User: {
    countDocuments: vi.fn(),
  },
  Event: {
    countDocuments: vi.fn(),
  },
  Registration: {
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    getAnalyticsData: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

import { hasPermission } from "../../../../src/utils/roleUtils";
import { CachePatterns } from "../../../../src/services";

interface MockRequest {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("OverviewAnalyticsController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    mockReq = {
      query: {},
      user: {
        _id: "admin123",
        id: "admin123",
        role: "Administrator",
        email: "admin@test.com",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getAnalytics", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("Authorization", () => {
      it("should return 403 if user lacks permission", async () => {
        vi.mocked(hasPermission).mockReturnValue(false);

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Insufficient permissions to view analytics.",
        });
      });

      it("should allow access with proper permissions", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(CachePatterns.getAnalyticsData).mockResolvedValue({
          overview: {
            totalUsers: 100,
            totalEvents: 50,
            totalRegistrations: 200,
            activeUsers: 75,
            upcomingEvents: 10,
            recentRegistrations: 30,
          },
          growth: {
            userGrowthRate: 10,
            eventGrowthRate: 5,
            registrationGrowthRate: 15,
          },
        });

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return analytics data from cache", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        const mockAnalytics = {
          overview: {
            totalUsers: 100,
            totalEvents: 50,
            totalRegistrations: 200,
            activeUsers: 75,
            upcomingEvents: 10,
            recentRegistrations: 30,
          },
          growth: {
            userGrowthRate: 10,
            eventGrowthRate: 5,
            registrationGrowthRate: 15,
          },
        };
        vi.mocked(CachePatterns.getAnalyticsData).mockResolvedValue(
          mockAnalytics
        );

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockAnalytics,
        });
      });

      it("should call CachePatterns.getAnalyticsData with correct key", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(CachePatterns.getAnalyticsData).mockResolvedValue({
          overview: {},
          growth: {},
        });

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(CachePatterns.getAnalyticsData).toHaveBeenCalledWith(
          "system-overview",
          expect.any(Function)
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on cache error", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(CachePatterns.getAnalyticsData).mockRejectedValue(
          new Error("Cache error")
        );

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve analytics.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
