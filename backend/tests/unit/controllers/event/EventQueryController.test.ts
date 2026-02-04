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
        role: "admin",
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
  });
});
