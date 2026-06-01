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
    aggregate: vi.fn(),
  },
  Registration: {
    countDocuments: vi.fn(),
    distinct: vi.fn(),
    aggregate: vi.fn(),
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
import { User, Event, Registration } from "../../../../src/models";

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
          "system-overview-v2",
          expect.any(Function)
        );
      });

      it("should build enriched overview data from lightweight aggregate queries", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(CachePatterns.getAnalyticsData).mockImplementation(
          async (_key, factory) => factory()
        );

        vi.mocked(User.countDocuments)
          .mockResolvedValueOnce(100)
          .mockResolvedValueOnce(75)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(15);
        vi.mocked(Event.countDocuments)
          .mockResolvedValueOnce(50)
          .mockResolvedValueOnce(18)
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(10);
        vi.mocked(Registration.countDocuments)
          .mockResolvedValueOnce(200)
          .mockResolvedValueOnce(30)
          .mockResolvedValueOnce(14)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(7);
        vi.mocked(Registration.distinct).mockResolvedValue(["u1", "u2"]);
        vi.mocked(Event.aggregate)
          .mockResolvedValueOnce([{ totalSlots: 40, filledSlots: 20 }])
          .mockResolvedValueOnce([{ count: 2 }])
          .mockResolvedValueOnce([
            {
              id: "event-1",
              title: "Leadership Night",
              date: "2026-01-02",
              type: "Meeting",
              status: "completed",
              registrations: 32,
              totalSlots: 40,
              signupRate: 80,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "program-1",
              title: "EMBA",
              programType: "EMBA Mentor Circles",
              registrations: 28,
              events: 4,
            },
          ]);
        vi.mocked(Registration.aggregate)
          .mockResolvedValueOnce([{ registered: 10, recorded: 8, attended: 6 }])
          .mockResolvedValueOnce([{ count: 1 }])
          .mockResolvedValueOnce([{ count: 5 }])
          .mockResolvedValueOnce([
            {
              id: "registration-1",
              firstName: "Ann",
              lastName: "Lee",
              eventTitle: "Leadership Night",
              eventDate: "2026-01-02",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ]);

        await OverviewAnalyticsController.getAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            overview: {
              totalUsers: 100,
              totalEvents: 50,
              completedEvents: 18,
              totalRegistrations: 200,
              activeParticipants: 2,
              averageSignupRate: 50,
              activeUsers: 75,
              upcomingEvents: 10,
              recentRegistrations: 30,
            },
            growth: {
              userGrowthRate: 50,
              eventGrowthRate: -50,
              registrationGrowthRate: 100,
            },
            last30Days: {
              newUsers: 6,
              newEvents: 3,
              registrations: 14,
              attendanceCompletionRate: 80,
              attendanceRate: 75,
            },
            needsAttention: {
              lowSignupUpcomingEvents: 2,
              completedEventsMissingAttendance: 1,
              unrecordedAttendance: 5,
              waitlistedRegistrations: 3,
            },
            topEvents: [
              {
                id: "event-1",
                title: "Leadership Night",
                date: "2026-01-02",
                type: "Meeting",
                status: "completed",
                registrations: 32,
                totalSlots: 40,
                signupRate: 80,
              },
            ],
            topPrograms: [
              {
                id: "program-1",
                title: "EMBA",
                programType: "EMBA Mentor Circles",
                registrations: 28,
                events: 4,
              },
            ],
            recentActivity: [
              {
                id: "registration-1",
                type: "registration",
                person: "Ann Lee",
                eventTitle: "Leadership Night",
                eventDate: "2026-01-02",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        });
        expect(Event.aggregate).toHaveBeenCalledTimes(4);
        expect(Registration.aggregate).toHaveBeenCalledTimes(4);
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
