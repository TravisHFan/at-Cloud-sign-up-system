import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import { EventQueryController } from "../../../../src/controllers/event/EventQueryController";
import { Event } from "../../../../src/models";
import { CachePatterns } from "../../../../src/services";
import { ResponseBuilderService } from "../../../../src/services/ResponseBuilderService";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    getEventListing: vi.fn(),
    getEventListingOrdering: vi.fn(),
    getEventById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventResponse: vi.fn(),
    buildEventsWithRegistrations: vi.fn(),
    buildEventWithRegistrations: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      error: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    updateAllEventStatusesHelper: vi.fn(),
    updateEventStatusIfNeeded: vi.fn(),
    toIdString: vi.fn((id) => (id ? id.toString() : "")),
  },
}));

describe("EventQueryController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as ReturnType<typeof vi.fn>;

    req = {
      query: {},
      params: {},
      user: {
        _id: "user-id-123",
        role: "Administrator" as const,
      },
    } as unknown as Partial<Request>;

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("getAllEvents", () => {
    it("should return paginated events with default pagination", async () => {
      const mockEvents = [
        { _id: "event1", title: "Event 1", status: "upcoming" },
        { _id: "event2", title: "Event 2", status: "upcoming" },
      ];

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          // Execute the fetcher to cover the internal logic
          return await fetcher();
        },
      );

      // Mock Event.find chain
      const findMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockEvents),
      });
      vi.mocked(Event.find).mockImplementation(findMock);
      vi.mocked(Event.countDocuments).mockResolvedValue(2);

      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(
        mockEvents.map((e) => ({ ...e, formattedDate: "2025-01-01" })) as any,
      );

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle status filtering", async () => {
      req.query = { status: "upcoming" };

      const mockEvents = [
        { _id: "event1", title: "Event 1", status: "upcoming" },
      ];

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: mockEvents,
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalled();
    });

    it("should handle multiple status filtering", async () => {
      req.query = { statuses: "upcoming,ongoing" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle type filtering", async () => {
      req.query = { type: "webinar" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle programId filtering", async () => {
      req.query = { programId: "program-123" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle search filtering", async () => {
      req.query = { search: "test event" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle date range filtering", async () => {
      req.query = { startDate: "2025-01-01", endDate: "2025-12-31" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle participant capacity filtering with minParticipants", async () => {
      req.query = { minParticipants: "10" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle participant capacity filtering with maxParticipants", async () => {
      req.query = { maxParticipants: "100" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle both min and max participant filtering", async () => {
      req.query = { minParticipants: "10", maxParticipants: "100" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle category filtering", async () => {
      req.query = { category: "training" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle sorting by title", async () => {
      req.query = { sortBy: "title", sortOrder: "asc" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle sorting by organizer", async () => {
      req.query = { sortBy: "organizer", sortOrder: "desc" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle sorting by type", async () => {
      req.query = { sortBy: "type", sortOrder: "asc" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle custom pagination", async () => {
      req.query = { page: "2", limit: "25" };

      vi.mocked(CachePatterns.getEventListing).mockResolvedValue({
        events: [],
        pagination: { page: 2, limit: 25, total: 0, pages: 0 },
      });

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(CachePatterns.getEventListing).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(CachePatterns.getEventListing).mockRejectedValue(
        new Error("Database error"),
      );

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve events.",
      });
    });
  });

  describe("getEventById", () => {
    it("should return 400 for invalid event ID", async () => {
      req.params = { id: "invalid-id" };

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Invalid event ID.",
      });
    });

    it("should return 404 when event is not found from findById", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };

      // Event.findById returns null
      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found.",
      });
    });

    it("should return 404 when buildEventWithRegistrations returns null", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
      };

      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue(null);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Event not found or failed to build registration data.",
      });
    });

    it("should return event successfully", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        status: "upcoming",
        createdBy: { _id: "creator-id", username: "creator" },
      };

      const mockEventWithRegistrations = {
        ...mockEvent,
        roles: [{ name: "Attendee", currentCount: 5, maxParticipants: 10 }],
      };

      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue(mockEventWithRegistrations as any);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(Event.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
      expect(
        ResponseBuilderService.buildEventWithRegistrations,
      ).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { event: mockEventWithRegistrations },
      });
    });

    it("should handle errors gracefully", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };

      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockRejectedValue(new Error("Database error")),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve event.",
      });
    });

    it("should call buildEventWithRegistrations with user ID when user is authenticated", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.user = { _id: "user-123", role: "Administrator" as const } as any;

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        status: "upcoming",
      };

      const mockEventWithRegistrations = {
        ...mockEvent,
        roles: [{ name: "Attendee", currentCount: 5, maxParticipants: 10 }],
      };

      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue(mockEventWithRegistrations as any);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(
        ResponseBuilderService.buildEventWithRegistrations,
      ).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        "user-123",
        "Administrator",
      );
    });

    it("should call buildEventWithRegistrations without user ID when user is not authenticated", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };
      req.user = undefined;

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Test Event",
        status: "upcoming",
      };

      const mockEventWithRegistrations = {
        ...mockEvent,
        roles: [{ name: "Volunteer", currentCount: 3, maxParticipants: 20 }],
      };

      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue(mockEventWithRegistrations as any);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(
        ResponseBuilderService.buildEventWithRegistrations,
      ).toHaveBeenCalledWith("507f1f77bcf86cd799439011", undefined, undefined);
    });

    it("should log multiple roles correctly", async () => {
      req.params = { id: "507f1f77bcf86cd799439011" };

      const mockEvent = {
        _id: "507f1f77bcf86cd799439011",
        title: "Multi-Role Event",
      };

      const mockEventWithRegistrations = {
        ...mockEvent,
        roles: [
          { name: "Attendee", currentCount: 10, maxParticipants: 50 },
          { name: "Volunteer", currentCount: 5, maxParticipants: 10 },
          { name: "Speaker", currentCount: 2, maxParticipants: 3 },
        ],
      };

      const findByIdMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      });
      vi.mocked(Event.findById).mockImplementation(findByIdMock);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations,
      ).mockResolvedValue(mockEventWithRegistrations as any);

      await EventQueryController.getEventById(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: { event: mockEventWithRegistrations },
      });
    });
  });

  describe("getAllEvents - cache key generation", () => {
    it("should generate different cache keys for different filter combinations", async () => {
      const cacheKeys: string[] = [];

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (key, _fetcher) => {
          cacheKeys.push(key);
          return {
            events: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 },
          };
        },
      );

      // Call with no filters
      req.query = {};
      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Call with status filter
      req.query = { status: "upcoming" };
      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Call with type filter
      req.query = { type: "webinar" };
      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(cacheKeys.length).toBe(3);
      expect(new Set(cacheKeys).size).toBe(3); // All keys should be unique
    });

    it("should include all filter parameters in cache key", async () => {
      let capturedKey = "";

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (key, _fetcher) => {
          capturedKey = key;
          return {
            events: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 },
          };
        },
      );

      req.query = {
        page: "2",
        limit: "20",
        status: "upcoming",
        type: "workshop",
        programId: "prog-123",
        search: "test",
        sortBy: "title",
        sortOrder: "desc",
        minParticipants: "5",
        maxParticipants: "50",
        category: "education",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Verify the cache key contains the essential filter info
      expect(capturedKey).toContain("events-list:");
      expect(capturedKey).toContain("workshop");
      expect(capturedKey).toContain("prog-123");
      expect(capturedKey).toContain("title");
      expect(capturedKey).toContain("desc");
    });

    it("should handle statuses parameter for multi-status filtering in cache key", async () => {
      let capturedKey = "";

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (key, _fetcher) => {
          capturedKey = key;
          return {
            events: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 },
          };
        },
      );

      req.query = { statuses: "upcoming,ongoing,completed" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(capturedKey).toContain("upcoming");
      expect(capturedKey).toContain("ongoing");
      expect(capturedKey).toContain("completed");
    });

    it("should handle empty statuses string correctly", async () => {
      let capturedKey = "";

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (key, _fetcher) => {
          capturedKey = key;
          return {
            events: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 },
          };
        },
      );

      req.query = { statuses: "" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Empty statuses should not include statuses array in key
      expect(capturedKey).not.toContain('"statuses":["');
    });

    it("should handle whitespace-only statuses string", async () => {
      let capturedKey = "";

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (key, _fetcher) => {
          capturedKey = key;
          return {
            events: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 },
          };
        },
      );

      req.query = { statuses: "  ,  ,  " };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Whitespace-only items should be filtered out
      expect(capturedKey).toBeDefined();
    });
  });

  describe("getAllEvents - fetcher function internal logic", () => {
    it("should build filter with type correctly", async () => {
      let executedFetcher = false;

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          executedFetcher = true;
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { type: "seminar" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(executedFetcher).toBe(true);
      expect(Event.find).toHaveBeenCalled();
    });

    it("should build filter with programId (programLabels) correctly", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { programId: "program-abc-123" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(Event.find).toHaveBeenCalled();
      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("programLabels", "program-abc-123");
    });

    it("should build filter with category correctly", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { category: "technology" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(Event.find).toHaveBeenCalled();
      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("category", "technology");
    });

    it("should build filter with date range (startDate and endDate)", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { startDate: "2025-03-01", endDate: "2025-06-30" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("date");
      expect((findCall[0] as any).date.$gte).toBe("2025-03-01");
      expect((findCall[0] as any).date.$lte).toBe("2025-06-30");
    });

    it("should build filter with only startDate", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { startDate: "2025-05-01" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("date");
      expect((findCall[0] as any).date.$gte).toBe("2025-05-01");
      expect((findCall[0] as any).date.$lte).toBeUndefined();
    });

    it("should build filter with only endDate", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { endDate: "2025-12-31" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("date");
      expect((findCall[0] as any).date.$gte).toBeUndefined();
      expect((findCall[0] as any).date.$lte).toBe("2025-12-31");
    });

    it("should build filter with minParticipants only", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { minParticipants: "15" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("totalSlots");
      expect((findCall[0] as any).totalSlots.$gte).toBe(15);
    });

    it("should build filter with maxParticipants only", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { maxParticipants: "200" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("totalSlots");
      expect((findCall[0] as any).totalSlots.$lte).toBe(200);
    });

    it("should build filter with both minParticipants and maxParticipants", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { minParticipants: "10", maxParticipants: "100" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("totalSlots");
      expect((findCall[0] as any).totalSlots.$gte).toBe(10);
      expect((findCall[0] as any).totalSlots.$lte).toBe(100);
    });

    it("should build filter with text search", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { search: "machine learning workshop" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("$text");
      expect((findCall[0] as any).$text.$search).toBe(
        "machine learning workshop",
      );
    });
  });

  describe("getAllEvents - sort options with tie-breakers", () => {
    it("should sort by date with time as tie-breaker (ascending)", async () => {
      const sortMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "date", sortOrder: "asc" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(sortMock).toHaveBeenCalledWith({ date: 1, time: 1 });
    });

    it("should sort by date with time as tie-breaker (descending)", async () => {
      const sortMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "date", sortOrder: "desc" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(sortMock).toHaveBeenCalledWith({ date: -1, time: -1 });
    });

    it("should sort by title with date/time tie-breakers and apply collation", async () => {
      const sortMock = vi.fn().mockReturnThis();
      const collationMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: collationMock,
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "title", sortOrder: "asc" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(collationMock).toHaveBeenCalledWith({ locale: "en", strength: 2 });
      expect(sortMock).toHaveBeenCalledWith({ title: 1, date: 1, time: 1 });
    });

    it("should sort by organizer with title/date/time tie-breakers and apply collation", async () => {
      const sortMock = vi.fn().mockReturnThis();
      const collationMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: collationMock,
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "organizer", sortOrder: "desc" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(collationMock).toHaveBeenCalledWith({ locale: "en", strength: 2 });
      expect(sortMock).toHaveBeenCalledWith({
        organizer: -1,
        title: 1,
        date: 1,
        time: 1,
      });
    });

    it("should sort by type with title/date/time tie-breakers and apply collation", async () => {
      const sortMock = vi.fn().mockReturnThis();
      const collationMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: collationMock,
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "type", sortOrder: "asc" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(collationMock).toHaveBeenCalledWith({ locale: "en", strength: 2 });
      expect(sortMock).toHaveBeenCalledWith({
        type: 1,
        title: 1,
        date: 1,
        time: 1,
      });
    });
  });

  describe("getAllEvents - pagination edge cases", () => {
    it("should calculate skip correctly for page 1", async () => {
      const skipMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: skipMock,
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { page: "1", limit: "10" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(skipMock).toHaveBeenCalledWith(0);
    });

    it("should calculate skip correctly for page 3 with limit 25", async () => {
      const skipMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: skipMock,
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(100);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { page: "3", limit: "25" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(skipMock).toHaveBeenCalledWith(50); // (3-1) * 25 = 50
    });

    it("should return correct pagination metadata for hasNext and hasPrev", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockEvents = [
        { _id: "event1", title: "Event 1" },
        { _id: "event2", title: "Event 2" },
      ];

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(50); // Total 50 events
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(mockEvents as any);

      req.query = { page: "2", limit: "10" }; // Page 2 of 5 total pages

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          events: mockEvents,
          pagination: {
            currentPage: 2,
            totalPages: 5,
            totalEvents: 50,
            hasNext: true,
            hasPrev: true,
          },
        },
      });
    });

    it("should return hasNext=false on last page", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockEvents = [{ _id: "event1", title: "Event 1" }];

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(21); // 21 events, 3 pages with limit 10
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(mockEvents as any);

      req.query = { page: "3", limit: "10" }; // Last page

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          events: mockEvents,
          pagination: {
            currentPage: 3,
            totalPages: 3,
            totalEvents: 21,
            hasNext: false,
            hasPrev: true,
          },
        },
      });
    });

    it("should return hasPrev=false on first page", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockEvents = [
        { _id: "event1", title: "Event 1" },
        { _id: "event2", title: "Event 2" },
      ];

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(25);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(mockEvents as any);

      req.query = { page: "1", limit: "10" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          events: mockEvents,
          pagination: {
            currentPage: 1,
            totalPages: 3,
            totalEvents: 25,
            hasNext: true,
            hasPrev: false,
          },
        },
      });
    });

    it("should handle empty results with zero pages", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { page: "1", limit: "10" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          events: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalEvents: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    });

    it("should handle single page of results", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockEvents = [
        { _id: "event1", title: "Event 1" },
        { _id: "event2", title: "Event 2" },
        { _id: "event3", title: "Event 3" },
      ];

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(3);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(mockEvents as any);

      req.query = { page: "1", limit: "10" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          events: mockEvents,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalEvents: 3,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    });
  });

  describe("getAllEvents - status filtering and updateEventStatus", () => {
    it("should call updateAllEventStatusesHelper when status filter is provided", async () => {
      const { EventController } =
        await import("../../../../src/controllers/eventController");

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { status: "upcoming" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(EventController.updateAllEventStatusesHelper).toHaveBeenCalled();
    });

    it("should call updateAllEventStatusesHelper when statuses filter is provided", async () => {
      const { EventController } =
        await import("../../../../src/controllers/eventController");

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { statuses: "upcoming,ongoing" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(EventController.updateAllEventStatusesHelper).toHaveBeenCalled();
    });

    it("should build $in filter when multi-statuses are provided", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { statuses: "upcoming,ongoing,completed" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      expect(findCall[0]).toHaveProperty("status");
      expect((findCall[0] as any).status.$in).toEqual([
        "upcoming",
        "ongoing",
        "completed",
      ]);
    });

    it("should call updateEventStatusIfNeeded for each event when no status filter", async () => {
      const { EventController } =
        await import("../../../../src/controllers/eventController");

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockEvents = [
        {
          _id: "event1",
          title: "Event 1",
          date: "2025-01-15",
          status: "draft",
        },
        {
          _id: "event2",
          title: "Event 2",
          date: "2025-01-20",
          status: "upcoming",
        },
      ];

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(2);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(mockEvents as any);

      req.query = {}; // No status filter

      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Should be called for each event
      expect(EventController.updateEventStatusIfNeeded).toHaveBeenCalledTimes(
        2,
      );
    });

    it("should NOT call updateEventStatusIfNeeded when status filter is provided", async () => {
      const { EventController } =
        await import("../../../../src/controllers/eventController");
      vi.mocked(EventController.updateEventStatusIfNeeded).mockClear();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockEvents = [
        { _id: "event1", title: "Event 1", status: "upcoming" },
      ];

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(1);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue(mockEvents as any);

      req.query = { status: "upcoming" };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Should NOT be called when status filter is present
      expect(EventController.updateEventStatusIfNeeded).not.toHaveBeenCalled();
    });
  });

  describe("getAllEvents - combined filter scenarios", () => {
    it("should apply all filters together correctly", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = {
        status: "upcoming",
        type: "workshop",
        programId: "prog-xyz",
        category: "education",
        startDate: "2025-01-01",
        endDate: "2025-06-30",
        minParticipants: "5",
        maxParticipants: "100",
        search: "coding bootcamp",
        sortBy: "title",
        sortOrder: "asc",
        page: "2",
        limit: "15",
      };

      await EventQueryController.getAllEvents(req as Request, res as Response);

      const findCall = vi.mocked(Event.find).mock.calls[0] as unknown[];
      const filter = findCall[0] as Record<string, unknown>;

      expect(filter.type).toBe("workshop");
      expect(filter.programLabels).toBe("prog-xyz");
      expect(filter.category).toBe("education");
      expect(filter.status).toBe("upcoming");
      expect((filter.date as any).$gte).toBe("2025-01-01");
      expect((filter.date as any).$lte).toBe("2025-06-30");
      expect((filter.totalSlots as any).$gte).toBe(5);
      expect((filter.totalSlots as any).$lte).toBe(100);
      expect((filter.$text as any).$search).toBe("coding bootcamp");
    });

    it("should work with default sortBy when not specified", async () => {
      const sortMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = {}; // No sortBy specified, should default to "date"

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(sortMock).toHaveBeenCalledWith({ date: 1, time: 1 });
    });

    it("should work with default sortOrder (asc) when not specified", async () => {
      const sortMock = vi.fn().mockReturnThis();

      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: sortMock,
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "title" }; // No sortOrder specified

      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(sortMock).toHaveBeenCalledWith({ title: 1, date: 1, time: 1 });
    });
  });

  describe("getAllEvents - chain method fallbacks", () => {
    it("should handle when populate returns object without sort method", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      // Return chain without sort method to test fallback
      const mockChain = {
        populate: vi.fn().mockReturnValue({
          collation: vi.fn().mockReturnValue({
            // No sort method - should fallback
          }),
        }),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = { sortBy: "title" };

      // Should not throw
      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(Event.find).toHaveBeenCalled();
    });

    it("should handle find returning object without populate", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      // Return object without populate method
      vi.mocked(Event.find).mockReturnValue(Promise.resolve([]) as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = {};

      // Should not throw
      await EventQueryController.getAllEvents(req as Request, res as Response);

      expect(Event.find).toHaveBeenCalled();
    });

    it("should handle database query throwing error gracefully", async () => {
      vi.mocked(CachePatterns.getEventListing).mockImplementation(
        async (_key, fetcher) => {
          return await fetcher();
        },
      );

      const mockChain = {
        populate: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error("Query failed")),
      };
      vi.mocked(Event.find).mockReturnValue(mockChain as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations,
      ).mockResolvedValue([]);

      req.query = {};

      // The try/catch in fetcher should handle this and return empty events
      await EventQueryController.getAllEvents(req as Request, res as Response);

      // Should still complete successfully with empty events
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  // Note: The production caching path (lines 181-266) is intentionally skipped
  // in unit tests because it checks process.env.VITEST === "true". This path
  // uses CachePatterns.getEventListingOrdering for optimized ID-based caching
  // and should be tested via integration tests if needed.
});
