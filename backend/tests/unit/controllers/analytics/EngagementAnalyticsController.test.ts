import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import EngagementAnalyticsController from "../../../../src/controllers/analytics/EngagementAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  User: {
    aggregate: vi.fn(),
  },
  Event: {
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

import { User, Event } from "../../../../src/models";
import { hasPermission } from "../../../../src/utils/roleUtils";

interface MockRequest {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("EngagementAnalyticsController", () => {
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

  describe("getEngagementAnalytics", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await EngagementAnalyticsController.getEngagementAnalytics(
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

        await EngagementAnalyticsController.getEngagementAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Insufficient permissions to view engagement analytics.",
        });
      });

      it("should allow access with proper permissions", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockResolvedValue([]);
        vi.mocked(User.aggregate).mockResolvedValue([]);

        await EngagementAnalyticsController.getEngagementAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return engagement analytics with empty data", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockResolvedValue([]);
        vi.mocked(User.aggregate).mockResolvedValue([]);

        await EngagementAnalyticsController.getEngagementAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.participationRates).toEqual({
          averageParticipationRate: 0,
          totalEvents: 0,
        });
        expect(response.data.userActivity).toEqual([]);
      });

      it("should return participation rates from Event aggregate", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockResolvedValue([
          { averageParticipationRate: 0.75, totalEvents: 10 },
        ]);
        vi.mocked(User.aggregate).mockResolvedValue([]);

        await EngagementAnalyticsController.getEngagementAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.participationRates).toEqual({
          averageParticipationRate: 0.75,
          totalEvents: 10,
        });
      });

      it("should return user activity data", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockResolvedValue([]);
        vi.mocked(User.aggregate).mockResolvedValue([
          { _id: { year: 2024, month: 12, day: 1 }, count: 15 },
          { _id: { year: 2024, month: 12, day: 2 }, count: 20 },
        ]);

        await EngagementAnalyticsController.getEngagementAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.userActivity).toHaveLength(2);
        expect(response.data.userActivity[0].count).toBe(15);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockRejectedValue(
          new Error("Database error")
        );

        await EngagementAnalyticsController.getEngagementAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve engagement analytics.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
