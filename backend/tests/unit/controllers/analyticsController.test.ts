import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import { AnalyticsController } from "../../../src/controllers/analyticsController";
import { User, Event, Registration } from "../../../src/models";
import { hasPermission, PERMISSIONS } from "../../../src/utils/roleUtils";
import { ResponseBuilderService } from "../../../src/services/ResponseBuilderService";
import { CachePatterns } from "../../../src/services";
import * as XLSX from "xlsx";

// Mock dependencies
vi.mock("../../../src/models", () => ({
  User: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
  },
  Event: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
  },
  Registration: {
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

vi.mock("../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildAnalyticsEventData: vi.fn(),
  },
}));

vi.mock("../../../src/services", () => ({
  CachePatterns: {
    getAnalyticsData: vi.fn(),
  },
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: vi.fn(),
    aoa_to_sheet: vi.fn(),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(),
}));

// Test helpers
type RequestWithUser = Partial<Request> & { user?: any };
const createMockRequest = (user?: any, query?: any): RequestWithUser => ({
  user,
  query: query || {},
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
};

const mockUser = {
  id: "user123",
  role: "Administrator",
  username: "admin",
};

const mockUserWithoutPermission = {
  id: "user456",
  role: "Participant",
  username: "participant",
};

describe("AnalyticsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.error mock
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAnalytics", () => {
    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      const req = createMockRequest(mockUserWithoutPermission);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      expect(hasPermission).toHaveBeenCalledWith(
        mockUserWithoutPermission.role,
        PERMISSIONS.VIEW_SYSTEM_ANALYTICS
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to view analytics.",
      });
    });

    it("should return analytics data successfully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockAnalyticsData = {
        overview: {
          totalUsers: 100,
          totalEvents: 50,
          totalRegistrations: 200,
          activeUsers: 80,
          upcomingEvents: 15,
          recentRegistrations: 25,
        },
        growth: {
          userGrowthRate: 5.5,
          eventGrowthRate: 10.2,
          registrationGrowthRate: 15.8,
        },
      };

      vi.mocked(CachePatterns.getAnalyticsData).mockResolvedValue(
        mockAnalyticsData
      );

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      expect(CachePatterns.getAnalyticsData).toHaveBeenCalledWith(
        "system-overview",
        expect.any(Function)
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalyticsData,
      });
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(CachePatterns.getAnalyticsData).mockRejectedValue(
        new Error("Database connection failed")
      );

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      expect(console.error).toHaveBeenCalledWith(
        "Get analytics error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve analytics.",
      });
    });

    it("should execute database queries when cache callback is invoked", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Mock database responses
      vi.mocked(User.countDocuments).mockImplementation((query: any) => {
        if (query?.isActive && query?.lastLogin)
          return Promise.resolve(80) as any;
        if (query?.isActive) return Promise.resolve(100) as any;
        return Promise.resolve(100) as any;
      });

      vi.mocked(Event.countDocuments).mockImplementation((query: any) => {
        if (query?.date) return Promise.resolve(15) as any;
        return Promise.resolve(50) as any;
      });

      vi.mocked(Registration.countDocuments).mockImplementation(
        (query: any) => {
          if (query?.createdAt) return Promise.resolve(25) as any;
          return Promise.resolve(200) as any;
        }
      );

      // Mock the cache to call the callback function
      vi.mocked(CachePatterns.getAnalyticsData).mockImplementation(
        async (key, callback) => {
          return await callback();
        }
      );

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      // Verify all database queries were called
      expect(User.countDocuments).toHaveBeenCalledWith({ isActive: true });
      expect(User.countDocuments).toHaveBeenCalledWith({
        isActive: true,
        lastLogin: {
          $gte: expect.any(Date),
        },
      });
      expect(Event.countDocuments).toHaveBeenCalledWith();
      expect(Event.countDocuments).toHaveBeenCalledWith({
        date: { $gte: expect.any(Date) },
      });
      expect(Registration.countDocuments).toHaveBeenCalledWith();
      expect(Registration.countDocuments).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date),
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overview: expect.objectContaining({
            totalUsers: 100,
            totalEvents: 50,
            totalRegistrations: 200,
            activeUsers: 80,
            upcomingEvents: 15,
            recentRegistrations: 25,
          }),
          growth: expect.objectContaining({
            userGrowthRate: expect.any(Number),
            eventGrowthRate: expect.any(Number),
            registrationGrowthRate: expect.any(Number),
          }),
        }),
      });
    });

    it("should compute growth rates correctly from month-over-month counts", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Force cache layer to execute the provided callback to exercise calculateGrowthRate
      vi.mocked(CachePatterns.getAnalyticsData).mockImplementation(
        async (_key: string, cb: any) => {
          return await cb();
        }
      );

      // Users: last month 10, this month 15 -> 50%
      vi.mocked(User.countDocuments).mockImplementation((query: any) => {
        if (query?.isActive && query?.lastLogin)
          return Promise.resolve(80) as any; // active users
        if (query?.isActive) return Promise.resolve(100) as any; // total active users
        if (query?.createdAt && query.createdAt.$lt)
          return Promise.resolve(10) as any; // last month
        if (query?.createdAt) return Promise.resolve(15) as any; // this month
        return Promise.resolve(100) as any; // total users
      });

      // Events: last month 20, this month 20 -> 0%
      vi.mocked(Event.countDocuments).mockImplementation((query: any) => {
        if (query?.date?.$gte) return Promise.resolve(15) as any; // upcoming events
        if (query?.createdAt && query.createdAt.$lt)
          return Promise.resolve(20) as any; // last month
        if (query?.createdAt) return Promise.resolve(20) as any; // this month
        return Promise.resolve(50) as any; // total events
      });

      // Registrations: last month 0, this month 7 -> 100% edge case
      vi.mocked(Registration.countDocuments).mockImplementation(
        (query: any) => {
          if (query?.createdAt && query.createdAt.$lt)
            return Promise.resolve(0) as any; // last month
          if (query?.createdAt) return Promise.resolve(7) as any; // this month or recent registrations
          return Promise.resolve(200) as any; // total registrations
        }
      );

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonCalls = (res.json as any).mock.calls;
      const payload = (jsonCalls[jsonCalls.length - 1] || [])[0] as any;
      expect(payload?.success).toBe(true);
      expect(payload?.data?.growth?.userGrowthRate).toBeCloseTo(50);
      expect(payload?.data?.growth?.eventGrowthRate).toBeCloseTo(0);
      expect(payload?.data?.growth?.registrationGrowthRate).toBe(100);
    });
  });

  describe("getUserAnalytics", () => {
    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await AnalyticsController.getUserAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      const req = createMockRequest(mockUserWithoutPermission);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      await AnalyticsController.getUserAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to view user analytics.",
      });
    });

    it("should return user analytics data successfully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockUsersByRole = [
        { _id: "Administrator", count: 5 },
        { _id: "Participant", count: 95 },
      ];

      const mockUsersByAtCloudStatus = [
        { _id: true, count: 20 },
        { _id: false, count: 80 },
      ];

      const mockUsersByChurch = [
        { _id: "First Baptist", count: 30 },
        { _id: "Methodist Church", count: 25 },
      ];

      const mockRegistrationTrends = [
        { _id: { year: 2025, month: 1 }, count: 15 },
        { _id: { year: 2025, month: 2 }, count: 20 },
      ];

      vi.mocked(User.aggregate)
        .mockResolvedValueOnce(mockUsersByRole)
        .mockResolvedValueOnce(mockUsersByAtCloudStatus)
        .mockResolvedValueOnce(mockUsersByChurch)
        .mockResolvedValueOnce(mockRegistrationTrends);

      await AnalyticsController.getUserAnalytics(
        req as Request,
        res as Response
      );

      expect(User.aggregate).toHaveBeenCalledTimes(4);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          usersByRole: mockUsersByRole,
          usersByAtCloudStatus: mockUsersByAtCloudStatus,
          usersByChurch: mockUsersByChurch,
          registrationTrends: mockRegistrationTrends,
        },
      });
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(User.aggregate).mockRejectedValue(
        new Error("Aggregation failed")
      );

      await AnalyticsController.getUserAnalytics(
        req as Request,
        res as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Get user analytics error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve user analytics.",
      });
    });
  });

  describe("getEventAnalytics", () => {
    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await AnalyticsController.getEventAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      const req = createMockRequest(mockUserWithoutPermission);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      await AnalyticsController.getEventAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to view event analytics.",
      });
    });

    it("should return event analytics data successfully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockEventsByType = [
        { _id: "Effective Communication Workshop", count: 15 },
      ];
      const mockEventsByFormat = [{ _id: "In-Person", count: 10 }];
      const mockRegistrationStats = [
        { _id: "Effective Communication Workshop", totalRegistrations: 50 },
      ];
      const mockEventTrends = [{ _id: { year: 2025, month: 8 }, count: 5 }];

      vi.mocked(Event.aggregate)
        .mockResolvedValueOnce(mockEventsByType)
        .mockResolvedValueOnce(mockEventsByFormat)
        .mockResolvedValueOnce(mockEventTrends);

      vi.mocked(Registration.aggregate).mockResolvedValue(
        mockRegistrationStats
      );

      const mockUpcomingEvents = [{ id: "event1", title: "Workshop 1" }];
      const mockCompletedEvents = [{ id: "event2", title: "Workshop 2" }];

      // Mock Event.find calls
      const mockEventQuery = {
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn(),
      };

      vi.mocked(Event.find)
        .mockReturnValueOnce({
          ...mockEventQuery,
          lean: vi
            .fn()
            .mockResolvedValue([{ _id: "event1", title: "Workshop 1" }]),
        } as any)
        .mockReturnValueOnce({
          ...mockEventQuery,
          lean: vi
            .fn()
            .mockResolvedValue([{ _id: "event2", title: "Workshop 2" }]),
        } as any);

      vi.mocked(ResponseBuilderService.buildAnalyticsEventData)
        .mockResolvedValueOnce(mockUpcomingEvents as any)
        .mockResolvedValueOnce(mockCompletedEvents as any);

      await AnalyticsController.getEventAnalytics(
        req as Request,
        res as Response
      );

      expect(Event.aggregate).toHaveBeenCalledTimes(3);
      expect(Registration.aggregate).toHaveBeenCalledTimes(1);
      expect(Event.find).toHaveBeenCalledTimes(2);
      expect(
        ResponseBuilderService.buildAnalyticsEventData
      ).toHaveBeenCalledTimes(2);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          eventsByType: mockEventsByType,
          eventsByFormat: mockEventsByFormat,
          registrationStats: mockRegistrationStats,
          eventTrends: mockEventTrends,
          upcomingEvents: mockUpcomingEvents,
          completedEvents: mockCompletedEvents,
        },
      });
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(Event.aggregate).mockRejectedValue(
        new Error("Event aggregation failed")
      );

      await AnalyticsController.getEventAnalytics(
        req as Request,
        res as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Get event analytics error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve event analytics.",
      });
    });
  });

  describe("getEngagementAnalytics", () => {
    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await AnalyticsController.getEngagementAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      const req = createMockRequest(mockUserWithoutPermission);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      await AnalyticsController.getEngagementAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to view engagement analytics.",
      });
    });

    it("should return engagement analytics data successfully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockParticipationRates = {
        averageParticipationRate: 0.75,
        totalEvents: 20,
      };

      const mockUserActivity = [
        { _id: { year: 2025, month: 8, day: 7 }, count: 15 },
      ];

      vi.mocked(Event.aggregate).mockResolvedValue([mockParticipationRates]);
      vi.mocked(User.aggregate).mockResolvedValue(mockUserActivity);

      await AnalyticsController.getEngagementAnalytics(
        req as Request,
        res as Response
      );

      expect(Event.aggregate).toHaveBeenCalledTimes(1);
      expect(User.aggregate).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          participationRates: mockParticipationRates,
          userActivity: mockUserActivity,
        },
      });
    });

    it("should handle empty participation rates gracefully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockUserActivity = [
        { _id: { year: 2025, month: 8, day: 7 }, count: 15 },
      ];

      vi.mocked(Event.aggregate).mockResolvedValue([]);
      vi.mocked(User.aggregate).mockResolvedValue(mockUserActivity);

      await AnalyticsController.getEngagementAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          participationRates: {
            averageParticipationRate: 0,
            totalEvents: 0,
          },
          userActivity: mockUserActivity,
        },
      });
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(Event.aggregate).mockRejectedValue(
        new Error("Engagement query failed")
      );

      await AnalyticsController.getEngagementAnalytics(
        req as Request,
        res as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Get engagement analytics error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve engagement analytics.",
      });
    });
  });

  describe("exportAnalytics", () => {
    const mockAnalyticsData = {
      users: [
        { username: "user1", firstName: "John", role: "Participant" },
        { username: "user2", firstName: "Jane", role: "Administrator" },
      ],
      events: [
        {
          title: "Workshop 1",
          type: "Effective Communication Workshop",
          date: "2025-08-10",
        },
        { title: "Conference 1", type: "Conference", date: "2025-08-15" },
      ],
      registrations: [
        { userId: "user1", eventId: "event1", status: "confirmed" },
        { userId: "user2", eventId: "event2", status: "pending" },
      ],
    };

    beforeEach(() => {
      // Mock lean() queries for export data
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockAnalyticsData.users),
      };

      vi.mocked(User.find).mockReturnValue(mockUserQuery as any);

      const mockEventQuery = {
        lean: vi.fn().mockResolvedValue(mockAnalyticsData.events),
      };

      vi.mocked(Event.find).mockReturnValue(mockEventQuery as any);

      const mockRegistrationQuery = {
        lean: vi.fn().mockResolvedValue(mockAnalyticsData.registrations),
      };

      vi.mocked(Registration.find).mockReturnValue(
        mockRegistrationQuery as any
      );
    });

    it("should require authentication", async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should require proper permissions", async () => {
      const req = createMockRequest(mockUserWithoutPermission);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(false);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Insufficient permissions to export analytics.",
      });
    });

    it("should export data in JSON format by default", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/json"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        "attachment; filename=analytics.json"
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"users"'));
    });

    it("should export data in CSV format when requested", async () => {
      const req = createMockRequest(mockUser, { format: "csv" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        "attachment; filename=analytics.csv"
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Users,2"));
    });

    it("should export data in XLSX format when requested", async () => {
      const req = createMockRequest(mockUser, { format: "xlsx" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockWorkbook = { Sheets: {}, SheetNames: [] };
      const mockWorksheet = {};
      const mockBuffer = Buffer.from("mock xlsx data");

      vi.mocked(XLSX.utils.book_new).mockReturnValue(mockWorkbook as any);
      vi.mocked(XLSX.utils.aoa_to_sheet).mockReturnValue(mockWorksheet);
      vi.mocked(XLSX.write).mockReturnValue(mockBuffer);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledTimes(4); // Overview, Users, Events, Registrations
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(4);
      expect(XLSX.write).toHaveBeenCalledWith(mockWorkbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        "attachment; filename=analytics.xlsx"
      );
      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it("should format createdAt and registrationDate in XLSX export", async () => {
      const req = createMockRequest(mockUser, { format: "xlsx" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Override find() mocks for this test to include createdAt/registrationDate
      const mockEventQuery = {
        lean: vi.fn().mockResolvedValue([
          {
            title: "Event A",
            type: "Workshop",
            date: "2025-08-10",
            location: "Hall 1",
            format: "Online",
            status: "completed",
            createdAt: new Date("2025-08-01T00:00:00Z").toISOString(),
          },
        ]),
      };
      vi.mocked(Event.find).mockReturnValueOnce(mockEventQuery as any);

      const mockRegistrationQuery = {
        lean: vi.fn().mockResolvedValue([
          {
            userId: "u1",
            eventId: "e1",
            roleId: "r1",
            status: "confirmed",
            registrationDate: new Date("2025-08-02T00:00:00Z").toISOString(),
          },
        ]),
      };
      vi.mocked(Registration.find).mockReturnValueOnce(
        mockRegistrationQuery as any
      );

      const mockWorkbook = { Sheets: {}, SheetNames: [] };
      const mockWorksheet = {};
      const mockBuffer = Buffer.from("mock xlsx data");

      vi.mocked(XLSX.utils.book_new).mockReturnValue(mockWorkbook as any);
      vi.mocked(XLSX.utils.aoa_to_sheet).mockReturnValue(mockWorksheet);
      vi.mocked(XLSX.write).mockReturnValue(mockBuffer);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      // aoa_to_sheet is called 4 times: Overview, Users, Events, Registrations
      const calls = (XLSX.utils.aoa_to_sheet as any).mock.calls as any[];
      expect(calls.length).toBeGreaterThanOrEqual(4);

      const eventsData = calls[2][0];
      const regsData = calls[3][0];

      // Row 0 is headers; row 1 is first data row
      const eventRow = eventsData[1];
      const regRow = regsData[1];

      // Created Date column should be a non-empty, formatted string
      expect(typeof eventRow[6]).toBe("string");
      expect(eventRow[6].length).toBeGreaterThan(0);

      // Registration Date should be formatted string as well
      expect(typeof regRow[4]).toBe("string");
      expect(regRow[4].length).toBeGreaterThan(0);
    });

    it("should format user.createdAt in XLSX users sheet and leave blank when missing", async () => {
      const req = createMockRequest(mockUser, { format: "xlsx" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Override find() mocks to include users with and without createdAt
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            username: "u1",
            firstName: "Alice",
            lastName: "A",
            role: "Participant",
            isAtCloudLeader: false,
            createdAt: new Date("2025-08-03T00:00:00Z").toISOString(),
          },
          {
            username: "u2",
            firstName: "Bob",
            lastName: "B",
            role: "Administrator",
            isAtCloudLeader: true,
            // createdAt intentionally missing
          },
        ]),
      };
      vi.mocked(User.find).mockReturnValueOnce(mockUserQuery as any);

      // Keep events/registrations minimal to reach XLSX logic
      const mockEventQuery = {
        lean: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValueOnce(mockEventQuery as any);

      const mockRegistrationQuery = {
        lean: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Registration.find).mockReturnValueOnce(
        mockRegistrationQuery as any
      );

      const mockWorkbook = { Sheets: {}, SheetNames: [] };
      const mockWorksheet = {};
      const mockBuffer = Buffer.from("mock xlsx data");

      vi.mocked(XLSX.utils.book_new).mockReturnValue(mockWorkbook as any);
      vi.mocked(XLSX.utils.aoa_to_sheet).mockReturnValue(mockWorksheet);
      vi.mocked(XLSX.write).mockReturnValue(mockBuffer);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      // Calls: Overview (0), Users (1), Events (2), Registrations (3)
      const calls = (XLSX.utils.aoa_to_sheet as any).mock.calls as any[];
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const usersData = calls[1][0];
      const userRow1 = usersData[1];
      const userRow2 = usersData[2];

      // Join Date column index in users sheet is 5 (0-based: Username, First, Last, Role, Leader, Join Date)
      expect(typeof userRow1[5]).toBe("string");
      expect(userRow1[5].length).toBeGreaterThan(0);

      // Missing createdAt should render empty string
      expect(userRow2[5]).toBe("");
    });

    it("should render empty strings for missing first/last names in XLSX users sheet", async () => {
      const req = createMockRequest(mockUser, { format: "xlsx" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            username: "u3",
            role: "Participant",
            isAtCloudLeader: false,
            // firstName and lastName intentionally omitted
          },
        ]),
      };
      vi.mocked(User.find).mockReturnValueOnce(mockUserQuery as any);

      const mockEventQuery = { lean: vi.fn().mockResolvedValue([]) };
      vi.mocked(Event.find).mockReturnValueOnce(mockEventQuery as any);

      const mockRegistrationQuery = { lean: vi.fn().mockResolvedValue([]) };
      vi.mocked(Registration.find).mockReturnValueOnce(
        mockRegistrationQuery as any
      );

      const mockWorkbook = { Sheets: {}, SheetNames: [] };
      const mockWorksheet = {};
      const mockBuffer = Buffer.from("mock xlsx data");

      vi.mocked(XLSX.utils.book_new).mockReturnValue(mockWorkbook as any);
      vi.mocked(XLSX.utils.aoa_to_sheet).mockReturnValue(mockWorksheet);
      vi.mocked(XLSX.write).mockReturnValue(mockBuffer);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      const calls = (XLSX.utils.aoa_to_sheet as any).mock.calls as any[];
      const usersData = calls[1][0];
      const row = usersData[1];

      // Username, First, Last, Role, Leader, Join Date
      expect(row[0]).toBe("u3");
      expect(row[1]).toBe("");
      expect(row[2]).toBe("");
      expect(row[3]).toBe("Participant");
      expect(row[4]).toBe("No");
    });

    it("should handle unsupported format", async () => {
      const req = createMockRequest(mockUser, { format: "pdf" });
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Unsupported format. Use 'json', 'csv', or 'xlsx'.",
      });
    });

    it("should handle database errors gracefully", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(User.find).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockRejectedValue(new Error("Database error")),
      } as any);

      await AnalyticsController.exportAnalytics(
        req as Request,
        res as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Export analytics error:",
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to export analytics.",
      });
    });
  });

  describe("getAnalytics growth rate edge cases", () => {
    it("should return 0% when last month is 0 and this month is 0", async () => {
      const req = createMockRequest(mockUser);
      const res = createMockResponse();

      vi.mocked(hasPermission).mockReturnValue(true);

      // Force execution of the callback to run calculateGrowthRate
      vi.mocked(CachePatterns.getAnalyticsData).mockImplementation(
        async (_key: string, cb: any) => cb()
      );

      // Mock baseline overview queries
      vi.mocked(User.countDocuments).mockImplementation((query: any) => {
        if (query?.isActive && query?.lastLogin)
          return Promise.resolve(0) as any;
        if (query?.isActive) return Promise.resolve(0) as any;
        if (query?.createdAt && query.createdAt.$lt)
          return Promise.resolve(1) as any; // for user growth last month
        if (query?.createdAt) return Promise.resolve(2) as any; // for user growth this month
        return Promise.resolve(0) as any;
      });

      vi.mocked(Event.countDocuments).mockImplementation((query: any) => {
        if (query?.date) return Promise.resolve(0) as any;
        if (query?.createdAt && query.createdAt.$lt)
          return Promise.resolve(0) as any; // events last month
        if (query?.createdAt) return Promise.resolve(0) as any; // events this month
        return Promise.resolve(0) as any;
      });

      vi.mocked(Registration.countDocuments).mockImplementation(
        (query: any) => {
          if (query?.createdAt && query.createdAt.$lt)
            return Promise.resolve(5) as any; // registrations last month
          if (query?.createdAt) return Promise.resolve(10) as any; // registrations this month
          return Promise.resolve(0) as any;
        }
      );

      await AnalyticsController.getAnalytics(req as Request, res as Response);

      const payload = (res.json as any).mock.calls.at(-1)[0];
      expect(payload.success).toBe(true);
      // Users growth uses 1 -> 2 (100%), Events growth uses 0 -> 0 (0%), Registrations uses 5 -> 10 (100%)
      expect(payload.data.growth.userGrowthRate).toBeCloseTo(100);
      expect(payload.data.growth.eventGrowthRate).toBe(0);
      expect(payload.data.growth.registrationGrowthRate).toBeCloseTo(100);
    });
  });
});
