import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Response } from "express";
import EventAnalyticsController from "../../../../src/controllers/analytics/EventAnalyticsController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    aggregate: vi.fn(),
    find: vi.fn(),
  },
  Registration: {
    aggregate: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildAnalyticsEventData: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

import { Event, Registration } from "../../../../src/models";
import { hasPermission } from "../../../../src/utils/roleUtils";
import { ResponseBuilderService } from "../../../../src/services/ResponseBuilderService";

interface MockRequest {
  query: Record<string, string>;
  user?: {
    _id: string;
    id: string;
    role: string;
    email: string;
  };
}

describe("EventAnalyticsController", () => {
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

  describe("getEventAnalytics", () => {
    describe("Authentication", () => {
      it("should return 401 if user is not authenticated", async () => {
        mockReq.user = undefined;

        await EventAnalyticsController.getEventAnalytics(
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

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Insufficient permissions to view event analytics.",
        });
      });

      it("should allow access with proper permissions", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        setupEmptyMocks();

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Success", () => {
      it("should return analytics with empty data", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        setupEmptyMocks();

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toHaveProperty("eventsByType");
        expect(response.data).toHaveProperty("eventsByFormat");
        expect(response.data).toHaveProperty("registrationStats");
        expect(response.data).toHaveProperty("eventTrends");
        expect(response.data).toHaveProperty("upcomingEvents");
        expect(response.data).toHaveProperty("completedEvents");
      });

      it("should aggregate events by type", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate)
          .mockResolvedValueOnce([
            { _id: "Workshop", count: 5 },
            { _id: "Conference", count: 3 },
          ])
          .mockResolvedValueOnce([]) // eventsByFormat
          .mockResolvedValueOnce([]); // eventTrends

        vi.mocked(Registration.aggregate).mockResolvedValue([]);
        vi.mocked(Event.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.eventsByType).toEqual([
          { _id: "Workshop", count: 5 },
          { _id: "Conference", count: 3 },
        ]);
      });

      it("should aggregate events by format", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate)
          .mockResolvedValueOnce([]) // eventsByType
          .mockResolvedValueOnce([
            { _id: "Online", count: 10 },
            { _id: "In-person", count: 8 },
          ])
          .mockResolvedValueOnce([]); // eventTrends

        vi.mocked(Registration.aggregate).mockResolvedValue([]);
        vi.mocked(Event.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.eventsByFormat).toEqual([
          { _id: "Online", count: 10 },
          { _id: "In-person", count: 8 },
        ]);
      });

      it("should include registration stats", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockResolvedValue([]);
        vi.mocked(Registration.aggregate).mockResolvedValue([
          { _id: "Workshop", totalRegistrations: 50, averageRegistrations: 10 },
        ]);
        vi.mocked(Event.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.registrationStats).toEqual([
          { _id: "Workshop", totalRegistrations: 50, averageRegistrations: 10 },
        ]);
      });

      it("should use ResponseBuilderService for event data", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockResolvedValue([]);
        vi.mocked(Registration.aggregate).mockResolvedValue([]);
        vi.mocked(Event.find).mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        } as any);
        vi.mocked(
          ResponseBuilderService.buildAnalyticsEventData
        ).mockResolvedValue([{ id: "event1", title: "Test Event" }] as any);

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(
          ResponseBuilderService.buildAnalyticsEventData
        ).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Event.aggregate).mockRejectedValue(
          new Error("Database error")
        );

        await EventAnalyticsController.getEventAnalytics(
          mockReq as any,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve event analytics.",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });

  // Helper function to set up empty mocks
  function setupEmptyMocks() {
    vi.mocked(Event.aggregate).mockResolvedValue([]);
    vi.mocked(Registration.aggregate).mockResolvedValue([]);
    vi.mocked(Event.find).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as any);
  }
});
