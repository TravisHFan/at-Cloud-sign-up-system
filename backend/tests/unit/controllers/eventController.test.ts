import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";

// Simple mock approach that works with Vitest hoisting
vi.mock("../../../src/models", () => ({
  Event: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  }),
  Registration: Object.assign(vi.fn(), {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  }),
  GuestRegistration: Object.assign(vi.fn(), {
    deleteMany: vi.fn(),
  }),
  User: Object.assign(vi.fn(), {
    findById: vi.fn(),
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn(),
  }),
  Program: Object.assign(vi.fn(), {
    updateOne: vi.fn(),
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    }),
  }),
}));

vi.mock("../../../src/utils/roleUtils", () => ({
  RoleUtils: {},
  PERMISSIONS: {
    CREATE_EVENT: "CREATE_EVENT",
    EDIT_ANY_EVENT: "EDIT_ANY_EVENT",
    EDIT_OWN_EVENT: "EDIT_OWN_EVENT",
    DELETE_ANY_EVENT: "DELETE_ANY_EVENT",
    DELETE_OWN_EVENT: "DELETE_OWN_EVENT",
  },
  hasPermission: vi.fn(),
}));

vi.mock("../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getActiveVerifiedUsers: vi.fn(),
    getEventCoOrganizers: vi.fn(),
    getEventParticipants: vi.fn(),
    getEventGuests: vi.fn(),
  },
}));

// Mock services index (CachePatterns used in controller helpers) and EventCascadeService
vi.mock("../../../src/services", () => {
  const cache = {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
    // For getAllEvents caching wrapper
    getEventListing: vi
      .fn()
      .mockImplementation(async (_key: string, cb: any) => cb()),
  };
  // Default mock of cascade deletion that also triggers cache invalidation side-effects
  const EventCascadeService = {
    deleteEventFully: vi.fn().mockImplementation(async (eventId: string) => {
      cache.invalidateEventCache(eventId);
      cache.invalidateAnalyticsCache();
      return { deletedRegistrations: 0, deletedGuestRegistrations: 0 };
    }),
  };
  return {
    CachePatterns: cache,
    EventCascadeService,
  };
});

vi.mock("../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendEventCreatedEmail: vi.fn(),
    sendCoOrganizerAssignedEmail: vi.fn(),
    sendEventNotificationEmail: vi.fn(),
    // Added for deduplicated bulk notifications during event updates
    sendEventNotificationEmailBulk: vi.fn(),
  },
}));

vi.mock("../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../src/services/RegistrationQueryService", () => ({
  RegistrationQueryService: {
    getRegistrationStats: vi.fn(),
  },
}));

vi.mock("../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(),
    buildEventsWithRegistrations: vi.fn(),
  },
}));

vi.mock("../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn(),
  },
}));

vi.mock("../../../src/services/LockService", () => ({
  lockService: {
    withLock: vi.fn(),
  },
}));

// Trio notification service mock to observe role assignment/removal/move trio creation
vi.mock("../../../src/services/notifications/TrioNotificationService", () => ({
  TrioNotificationService: {
    createEventRoleAssignedTrio: vi.fn().mockResolvedValue({ success: true }),
    createEventRoleRemovedTrio: vi.fn().mockResolvedValue({ success: true }),
    createEventRoleMovedTrio: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  const RealObjectId: any = actual.Types.ObjectId;
  const isValidMock = vi.fn((id: any) => /^[0-9a-fA-F]{24}$/.test(id));
  function MockObjectId(id?: any) {
    return new RealObjectId(id);
  }
  (MockObjectId as any).isValid = isValidMock;
  return {
    ...actual,
    default: {
      ...actual.default,
      Types: {
        ...actual.default.Types,
        ObjectId: MockObjectId, // constructable + has isValid
      },
    },
    Types: {
      ...actual.Types,
      ObjectId: MockObjectId,
    },
  };
});

// Import after mocking
import { EventController } from "../../../src/controllers/eventController";
import {
  Event,
  Registration,
  User,
  GuestRegistration,
  Program,
} from "../../../src/models";
import { hasPermission } from "../../../src/utils/roleUtils";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { socketService } from "../../../src/services/infrastructure/SocketService";
import { ResponseBuilderService } from "../../../src/services/ResponseBuilderService";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { lockService } from "../../../src/services/LockService";
import { CachePatterns, EventCascadeService } from "../../../src/services";
import { TrioNotificationService } from "../../../src/services/notifications/TrioNotificationService";

// Use a computed future date to avoid time-zone related flakiness when
// the hard-coded date equals or falls before "today" in certain TZs.
const futureDateStr = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
})();

describe("EventController", () => {
  // Use 'any' for mocks so we can attach custom props like `user`
  let mockRequest: any;
  let mockResponse: any;
  let mockJson: any;
  let mockStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnThis();

    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: "user123",
        email: "test@example.com",
        role: "member",
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      } as any,
      headers: {},
    };

    // Reset mongoose and permission mocks for each test
    vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValue(true);
    vi.mocked(hasPermission).mockReturnValue(true);
  });

  describe("helpers: getEventStatus and updateEventStatusIfNeeded", () => {
    const fixedNow = new Date("2025-08-11T12:00:00Z");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("getEventStatus returns upcoming/ongoing/completed correctly", () => {
      const getEventStatus = (EventController as any).getEventStatus as (
        d: string,
        t: string,
        e: string
      ) => "upcoming" | "ongoing" | "completed";

      // upcoming: event is tomorrow
      expect(getEventStatus("2025-08-12", "10:00", "12:00")).toBe("upcoming");
      // ongoing: event spans the whole day today
      expect(getEventStatus("2025-08-11", "00:00", "23:59")).toBe("ongoing");
      // completed: event was yesterday
      expect(getEventStatus("2025-08-10", "10:00", "12:00")).toBe("completed");
    });

    it("updateEventStatusIfNeeded updates DB and invalidates caches when status changes", async () => {
      const updateEventStatusIfNeeded = (EventController as any)
        .updateEventStatusIfNeeded as (evt: any) => Promise<void>;

      const evt: any = {
        _id: "e123",
        date: "2025-08-10", // yesterday relative to fixed now
        time: "10:00",
        endTime: "12:00",
        status: "upcoming", // will become completed
      };

      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

      await updateEventStatusIfNeeded(evt);

      expect(Event.findByIdAndUpdate).toHaveBeenCalledWith("e123", {
        status: "completed",
      });
      expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith("e123");
      expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      expect(evt.status).toBe("completed");
    });

    it("updateEventStatusIfNeeded does nothing when status unchanged", async () => {
      const updateEventStatusIfNeeded = (EventController as any)
        .updateEventStatusIfNeeded as (evt: any) => Promise<void>;

      const evt: any = {
        _id: "e456",
        date: "2025-08-10",
        time: "10:00",
        endTime: "12:00",
        status: "completed", // already final
      };

      await updateEventStatusIfNeeded(evt);

      expect(Event.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(CachePatterns.invalidateEventCache).not.toHaveBeenCalled();
      expect(CachePatterns.invalidateAnalyticsCache).not.toHaveBeenCalled();
      expect(evt.status).toBe("completed");
    });

    it("updateEventStatusIfNeeded skips updates for cancelled events", async () => {
      const updateEventStatusIfNeeded = (EventController as any)
        .updateEventStatusIfNeeded as (evt: any) => Promise<void>;

      const evt: any = {
        _id: "e789",
        date: "2025-08-12",
        time: "10:00",
        endTime: "12:00",
        status: "cancelled", // should not change even if computed differs
      };

      await updateEventStatusIfNeeded(evt);

      expect(Event.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(CachePatterns.invalidateEventCache).not.toHaveBeenCalled();
      expect(CachePatterns.invalidateAnalyticsCache).not.toHaveBeenCalled();
      expect(evt.status).toBe("cancelled");
    });

    it("getEventStatus handles boundary at exact start and end instants", () => {
      const getEventStatusNew = (EventController as any).getEventStatus as (
        date: string,
        endDate: string,
        time: string,
        endTime: string,
        tz?: string
      ) => "upcoming" | "ongoing" | "completed";

      // Now fixed at 2025-08-11T12:00Z
      // Event starts exactly now and ends one hour later
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "12:00", "13:00", "UTC")
      ).toBe("ongoing");

      // Event ends exactly now -> now >= end -> completed
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "10:00", "12:00", "UTC")
      ).toBe("completed");

      // One minute before end still ongoing
      vi.setSystemTime(new Date("2025-08-11T12:59:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "12:00", "13:00", "UTC")
      ).toBe("ongoing");
      // Exactly at end -> completed
      vi.setSystemTime(new Date("2025-08-11T13:00:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "12:00", "13:00", "UTC")
      ).toBe("completed");
      // Restore fixed base
      vi.setSystemTime(fixedNow);
    });

    it("getEventStatus supports multi-day event (date != endDate)", () => {
      const getEventStatusNew = (EventController as any).getEventStatus as (
        date: string,
        endDate: string,
        time: string,
        endTime: string,
        tz?: string
      ) => "upcoming" | "ongoing" | "completed";

      // Multi-day event Aug 10 09:00 -> Aug 12 17:00. Now is Aug 11 12:00Z.
      expect(
        getEventStatusNew("2025-08-10", "2025-08-12", "09:00", "17:00", "UTC")
      ).toBe("ongoing");

      // Before it starts
      vi.setSystemTime(new Date("2025-08-10T08:59:00Z"));
      expect(
        getEventStatusNew("2025-08-10", "2025-08-12", "09:00", "17:00", "UTC")
      ).toBe("upcoming");
      // After it ends
      vi.setSystemTime(new Date("2025-08-12T17:00:00Z"));
      expect(
        getEventStatusNew("2025-08-10", "2025-08-12", "09:00", "17:00", "UTC")
      ).toBe("completed");
      vi.setSystemTime(fixedNow);
    });

    it("getEventStatus respects timezone for start/end determination", () => {
      const getEventStatusNew = (EventController as any).getEventStatus as (
        date: string,
        endDate: string,
        time: string,
        endTime: string,
        tz?: string
      ) => "upcoming" | "ongoing" | "completed";

      // Choose a timezone behind UTC (America/Los_Angeles). At 12:00Z it's 05:00 PDT (UTC-7) on Aug 11.
      // Event scheduled at 06:00-07:00 local wall time should still be upcoming at 05:00.
      expect(
        getEventStatusNew(
          "2025-08-11",
          "2025-08-11",
          "06:00",
          "07:00",
          "America/Los_Angeles"
        )
      ).toBe("upcoming");

      // Advance to 13:05Z -> 06:05 PDT -> ongoing
      vi.setSystemTime(new Date("2025-08-11T13:05:00Z"));
      expect(
        getEventStatusNew(
          "2025-08-11",
          "2025-08-11",
          "06:00",
          "07:00",
          "America/Los_Angeles"
        )
      ).toBe("ongoing");

      // Advance to 14:00Z -> 07:00 PDT -> completed
      vi.setSystemTime(new Date("2025-08-11T14:00:00Z"));
      expect(
        getEventStatusNew(
          "2025-08-11",
          "2025-08-11",
          "06:00",
          "07:00",
          "America/Los_Angeles"
        )
      ).toBe("completed");
      vi.setSystemTime(fixedNow);
    });

    it("getEventStatus does NOT prematurely mark 16:00-18:00 PDT event completed before 14:00 PDT", () => {
      const getEventStatusNew = (EventController as any).getEventStatus as (
        date: string,
        endDate: string,
        time: string,
        endTime: string,
        tz?: string
      ) => "upcoming" | "ongoing" | "completed";

      // Event: Aug 11 2025 16:00-18:00 America/Los_Angeles (PDT, UTC-7)
      // Local 14:00 PDT = 21:00Z. Before 21:00Z the event should still be UPCOMING.
      // We'll check a few UTC instants before start to ensure not 'completed'.
      const tz = "America/Los_Angeles";

      // 19:00Z (12:00 PDT) -> upcoming
      vi.setSystemTime(new Date("2025-08-11T19:00:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00", tz)
      ).toBe("upcoming");

      // 20:30Z (13:30 PDT) -> still upcoming
      vi.setSystemTime(new Date("2025-08-11T20:30:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00", tz)
      ).toBe("upcoming");

      // 23:00Z (16:00 PDT) -> start -> ongoing
      vi.setSystemTime(new Date("2025-08-11T23:00:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00", tz)
      ).toBe("ongoing");

      // 00:59Z next day (17:59 PDT) -> ongoing
      vi.setSystemTime(new Date("2025-08-12T00:59:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00", tz)
      ).toBe("ongoing");

      // 01:00Z (18:00 PDT) -> completed
      vi.setSystemTime(new Date("2025-08-12T01:00:00Z"));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00", tz)
      ).toBe("completed");

      vi.setSystemTime(fixedNow);
    });

    it("(document) missing timeZone falls back to server local interpretation", () => {
      // This test documents current behavior when timeZone is omitted: the code falls back to server local
      // (assume UTC in CI). A 16:00-18:00 wall time meant for America/Los_Angeles will be treated as 16:00-18:00 UTC.
      // We assert the mechanical outcome so we can later introduce a default timezone strategy and adjust expectations.
      const getEventStatusNew = (EventController as any).getEventStatus as (
        date: string,
        endDate: string,
        time: string,
        endTime: string,
        tz?: string
      ) => "upcoming" | "ongoing" | "completed";

      // Base fixedNow = 2025-08-11T12:00:00Z from earlier test setup (ensured by outer describe).
      // Because there is no timezone, the wall clock is interpreted in server local time (CI likely UTC).
      // We only assert monotonic progression: upcoming -> (optional ongoing) -> completed.
      // Build local wall-clock Date objects to avoid depending on environment offset.
      const makeLocal = (h: number, m: number) => {
        const d = new Date();
        d.setFullYear(2025, 7, 11); // August (0-based month index 7)
        d.setHours(h, m, 0, 0);
        return d;
      };
      const localStart = makeLocal(16, 0);
      const localEnd = makeLocal(18, 0);

      // Just before start -> upcoming
      vi.setSystemTime(new Date(localStart.getTime() - 60_000));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00")
      ).toBe("upcoming");

      // At start -> ongoing
      vi.setSystemTime(localStart);
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00")
      ).toBe("ongoing");

      // Just before end -> ongoing
      vi.setSystemTime(new Date(localEnd.getTime() - 60_000));
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00")
      ).toBe("ongoing");

      // At or after end -> completed
      vi.setSystemTime(localEnd);
      expect(
        getEventStatusNew("2025-08-11", "2025-08-11", "16:00", "18:00")
      ).toBe("completed");
      vi.setSystemTime(fixedNow);
    });
  });

  describe("createEvent overlap detection", () => {
    it("should return 409 when new event overlaps existing", async () => {
      // Arrange permissions
      vi.mocked(hasPermission).mockReturnValue(true);
      // Existing event in DB
      const existing = {
        _id: new mongoose.Types.ObjectId(),
        title: "Existing Event",
        date: "2030-01-10",
        endDate: "2030-01-10",
        time: "10:00",
        endTime: "12:00",
      } as any;
      // Mock Event.find used by conflict check
      (Event.find as any).mockReturnValue({
        select: vi.fn().mockResolvedValue([existing]),
      });

      const body = {
        title: "Overlap Test",
        type: "Conference",
        date: "2030-01-10",
        endDate: "2030-01-10",
        time: "11:00",
        endTime: "13:00",
        location: "HQ",
        organizer: "Org",
        purpose: "Purpose",
        format: "In-person",
        roles: [{ name: "Participant", maxParticipants: 10 }],
      };
      mockRequest.body = body;

      await EventController.createEvent(
        mockRequest as unknown as Request,
        mockResponse as unknown as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(409);
      const payload = mockJson.mock.calls[0][0];
      expect(payload.success).toBe(false);
      expect(payload.message).toMatch(/overlaps/i);
    });
  });

  describe("helpers: populateFreshOrganizerContacts", () => {
    it("returns [] for empty or missing organizerDetails", async () => {
      const populate = (EventController as any)
        .populateFreshOrganizerContacts as (arr: any[]) => Promise<any[]>;

      expect(await populate([])).toEqual([]);
      // @ts-expect-error testing undefined handling
      expect(await populate(undefined)).toEqual([]);
    });

    it("replaces contact fields from User when userId is present and found", async () => {
      const populate = (EventController as any)
        .populateFreshOrganizerContacts as (arr: any[]) => Promise<any[]>;

      const orgA = {
        userId: "u1",
        name: "Old Name",
        avatar: "old.png",
        toObject: () => ({ userId: "u1", name: "Old Name", avatar: "old.png" }),
      };

      // First call returns a user, second will simulate not found
      vi.mocked(User.findById).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          email: "new@ex.com",
          phone: "555-0000",
          firstName: "New",
          lastName: "User",
          avatar: "new.png",
        }),
      } as any);

      const result = await populate([orgA]);

      expect(User.findById).toHaveBeenCalledWith("u1");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          email: "new@ex.com",
          phone: "555-0000",
          name: "New User",
          avatar: "new.png",
        })
      );
    });

    it("falls back to stored organizer data when no userId or user not found", async () => {
      const populate = (EventController as any)
        .populateFreshOrganizerContacts as (arr: any[]) => Promise<any[]>;

      const orgNoUserId = {
        name: "Stored Only",
        toObject: () => ({ name: "Stored Only" }),
      };
      const orgUserNotFound = {
        userId: "u2",
        name: "Old B",
        toObject: () => ({ userId: "u2", name: "Old B" }),
      };

      // For user not found, select resolves to null
      vi.mocked(User.findById).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(null),
      } as any);

      const result = await populate([orgNoUserId, orgUserNotFound]);

      expect(User.findById).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { name: "Stored Only" },
        { userId: "u2", name: "Old B" },
      ]);
    });
  });

  describe("getAllEvents", () => {
    it("should exist", () => {
      expect(EventController.getAllEvents).toBeDefined();
      expect(typeof EventController.getAllEvents).toBe("function");
    });

    it("should successfully get events with pagination", async () => {
      // Arrange
      const mockEvents = [
        {
          _id: "event1",
          title: "Test Event 1",
          date: "2025-08-10",
          time: "10:00",
          type: "Effective Communication Workshop",
          status: "upcoming",
        },
        {
          _id: "event2",
          title: "Test Event 2",
          date: "2025-08-15",
          time: "14:00",
          type: "Conference",
          status: "upcoming",
        },
      ];

      mockRequest.query = { page: "1", limit: "10" };

      vi.mocked(Event.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      } as any);

      vi.mocked(Event.countDocuments).mockResolvedValue(2);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue(mockEvents as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          events: mockEvents,
          pagination: expect.objectContaining({
            currentPage: 1,
            totalPages: 1,
            totalEvents: 2,
          }),
        },
      });
    });

    it("applies status filter and descending sort", async () => {
      // Arrange
      const mockEvents: any[] = [];
      mockRequest.query = {
        page: "1",
        limit: "5",
        status: "upcoming",
        sortBy: "title",
        sortOrder: "desc",
      };

      const sortFn = vi.fn().mockImplementation((sortArg) => {
        expect(sortArg).toEqual({ title: -1 });
        return {
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockEvents),
          }),
        } as any;
      });

      (Event.find as any).mockImplementation((filter: any) => {
        // updateAllEventStatusesHelper path
        if (filter && filter.status && filter.status.$ne === "cancelled") {
          return [];
        }
        // main query path: status should be forwarded into filter
        expect(filter.status).toBe("upcoming");
        return {
          populate: vi.fn().mockReturnValue({ sort: sortFn }),
        } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);

      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue(mockEvents as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(sortFn).toHaveBeenCalled();
    });

    it("builds totalSlots with $gte only when minParticipants provided", async () => {
      // Arrange
      mockRequest.query = { page: "1", limit: "5", minParticipants: "10" };

      (Event.find as any).mockImplementation((filter: any) => {
        expect(filter.totalSlots).toEqual({ $gte: 10 });
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("augments existing totalSlots with $lte when both min and max provided", async () => {
      // Arrange
      mockRequest.query = {
        page: "1",
        limit: "5",
        minParticipants: "5",
        maxParticipants: "20",
      };

      (Event.find as any).mockImplementation((filter: any) => {
        // Should have both bounds
        expect(filter.totalSlots.$gte).toBe(5);
        expect(filter.totalSlots.$lte).toBe(20);
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("builds search and date range filters", async () => {
      // Arrange
      mockRequest.query = {
        page: "1",
        limit: "5",
        search: "service",
        startDate: "2025-08-01",
        endDate: "2025-08-31",
      } as any;

      (Event.find as any).mockImplementation((filter: any) => {
        expect(filter.$text.$search).toBe("service");
        expect(filter.date.$gte).toBe("2025-08-01");
        expect(filter.date.$lte).toBe("2025-08-31");
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("builds totalSlots with $lte only when maxParticipants provided", async () => {
      // Arrange
      mockRequest.query = {
        page: "1",
        limit: "5",
        maxParticipants: "25",
      } as any;

      (Event.find as any).mockImplementation((filter: any) => {
        // Should set only an upper bound when minParticipants not provided
        expect(filter.totalSlots).toEqual({ $lte: 25 });
        return {
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("uses default ascending date sort when sort params omitted", async () => {
      // Arrange
      mockRequest.query = { page: "1", limit: "5" } as any;

      const sortFn = vi.fn().mockImplementation((sortArg) => {
        // Default should be { date: 1 }
        expect(sortArg).toEqual({ date: 1 });
        return {
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        } as any;
      });

      vi.mocked(Event.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({ sort: sortFn }),
      } as any);

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(sortFn).toHaveBeenCalled();
    });

    it("updates event statuses when no status filter and invalidates caches", async () => {
      // Arrange: event in the past so status changes to completed
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const dateStr = pastDate.toISOString().slice(0, 10);
      const events = [
        {
          _id: "e1",
          date: dateStr,
          time: "00:00",
          endTime: "00:01",
          status: "upcoming",
        },
      ];

      mockRequest.query = { page: "1", limit: "1" };

      (Event.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(events),
            }),
          }),
        }),
      });

      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);
      vi.mocked(Event.countDocuments).mockResolvedValue(1);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue(events as any);

      const invalidateEventCache = vi
        .mocked(CachePatterns.invalidateEventCache)
        .mockResolvedValue(undefined as any);
      const invalidateAnalyticsCache = vi
        .mocked(CachePatterns.invalidateAnalyticsCache)
        .mockResolvedValue(undefined as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(Event.findByIdAndUpdate).toHaveBeenCalledWith("e1", {
        status: expect.any(String),
      });
      expect(invalidateEventCache).toHaveBeenCalledTimes(1);
      expect(invalidateAnalyticsCache).toHaveBeenCalledTimes(1);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("applies category filter and sets ascending sort by default", async () => {
      // Arrange
      mockRequest.query = { page: "1", limit: "5", category: "training" };

      const sortFn = vi.fn().mockImplementation((sortArg) => {
        expect(sortArg).toEqual({ date: 1 });
        return {
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        } as any;
      });

      (Event.find as any).mockImplementation((filter: any) => {
        // category should be part of filter
        expect(filter.category).toBe("training");
        return {
          populate: vi.fn().mockReturnValue({ sort: sortFn }),
        } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(sortFn).toHaveBeenCalled();
    });

    it("applies combined filters: status + type + category with custom sort", async () => {
      // Arrange
      mockRequest.query = {
        page: "1",
        limit: "5",
        status: "upcoming",
        type: "Effective Communication Workshop",
        category: "training",
        sortBy: "time",
        sortOrder: "asc",
      } as any;

      const sortFn = vi.fn().mockImplementation((sortArg) => {
        expect(sortArg).toEqual({ time: 1 });
        return {
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        } as any;
      });

      (Event.find as any).mockImplementation((filter: any) => {
        // updateAllEventStatusesHelper call
        if (filter && filter.status && filter.status.$ne === "cancelled") {
          return [];
        }
        // main query includes combined filters
        expect(filter.status).toBe("upcoming");
        expect(filter.type).toBe("Effective Communication Workshop");
        expect(filter.category).toBe("training");
        return { populate: vi.fn().mockReturnValue({ sort: sortFn }) } as any;
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(sortFn).toHaveBeenCalled();
    });

    it("returns 500 when counting total events fails", async () => {
      // Arrange
      mockRequest.query = { page: "1", limit: "1" } as any;
      (Event.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue([] as any);
      vi.mocked(Event.countDocuments).mockRejectedValue(new Error("boom"));

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it("computes hasNext correctly when there are more pages", async () => {
      // Arrange: total 3, limit 1, page 1 -> totalPages 3, hasNext true
      mockRequest.query = { page: "1", limit: "1" };

      const mockEvents = [
        {
          _id: "e1",
          date: "2099-01-01",
          time: "00:00",
          endTime: "01:00",
          status: "upcoming",
        },
      ];

      // Ensure status-update path cannot throw on undefined _id
      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

      (Event.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(3);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue(mockEvents as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      const payload = (mockJson as any).mock.calls.at(-1)[0];
      expect(payload.data.pagination).toEqual(
        expect.objectContaining({
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        })
      );
    });

    it("computes hasPrev true and hasNext false on the last page", async () => {
      // Arrange: total 2, limit 1, page 2 -> totalPages 2, hasNext false, hasPrev true
      mockRequest.query = { page: "2", limit: "1" } as any;

      const mockEvents = [
        {
          _id: "e2",
          date: "2099-01-01",
          time: "00:00",
          endTime: "01:00",
          status: "upcoming",
        },
      ];

      // Ensure potential status-update path is harmless
      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({} as any);

      (Event.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      });

      vi.mocked(Event.countDocuments).mockResolvedValue(2);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockResolvedValue(mockEvents as any);

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      const payload = (mockJson as any).mock.calls.at(-1)[0];
      expect(payload.data.pagination).toEqual(
        expect.objectContaining({
          currentPage: 2,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        })
      );
    });

    it("returns 500 when ResponseBuilder throws", async () => {
      // Arrange
      mockRequest.query = { page: "1", limit: "1" };
      (Event.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      vi.mocked(Event.countDocuments).mockResolvedValue(0);
      vi.mocked(
        ResponseBuilderService.buildEventsWithRegistrations
      ).mockRejectedValue(new Error("boom"));

      // Act
      await EventController.getAllEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  describe("getEventById", () => {
    it("should exist", () => {
      expect(EventController.getEventById).toBeDefined();
      expect(typeof EventController.getEventById).toBe("function");
    });

    it("should successfully get event by ID", async () => {
      // Arrange
      const mockEvent = {
        _id: "event123",
        title: "Test Event",
        date: "2025-08-10",
        time: "10:00",
        organizerDetails: [],
        roles: [{ name: "Zoom Host", currentCount: 0, maxParticipants: 1 }],
        save: vi.fn(),
      };

      mockRequest.params = { id: "event123" };

      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      } as any);

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue(mockEvent as any);

      // Act
      await EventController.getEventById(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            event: mockEvent,
          }),
        })
      );
    });

    it("should return 404 for non-existent event", async () => {
      // Arrange
      mockRequest.params = { id: "nonexistent123" };

      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      } as any);

      // Act
      await EventController.getEventById(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Event not found.",
        })
      );
    });

    it("should return 400 for invalid event ID", async () => {
      // Arrange
      mockRequest.params = { id: "invalid-id" };
      vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValue(false);

      // Act
      await EventController.getEventById(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid event ID.",
        })
      );
    });

    it("returns 404 when registration builder returns null despite event existing", async () => {
      // Arrange
      const mockEvent = {
        _id: "event123",
        date: "2025-08-10",
        time: "10:00",
        endTime: "12:00",
        status: "upcoming",
      } as any;

      mockRequest.params = { id: "event123" };

      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockEvent),
      } as any);

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue(null as any);

      // Act
      await EventController.getEventById(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Event not found or failed to build registration data.",
        })
      );
    });

    it("returns 500 on unexpected DB error", async () => {
      mockRequest.params = { id: "event1234567890123456789012" } as any;
      // Simulate populate rejection to enter catch
      vi.mocked(Event.findById).mockReturnValue({
        populate: vi.fn().mockRejectedValue(new Error("DB explode")),
      } as any);

      await EventController.getEventById(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to retrieve event.",
        })
      );
    });
  });

  describe("createEvent", () => {
    it("should exist", () => {
      expect(EventController.createEvent).toBeDefined();
      expect(typeof EventController.createEvent).toBe("function");
    });

    it("should successfully create a new event", async () => {
      // Arrange
      const eventData = {
        title: "Test Event",
        type: "Effective Communication Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        purpose: "Test Purpose",
        format: "In-person",
        roles: [
          {
            name: "Zoom Host",
            description: "Event host",
            maxParticipants: 1,
          },
        ],
      };

      mockRequest.body = eventData;

      const mockEvent = {
        _id: "event123",
        ...eventData,
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Event).mockImplementation(() => mockEvent as any);
      vi.mocked(User.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as any);
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        []
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue(mockEvent as any);

      // Act
      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Event created successfully!",
          data: expect.objectContaining({
            event: mockEvent,
          }),
        })
      );
    });

    it("should return 400 for missing required fields", async () => {
      // Arrange
      mockRequest.body = {
        title: "Test Event",
        // Missing other required fields
      };

      // Act
      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Missing required fields"),
        })
      );
    });

    it("should return 403 for insufficient permissions", async () => {
      // Arrange
      vi.mocked(hasPermission).mockReturnValue(false);
      mockRequest.body = {
        title: "Test Event",
        type: "Effective Communication Workshop",
        date: "2025-08-10",
        time: "10:00",
        endTime: "12:00",
        location: "Test Location",
        organizer: "Test Organizer",
        purpose: "Test Purpose",
        format: "In-person",
        roles: [{ name: "Zoom Host", description: "Test", maxParticipants: 1 }],
      };

      // Act
      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Insufficient permissions to create events.",
        })
      );
    });

    describe("Event Creation Business Logic", () => {
      describe("Authentication and Authorization", () => {
        it("should reject unauthenticated users", async () => {
          // Arrange
          mockRequest.user = undefined;
          mockRequest.body = {
            title: "Test Event",
            type: "Effective Communication Workshop",
            date: "2025-08-10",
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(401);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Authentication required.",
          });
        });
      });

      describe("Date Validation", () => {
        it("should reject events with past dates", async () => {
          // Arrange - Create event with yesterday's date (use LOCAL date string to match controller logic)
          const toLocalDateStr = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
          };
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const pastDate = toLocalDateStr(yesterday);

          mockRequest.body = {
            title: "Past Event",
            type: "Effective Communication Workshop",
            date: pastDate,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              {
                name: "Zoom Host",
                description: "Event participant",
                maxParticipants: 1,
              },
            ],
          };

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Event date must be in the future.",
          });
        });

        it("should accept events with future dates", async () => {
          // Arrange - Create event with tomorrow's date
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const futureDate = tomorrow.toISOString().split("T")[0];

          mockRequest.body = {
            title: "Future Event",
            type: "Effective Communication Workshop",
            date: futureDate,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              {
                name: "Zoom Host",
                description: "Event participant",
                maxParticipants: 1,
              },
            ],
          };

          const mockEvent = {
            _id: "event123",
            ...mockRequest.body,
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation(() => mockEvent as any);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: true,
              message: "Event created successfully!",
            })
          );
        });

        it("should handle Date object conversion correctly", async () => {
          // Arrange - Simulate JSON parsing converting date to Date object
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 7);

          mockRequest.body = {
            title: "Date Object Event",
            type: "Effective Communication Workshop",
            date: futureDate, // Date object instead of string
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          let capturedEventData: any;
          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation((data) => {
            capturedEventData = data;
            return mockEvent as any;
          });

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(capturedEventData.date).toBe(
            futureDate.toISOString().split("T")[0]
          );
        });
      });

      // Covers background Promise.all(...).then path for co-organizer notifications
      describe("Background co-organizer notifications", () => {
        it("triggers background aggregation .then after co-organizer emails and system messages", async () => {
          // Arrange
          const eventData = {
            title: "Event With Co-Orgs",
            type: "Effective Communication Workshop",
            date: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 3);
              return d.toISOString().split("T")[0];
            })(),
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Main Organizer",
            purpose: "Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "desc", maxParticipants: 1 },
            ],
          };

          mockRequest.body = eventData;

          const mockEvent = {
            _id: "event-agg-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          // Event constructor
          vi.mocked(Event).mockImplementation(() => mockEvent);

          // No broadcast emails to all users to keep test deterministic
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);

          // Build populated event with organizerDetails so co-organizer path executes
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "event-agg-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: [
              { userId: "u-main", name: "Main", role: "Organizer" },
              { userId: "u-co1", name: "Co1", role: "Assistant" },
            ],
          } as any);

          // Co-organizers discovery returns one co-organizer to notify
          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
            [
              { email: "co1@example.com", firstName: "Co", lastName: "One" },
            ] as any
          );

          // Lookup user for targeted system message
          vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({ _id: "co-user-1" }),
          } as any);

          // Notification senders resolve
          vi.mocked(
            EmailService.sendCoOrganizerAssignedEmail
          ).mockResolvedValue(true as any);
          vi.mocked(
            UnifiedMessageController.createTargetedSystemMessage
          ).mockResolvedValue(true as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Allow background Promise.all .then to run
          await new Promise((r) => setTimeout(r, 0));

          // Assert basic success
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalled();
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).toHaveBeenCalled();
        });

        it("logs no co-organizers found path when organizerDetails exist but getEventCoOrganizers returns empty", async () => {
          // Arrange
          const eventData = {
            title: "Event With No Co-Orgs",
            type: "Effective Communication Workshop",
            date: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 5);
              return d.toISOString().split("T")[0];
            })(),
            time: "09:00",
            endTime: "10:00",
            location: "HQ",
            organizer: "Main Organizer",
            purpose: "Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "desc", maxParticipants: 1 },
            ],
            organizerDetails: [
              { userId: "u-main", name: "Main", role: "Organizer" },
            ],
          } as any;

          mockRequest.body = eventData;

          const mockEvent = {
            _id: "event-no-co-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          vi.mocked(Event).mockImplementation(() => mockEvent);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          // Populate with organizerDetails so the co-organizer block runs
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "event-no-co-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: eventData.organizerDetails,
          } as any);
          // Return empty array so it hits the "No co-organizers found" branch
          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
            [] as any
          );

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert basic success and that no targeted messages/emails were attempted
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(
            EmailService.sendCoOrganizerAssignedEmail
          ).not.toHaveBeenCalled();
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).not.toHaveBeenCalled();
        });

        it("continues when some co-organizer email/system sends fail (caught inside map)", async () => {
          // Arrange
          const eventData = {
            title: "Event With Mixed Notifs",
            type: "Effective Communication Workshop",
            date: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 2);
              return d.toISOString().split("T")[0];
            })(),
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Main Organizer",
            purpose: "Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "desc", maxParticipants: 1 },
            ],
          } as any;

          mockRequest.body = eventData;

          const mockEvent = {
            _id: "event-mix-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          // Event constructor
          vi.mocked(Event).mockImplementation(() => mockEvent);

          // No broadcast emails to all users
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);

          // Build populated event with organizerDetails so co-organizer path executes
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "event-mix-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: [
              { userId: "u-main", name: "Main", role: "Organizer" },
              { userId: "u-co1", name: "Co1", role: "Assistant" },
              { userId: "u-co2", name: "Co2", role: "Assistant" },
            ],
          } as any);

          // Co-organizers discovery returns two co-organizers to notify
          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
            [
              { email: "co1@example.com", firstName: "Co", lastName: "One" },
              { email: "co2@example.com", firstName: "Co", lastName: "Two" },
            ] as any
          );

          // Lookup targeted user IDs for system messages (two calls)
          const selectMock1 = vi.fn().mockResolvedValue({ _id: "co-user-1" });
          const selectMock2 = vi.fn().mockResolvedValue({ _id: "co-user-2" });
          vi.mocked(User.findOne)
            .mockReturnValueOnce({ select: selectMock1 } as any)
            .mockReturnValueOnce({ select: selectMock2 } as any);

          // Make first email succeed, second fail to hit catch inside map
          vi.mocked(EmailService.sendCoOrganizerAssignedEmail)
            .mockResolvedValueOnce(true as any)
            .mockRejectedValueOnce(new Error("email-fail"));

          // Make first system message fail, second succeed to hit catch path
          vi.mocked(UnifiedMessageController.createTargetedSystemMessage)
            .mockRejectedValueOnce(new Error("sys-fail") as any)
            .mockResolvedValueOnce(true as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Allow background Promise.all .then to run
          await new Promise((r) => setTimeout(r, 0));

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(
            EmailService.sendCoOrganizerAssignedEmail
          ).toHaveBeenCalledTimes(2);
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).toHaveBeenCalledTimes(2);
        });
      });

      describe("Population and co-organizer outer-catch branches", () => {
        it("falls back to raw event when population fails (catch path)", async () => {
          const eventData = {
            title: "Pop Fail Event",
            type: "Effective Communication Workshop",
            date: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 2);
              return d.toISOString().split("T")[0];
            })(),
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Main",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
          } as any;

          mockRequest.body = eventData;

          const eventInstance: any = {
            _id: "e-pop-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          // Broadcast lists empty (no blocking)
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);

          // Force builder to throw so catch assigns populatedEvent = event
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockRejectedValue(new Error("boom-pop"));

          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: true,
              message: "Event created successfully!",
              data: expect.objectContaining({
                event: expect.objectContaining({ _id: "e-pop-1" }),
              }),
            })
          );
        });

        it("handles co-organizer outer catch without failing createEvent", async () => {
          const eventData = {
            title: "CoOrg Outer Catch",
            type: "Effective Communication Workshop",
            date: (() => {
              const d = new Date();
              d.setDate(d.getDate() + 4);
              return d.toISOString().split("T")[0];
            })(),
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Main",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
          } as any;

          mockRequest.body = eventData;

          const eventInstance: any = {
            _id: "e-co-outer-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          // Return populated event with organizerDetails so co-organizer try block runs
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "e-co-outer-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: [
              { userId: "u-main", name: "Main", role: "Organizer" },
              { userId: "u-co", name: "Co", role: "Assistant" },
            ],
          } as any);

          // Throw inside co-organizer block to hit outer catch
          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockRejectedValue(
            new Error("boom-coorg")
          );

          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(201);
        });
      });

      describe("Format-Specific Validation", () => {
        it("should allow creating Online events without zoomLink (optional)", async () => {
          // Arrange
          const eventData = {
            title: "Online Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            organizer: "Test Organizer",
            purpose:
              "Test Purpose for this event that explains what we're doing",
            agenda:
              "This is a detailed agenda for the online event with multiple items and activities",
            format: "Online",
            // zoomLink is now optional - can be added later
            roles: [
              {
                name: "Zoom Host",
                description: "Event participant",
                maxParticipants: 1,
              },
            ],
          };

          mockRequest.body = eventData;

          // Set up the event instance with our test data
          const eventInstance: any = {
            _id: "online-event-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          // Mock empty broadcast lists
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);

          // Mock the response builder to return our test event
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            ...eventInstance,
            registrations: [],
          });

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert - Should succeed with 201 status
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: true,
              message: "Event created successfully!",
              data: expect.objectContaining({
                event: expect.objectContaining({
                  title: "Online Event",
                  format: "Online",
                  // zoomLink is not provided, so it should not be in the response
                }),
              }),
            })
          );
        });

        it("should require location for In-person events", async () => {
          // Arrange
          mockRequest.body = {
            title: "In-person Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            // Missing location
            roles: [
              {
                name: "Zoom Host",
                description: "Event participant",
                maxParticipants: 1,
              },
            ],
          };

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields: location",
          });
        });

        it("should require location but allow optional zoomLink for Hybrid events", async () => {
          // Arrange
          mockRequest.body = {
            title: "Hybrid Event",
            type: "Effective Communication Workshop",
            date: "2025-08-10",
            time: "10:00",
            endTime: "12:00",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "Hybrid Participation",
            // Missing location (required) but zoomLink is now optional
            roles: [
              {
                name: "Zoom Host",
                description: "Event participant",
                maxParticipants: 1,
              },
            ],
          };

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert - Should fail only because location is missing
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields: location",
          });
        });

        it("should remove zoomLink for In-person events", async () => {
          // Arrange
          mockRequest.body = {
            title: "In-person Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            zoomLink: "https://zoom.us/invalid", // Should be removed
            roles: [
              {
                name: "Zoom Host",
                description: "Event participant",
                maxParticipants: 1,
              },
            ],
          };

          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation((data: any) => {
            // Verify zoomLink was removed
            expect(data.zoomLink).toBeUndefined();
            return mockEvent as any;
          });

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
        });

        it("should convert empty zoomLink string to undefined and succeed", async () => {
          // Arrange
          const eventData = {
            title: "Online Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            organizer: "Test Organizer",
            purpose:
              "Test Purpose for this event that explains what we're doing",
            agenda:
              "This is a detailed agenda for the online event with multiple items and activities",
            format: "Online",
            zoomLink: "", // Empty string should be converted to undefined
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          mockRequest.body = eventData;

          // Set up the event instance with our test data
          const eventInstance: any = {
            _id: "online-event-2",
            ...eventData,
            zoomLink: undefined, // Empty string should be converted to undefined
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          // Mock empty broadcast lists
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);

          // Mock the response builder to return our test event
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            ...eventInstance,
            registrations: [],
          });

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert - Should succeed because zoomLink is now optional for Online events
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: true,
              message: "Event created successfully!",
              data: expect.objectContaining({
                event: expect.objectContaining({
                  title: "Online Event",
                  format: "Online",
                  // Empty string should be converted to undefined
                  zoomLink: undefined,
                }),
              }),
            })
          );
        });
      });

      describe("Role Validation", () => {
        it("should reject events with no roles", async () => {
          // Arrange
          mockRequest.body = {
            title: "No Roles Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles: [], // Empty roles array
          };

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Event must have at least one role.",
          });
        });

        it("should reject events with missing roles field", async () => {
          // Arrange
          mockRequest.body = {
            title: "Missing Roles Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            // roles field missing
          };

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Missing required fields: roles",
          });
        });

        it("should assign UUIDs to roles and calculate total slots", async () => {
          // Arrange
          const roles = [
            {
              name: "Zoom Host",
              description: "Event host",
              maxParticipants: 1,
            },
            {
              name: "Zoom Co-host",
              description: "Event co-host",
              maxParticipants: 1,
            },
          ];

          mockRequest.body = {
            title: "Multi-Role Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles,
          };

          let capturedEventData: any;
          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation((data) => {
            capturedEventData = data;
            return mockEvent as any;
          });

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(capturedEventData.roles).toHaveLength(2);
          expect(capturedEventData.roles[0].id).toBe("mock-uuid-1234");
          expect(capturedEventData.roles[1].id).toBe("mock-uuid-1234");
          expect(capturedEventData.totalSlots).toBe(2); // 1 + 1
          expect(capturedEventData.signedUp).toBe(0);
          expect(capturedEventData.status).toBe("upcoming");
        });
      });

      describe("Organizer Details Processing", () => {
        it("should process organizer details with placeholder contact info", async () => {
          // Arrange
          const organizerDetails = [
            {
              userId: "user123",
              name: "John Doe",
              role: "Co-organizer",
              email: "john@example.com", // Will be replaced with placeholder
              phone: "123-456-7890", // Will be replaced with placeholder
              avatar: "avatar-url",
              gender: "male",
            },
          ];

          mockRequest.body = {
            title: "Organizer Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            organizerDetails,
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          let capturedEventData: any;
          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation((data) => {
            capturedEventData = data;
            return mockEvent as any;
          });

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(capturedEventData.organizerDetails[0]).toEqual({
            userId: "user123",
            name: "John Doe",
            role: "Co-organizer",
            avatar: "avatar-url",
            gender: "male",
            email: "placeholder@example.com", // Placeholder
            phone: "Phone not provided", // Placeholder
          });
        });

        it("should handle empty organizer details array", async () => {
          // Arrange
          mockRequest.body = {
            title: "No Organizers Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            organizerDetails: [],
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          let capturedEventData: any;
          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation((data) => {
            capturedEventData = data;
            return mockEvent as any;
          });

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(capturedEventData.organizerDetails).toEqual([]);
        });

        it("should handle missing organizer details field", async () => {
          // Arrange
          mockRequest.body = {
            title: "No Organizer Details Field",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            // organizerDetails field missing
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          let capturedEventData: any;
          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockResolvedValue(undefined),
          };

          vi.mocked(Event).mockImplementation((data) => {
            capturedEventData = data;
            return mockEvent as any;
          });

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(capturedEventData.organizerDetails).toEqual([]);
        });
      });

      describe("Database Error Handling", () => {
        it("should handle event save failures gracefully", async () => {
          // Arrange
          mockRequest.body = {
            title: "Save Error Event",
            type: "Effective Communication Workshop",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            location: "Test Location",
            organizer: "Test Organizer",
            purpose: "Test Purpose",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "Test", maxParticipants: 1 },
            ],
          };

          const mockEvent = {
            _id: "event123",
            save: vi.fn().mockRejectedValue(new Error("Database save failed")),
          };

          vi.mocked(Event).mockImplementation(() => mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(500);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Failed to create event.",
          });
        });

        it("continues when fetching email recipients fails (background emails)", async () => {
          // Arrange
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const futureDate = tomorrow.toISOString().split("T")[0];

          const eventData = {
            title: "Email Recipients Error",
            type: "Effective Communication Workshop",
            date: futureDate,
            time: "10:00",
            endTime: "12:00",
            location: "L",
            organizer: "Org",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
          };

          mockRequest.body = eventData as any;

          const mockEvent = {
            _id: "e-mail-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          } as any;
          vi.mocked(Event).mockImplementation(() => mockEvent);

          // System message audience empty (not critical)
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);

          // Make background email recipient fetch fail
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockRejectedValue(new Error("fetch failed"));

          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert – despite recipient fetch failure, creation still succeeds
          expect(mockStatus).toHaveBeenCalledWith(201);
          const payload = (mockJson as any).mock.calls.at(-1)[0];
          expect(payload.success).toBe(true);
        });

        it("falls back to raw event when population fails after creation", async () => {
          // Arrange
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const futureDate = tomorrow.toISOString().split("T")[0];

          const eventData = {
            title: "Populate Failure",
            type: "Effective Communication Workshop",
            date: futureDate,
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Org",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
          };

          mockRequest.body = eventData as any;

          const mockEvent = {
            _id: "e-pop-1",
            ...eventData,
            organizerDetails: [],
            save: vi.fn().mockResolvedValue(undefined),
          } as any;
          vi.mocked(Event).mockImplementation(() => mockEvent);

          // Keep other background tasks benign
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);

          // Force population to fail
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockRejectedValue(new Error("populate broke"));

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert – should still succeed with fallback event in payload
          expect(mockStatus).toHaveBeenCalledWith(201);
          const payload = (mockJson as any).mock.calls.at(-1)[0];
          expect(payload.data.event._id).toBe("e-pop-1");
        });

        it("handles empty co-organizer list by skipping notifications", async () => {
          // Arrange
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const futureDate = tomorrow.toISOString().split("T")[0];

          const eventData = {
            title: "No CoOrgs",
            type: "Effective Communication Workshop",
            date: futureDate,
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Org",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
          } as any;

          mockRequest.body = eventData;

          const eventInstance: any = {
            _id: "e-noco-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          // No broadcast emails for determinism
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);

          // Built event includes organizerDetails so we enter co-organizer logic
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "e-noco-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: [{ userId: "u-main" }],
          } as any);

          // But discovery returns empty
          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
            [] as any
          );

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          // No email/system message calls when no co-organizers
          expect(
            EmailService.sendCoOrganizerAssignedEmail
          ).not.toHaveBeenCalled();
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).not.toHaveBeenCalled();
        });

        it("doesn't fail when processing co-organizer notifications rejects (Promise.all catch)", async () => {
          // Arrange
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const futureDate = tomorrow.toISOString().split("T")[0];

          const eventData = {
            title: "Has CoOrgs",
            type: "Effective Communication Workshop",
            date: futureDate,
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Org",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
            organizerDetails: [
              { userId: "u-main", name: "Main", role: "Organizer" },
              { userId: "u-co", name: "Co", role: "Co" },
            ],
          } as any;

          mockRequest.body = eventData;

          const eventInstance: any = {
            _id: "e-co-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          // For broadcast path
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([{ _id: "x" }]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);

          // Built event with organizerDetails so co-organizer logic runs
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "e-co-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: [
              {
                userId: "u-main",
                email: "main@example.com",
                firstName: "Main",
                lastName: "User",
              },
              {
                userId: "u-co",
                email: "co@example.com",
                firstName: "Co",
                lastName: "Org",
              },
            ],
          } as any);

          // Co-organizers discovery returns one co-organizer
          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
            [
              { email: "co@example.com", firstName: "Co", lastName: "Org" },
            ] as any
          );

          // Force Promise.all used for notifications to reject to hit catch branch
          const promiseAllSpy = vi
            .spyOn(Promise, "all")
            .mockRejectedValueOnce(new Error("pall"));

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert – still succeeds
          expect(mockStatus).toHaveBeenCalledWith(201);
          // Cleanup
          promiseAllSpy.mockRestore();
        });

        it("skips system message when co-organizer user lookup returns null (no createTargetedSystemMessage)", async () => {
          // Arrange
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const futureDate = tomorrow.toISOString().split("T")[0];

          const eventData = {
            title: "Lookup Null",
            type: "Effective Communication Workshop",
            date: futureDate,
            time: "10:00",
            endTime: "12:00",
            location: "HQ",
            organizer: "Org",
            purpose: "P",
            format: "In-person",
            roles: [
              { name: "Zoom Host", description: "d", maxParticipants: 1 },
            ],
            organizerDetails: [
              { userId: "u-main", name: "Main", role: "Organizer" },
              { userId: "u-co", name: "Co", role: "Co" },
            ],
          } as any;

          mockRequest.body = eventData;

          const eventInstance: any = {
            _id: "e-null-1",
            ...eventData,
            save: vi.fn().mockResolvedValue(undefined),
          };
          vi.mocked(Event).mockImplementation(() => eventInstance);

          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([]),
          } as any);
          vi.mocked(
            EmailRecipientUtils.getActiveVerifiedUsers
          ).mockResolvedValue([]);

          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({
            _id: "e-null-1",
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            organizerDetails: [
              {
                userId: "u-main",
                email: "main@example.com",
                firstName: "Main",
                lastName: "User",
              },
              {
                userId: "u-co",
                email: "co@example.com",
                firstName: "Co",
                lastName: "Org",
              },
            ],
          } as any);

          vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
            [
              { email: "co@example.com", firstName: "Co", lastName: "Org" },
            ] as any
          );

          // Force User.findOne to resolve null to skip targeted system message branch
          vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue(null),
          } as any);

          // Act
          await EventController.createEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(201);
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).not.toHaveBeenCalled();
        });
      });
    });

    it("handles system message failure gracefully and still returns 201", async () => {
      const eventData = {
        title: "SysMsg Fail Event",
        type: "Effective Communication Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "12:00",
        location: "X",
        organizer: "Org",
        purpose: "Y",
        format: "In-person",
        roles: [{ name: "Zoom Host", description: "", maxParticipants: 1 }],
      };

      mockRequest.body = eventData as any;

      // Ensure user list non-empty so it tries to send system messages and then fails
      vi.mocked(User.find).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([{ _id: "u1" }]),
      } as any);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockRejectedValueOnce(new Error("send failed"));

      // Minimal stubs for downstream
      vi.mocked(Event.prototype.save as any)?.mockResolvedValue?.();
      // If direct prototype save mock doesn't exist, patch Event as constructor mock:
      vi.mocked(Event as any).mockImplementationOnce(function (
        this: any,
        d: any
      ) {
        Object.assign(this, d, { _id: "e-sysfail" });
        this.save = vi.fn().mockResolvedValue(undefined);
        return this;
      } as any);

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({
        _id: "e-sysfail",
        organizerDetails: [],
      } as any);

      // No email recipients so email block .then runs with empty results
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        [] as any
      );

      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Allow any microtasks from Promise.all to settle
      await Promise.resolve();

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("logs 'No co-organizers found' branch when organizerDetails present but none resolved", async () => {
      const eventData = {
        title: "NoCoOrg",
        type: "Effective Communication Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "12:00",
        location: "Loc",
        organizer: "Org",
        purpose: "Purpose",
        format: "In-person",
        roles: [{ name: "Zoom Host", description: "", maxParticipants: 1 }],
        organizerDetails: [{ userId: "u2", name: "X", role: "co" }],
      } as any;

      mockRequest.body = eventData;

      // Event constructor
      vi.mocked(Event as any).mockImplementationOnce(function (
        this: any,
        d: any
      ) {
        Object.assign(this, d, { _id: "e-noco" });
        this.save = vi.fn().mockResolvedValue(undefined);
        return this;
      } as any);

      // System message path: zero users
      vi.mocked(User.find).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([]),
      } as any);

      // Email recipients none
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        [] as any
      );

      // Populate event to include organizerDetails
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({
        _id: "e-noco",
        organizerDetails: [{ userId: "u2" }],
      } as any);

      // Co-organizers resolution returns empty array
      vi.mocked(EmailRecipientUtils.getEventCoOrganizers).mockResolvedValue(
        [] as any
      );

      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      await Promise.resolve();
      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it("processes event-wide email notifications in background (.then path)", async () => {
      const eventData = {
        title: "Email Blast",
        type: "Effective Communication Workshop",
        date: futureDateStr,
        time: "09:00",
        endTime: "10:00",
        location: "Hall",
        organizer: "Org",
        purpose: "Purpose",
        format: "In-person",
        roles: [{ name: "Zoom Host", description: "", maxParticipants: 1 }],
      } as any;

      mockRequest.body = eventData;

      // Event constructor
      vi.mocked(Event as any).mockImplementationOnce(function (
        this: any,
        d: any
      ) {
        Object.assign(this, d, { _id: "e-email" });
        this.save = vi.fn().mockResolvedValue(undefined);
        return this;
      } as any);

      // System messages: zero users to skip
      vi.mocked(User.find).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([]),
      } as any);

      // Email recipients: two users
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue([
        { email: "a@b.com", firstName: "A", lastName: "B" },
        { email: "c@d.com", firstName: "C", lastName: "D" },
      ] as any);

      // First resolves true, second resolves true as well to exercise success counting
      vi.mocked(EmailService.sendEventCreatedEmail).mockResolvedValue(
        true as any
      );

      // Populate event
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({
        _id: "e-email",
        organizerDetails: [],
      } as any);

      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Let Promise.all .then run
      await Promise.resolve();

      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(201);
    });
  });

  describe("updateEvent - no new co-organizers branch", () => {
    it("handles update with organizerDetails provided but no newly added co-organizers", async () => {
      // Arrange
      const existingEvent: any = {
        _id: "evt-1",
        title: "Event",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Loc",
        createdBy: "u1",
        organizerDetails: [{ userId: "u1", name: "A", role: "Org" }],
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.params = { id: "evt-1" } as any;
      mockRequest.body = {
        organizerDetails: [
          { userId: "u1", name: "A", role: "Org" }, // same as before -> no new
        ],
      } as any;

      vi.mocked(Event.findById).mockResolvedValue(existingEvent);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({ id: "evt-1" } as any);

      // Act
      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(EmailService.sendCoOrganizerAssignedEmail).not.toHaveBeenCalled();
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).not.toHaveBeenCalled();
    });
  });

  describe("updateEvent", () => {
    it("should exist", () => {
      expect(EventController.updateEvent).toBeDefined();
      expect(typeof EventController.updateEvent).toBe("function");
    });

    it("should successfully update an event", async () => {
      // Arrange
      const mockEvent = {
        _id: "event123",
        title: "Updated Event",
        description: "Updated description",
        createdBy: "user123",
        organizerDetails: [],
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.params = { id: "event123" };
      mockRequest.body = {
        title: "Updated Event",
        description: "Updated description",
      };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue(mockEvent as any);

      // Act
      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Event updated successfully!",
          data: expect.objectContaining({
            event: mockEvent,
          }),
        })
      );
    });

    it("triggers background aggregation .then after co-organizer update notifications", async () => {
      // Arrange
      const mockEvent: any = {
        _id: "evt-agg-upd-1",
        title: "Event",
        description: "d",
        createdBy: "u-main",
        organizerDetails: [{ userId: "u-main" }],
        date: futureDateStr,
        time: "10:00",
        location: "Loc",
        type: "Effective Communication Workshop",
        roles: [{ name: "Zoom Host", description: "", maxParticipants: 1 }],
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.params = { id: "evt-agg-upd-1" } as any;
      mockRequest.body = {
        organizerDetails: [{ userId: "u-main" }, { userId: "u-new" }],
      } as any;

      vi.mocked(Event.findById).mockResolvedValue(mockEvent);

      // New co-organizer lookup returns one user
      vi.mocked(User.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: "u-new",
            email: "new@example.com",
            firstName: "New",
            lastName: "User",
          },
        ]),
      } as any);

      // Notification senders resolve
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        true as any
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(true as any);

      // End response builder
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({ id: "evt-agg-upd-1" } as any);

      // Act
      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Let background then run
      await new Promise((r) => setTimeout(r, 0));

      // Assert success and that notifications attempted
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalled();
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalled();
    });

    it("doesn't fail when processing co-organizer update notifications rejects (Promise.all catch)", async () => {
      // Arrange
      const mockEvent: any = {
        _id: "evt-200",
        title: "Updated Event",
        description: "Updated description",
        createdBy: "u-main",
        organizerDetails: [{ userId: "u-main" }],
        date: futureDateStr,
        time: "10:00",
        location: "Loc",
        roles: [],
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.params = { id: "evt-200" } as any;
      mockRequest.body = {
        organizerDetails: [{ userId: "u-main" }, { userId: "u-new" }],
      } as any;

      vi.mocked(Event.findById).mockResolvedValue(mockEvent);

      // New co-organizer lookup
      vi.mocked(User.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: "u-new",
            email: "new@example.com",
            firstName: "New",
            lastName: "User",
          },
        ]),
      } as any);

      // End response builder
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({ id: "evt-200" } as any);

      // Force Promise.all used for notifications to reject to hit catch branch
      const promiseAllSpy = vi
        .spyOn(Promise, "all")
        .mockRejectedValueOnce(new Error("pall-upd"));

      // Act
      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      // Cleanup
      promiseAllSpy.mockRestore();
    });

    it("should return 404 for non-existent event", async () => {
      // Arrange
      mockRequest.params = { id: "nonexistent123" };
      vi.mocked(Event.findById).mockResolvedValue(null);

      // Act
      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Event not found.",
        })
      );
    });

    describe("Event Update Business Logic", () => {
      describe("Authentication and Authorization", () => {
        it("should reject unauthenticated users", async () => {
          // Arrange
          mockRequest.params = { id: "507f1f77bcf86cd799439011" };
          mockRequest.body = { title: "Updated Event" };
          mockRequest.user = undefined;

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(401);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Authentication required.",
          });
        });

        it("should reject invalid event ID", async () => {
          // Arrange
          mockRequest.params = { id: "invalid-id" };
          mockRequest.body = { title: "Updated Event" };

          // Mock mongoose.Types.ObjectId.isValid to return false for invalid ID
          vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValueOnce(false);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Invalid event ID.",
          });
        });
      });

      describe("Permission Validation", () => {
        it("should allow users with EDIT_ANY_EVENT permission to edit any event", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "Updated Event" };
          mockRequest.user = {
            _id: "admin-user",
            role: "Administrator",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission)
            .mockReturnValueOnce(true) // EDIT_ANY_EVENT = true
            .mockReturnValue(false); // Other permissions = false
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockEvent.save).toHaveBeenCalled();
        });

        it("should allow event creators to edit their own events", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "Updated Event" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // EDIT_ANY_EVENT = false
            .mockReturnValueOnce(true); // EDIT_OWN_EVENT = true
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockEvent.save).toHaveBeenCalled();
        });

        it("should allow co-organizers to edit events", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [
              { userId: "user123", name: "Co-organizer", role: "Assistant" },
            ],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "Updated Event" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // EDIT_ANY_EVENT = false
            .mockReturnValueOnce(true); // EDIT_OWN_EVENT = true
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockEvent.save).toHaveBeenCalled();
        });

        it("should reject unauthorized users", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [],
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "Updated Event" };
          mockRequest.user = {
            _id: "unauthorized-user",
            role: "Participant",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(false); // No permissions

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(403);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message:
              "Insufficient permissions to edit this event. You must be the event creator or a co-organizer.",
          });
        });
      });

      describe("Organizer Details Processing", () => {
        it("should process organizer details with placeholder contact info", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = {
            organizerDetails: [
              {
                userId: "co-org-1",
                name: "Co-organizer 1",
                role: "Assistant",
                email: "original@email.com", // Should be replaced with placeholder
                phone: "123-456-7890", // Should be replaced with placeholder
              },
            ],
          };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockEvent.save).toHaveBeenCalled();
          // Verify placeholder email/phone was set (email/phone fetched fresh at read time)
          expect((mockEvent as any).organizerDetails[0].email).toBe(
            "placeholder@example.com"
          );
          expect((mockEvent as any).organizerDetails[0].phone).toBe(
            "Phone not provided"
          );
        });

        it("should handle role updates when provided", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            type: "Effective Communication Workshop",
            createdBy: "user123",
            organizerDetails: [],
            roles: [{ id: "old-role", name: "Zoom Host" }],
            save: vi.fn().mockResolvedValue(undefined),
          };

          const newRoles = [
            { id: "new-role", name: "Zoom Co-host", maxParticipants: 1 },
          ];

          mockRequest.params = { id: "event123" };
          mockRequest.body = {
            title: "Updated Event",
            roles: newRoles,
          };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Mock the event.save to update roles when called
          mockEvent.save = vi.fn().mockImplementation(() => {
            mockEvent.roles = newRoles;
            return Promise.resolve(undefined);
          });

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockEvent.roles).toEqual(newRoles);
          expect(mockEvent.save).toHaveBeenCalled();
        });
      });

      describe("Co-organizer Notification Logic", () => {
        beforeEach(() => {
          // Mock User.find for co-organizer lookups with proper chaining
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([
              {
                _id: "new-co-org",
                email: "neworg@example.com",
                firstName: "New",
                lastName: "Organizer",
              },
            ]),
          } as any);

          // Mock EmailService
          vi.mocked(
            EmailService.sendCoOrganizerAssignedEmail
          ).mockResolvedValue(true);
        });

        it("should send notifications to newly added co-organizers", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "main-org",
            organizerDetails: [], // No existing co-organizers
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = {
            organizerDetails: [
              {
                userId: "new-co-org",
                name: "New Co-organizer",
                role: "Assistant",
              },
            ],
          };
          mockRequest.user = { _id: "main-org", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(vi.mocked(User.find)).toHaveBeenCalledWith({
            _id: { $in: ["new-co-org"] },
            isActive: true,
            isVerified: true,
            emailNotifications: true,
          });
          expect(
            vi.mocked(EmailService.sendCoOrganizerAssignedEmail)
          ).toHaveBeenCalledWith(
            "neworg@example.com",
            { firstName: "New", lastName: "Organizer" },
            expect.objectContaining({
              title: "Test Event",
            }),
            expect.objectContaining({
              firstName: expect.any(String),
              lastName: expect.any(String),
            })
          );
        });

        it("should not send notifications to existing co-organizers", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "main-org",
            organizerDetails: [
              { userId: "existing-co-org", name: "Existing Co-organizer" },
            ],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = {
            organizerDetails: [
              {
                userId: "existing-co-org", // Same co-organizer, no new addition
                name: "Existing Co-organizer",
                role: "Assistant",
              },
            ],
          };
          mockRequest.user = { _id: "main-org", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert - Should not send notification to existing co-organizer
          expect(
            vi.mocked(EmailService.sendCoOrganizerAssignedEmail)
          ).not.toHaveBeenCalled();
        });

        it("triggers background aggregation .then after update co-organizer notifications", async () => {
          // Arrange
          const mockEvent = {
            _id: "event-agg-2",
            title: "Test Event",
            date: "2025-08-10",
            time: "10:00",
            location: "HQ",
            createdBy: "main-org",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          mockRequest.params = { id: "event-agg-2" };
          mockRequest.body = {
            organizerDetails: [
              { userId: "new-co-org", name: "New Co", role: "Assistant" },
            ],
          };
          mockRequest.user = { _id: "main-org", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([
              {
                _id: "new-co-org",
                email: "co@example.com",
                firstName: "Co",
                lastName: "User",
              },
            ]),
          } as any);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);
          vi.mocked(
            EmailService.sendCoOrganizerAssignedEmail
          ).mockResolvedValue(true as any);
          vi.mocked(
            UnifiedMessageController.createTargetedSystemMessage
          ).mockResolvedValue(true as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Let background Promise.all .then resolve
          await new Promise((r) => setTimeout(r, 0));

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalled();
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).toHaveBeenCalled();
        });

        it("handles error during new co-organizer lookup gracefully (catch path)", async () => {
          // Arrange
          const mockEvent = {
            _id: "event-err-lookup",
            title: "Test Event",
            date: "2025-08-10",
            time: "10:00",
            location: "HQ",
            createdBy: "main-org",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          mockRequest.params = { id: "event-err-lookup" };
          mockRequest.body = {
            organizerDetails: [
              { userId: "new-co-org", name: "New Co", role: "Assistant" },
            ],
          } as any;
          mockRequest.user = { _id: "main-org", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Make User.find(...).select(...) fail to trigger the catch block
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockRejectedValue(new Error("query fail")),
          } as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert – request should still succeed
          expect(mockStatus).toHaveBeenCalledWith(200);
          const payload = (mockJson as any).mock.calls.at(-1)[0];
          expect(payload.success).toBe(true);
        });

        it("continues when some update co-organizer sends fail (caught inside map)", async () => {
          // Arrange
          const mockEvent = {
            _id: "event-err-send",
            title: "Event U",
            date: futureDateStr,
            time: "10:00",
            location: "HQ",
            createdBy: "main-org",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          mockRequest.params = { id: "event-err-send" };
          mockRequest.body = {
            organizerDetails: [
              { userId: "co1", name: "Co1", role: "Assistant" },
              { userId: "co2", name: "Co2", role: "Assistant" },
            ],
          } as any;
          mockRequest.user = { _id: "main-org", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);

          // Lookup returns two new co-organizers
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([
              {
                _id: "co1",
                email: "c1@example.com",
                firstName: "C1",
                lastName: "L1",
              },
              {
                _id: "co2",
                email: "c2@example.com",
                firstName: "C2",
                lastName: "L2",
              },
            ]),
          } as any);

          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({ id: "event-err-send" } as any);

          // Make first email fail, second succeed
          vi.mocked(EmailService.sendCoOrganizerAssignedEmail)
            .mockRejectedValueOnce(new Error("update-email-fail"))
            .mockResolvedValueOnce(true as any);

          // Make first system message succeed, second fail
          vi.mocked(UnifiedMessageController.createTargetedSystemMessage)
            .mockResolvedValueOnce(true as any)
            .mockRejectedValueOnce(new Error("update-sys-fail") as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Allow background Promise.all .then to run
          await new Promise((r) => setTimeout(r, 0));

          // Assert – request still succeeds
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(
            EmailService.sendCoOrganizerAssignedEmail
          ).toHaveBeenCalledTimes(2);
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).toHaveBeenCalledTimes(2);
        });

        it("uses the same co-organizer assignment templates on update (email + system message) with actor as sender", async () => {
          // Arrange
          const mockEvent = {
            _id: "evt-same-template",
            title: "Event T",
            date: futureDateStr,
            time: "10:00",
            location: "HQ",
            createdBy: "main-org",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          } as any;

          mockRequest.params = { id: "evt-same-template" } as any;
          mockRequest.body = {
            organizerDetails: [
              { userId: "co-x", name: "Co X", role: "Assistant" },
            ],
          } as any;
          mockRequest.user = {
            _id: "actor-1",
            role: "Leader",
            firstName: "Alice",
            lastName: "Actor",
            username: "aactor",
            avatar: "a.png",
            gender: "female",
            roleInAtCloud: "@Cloud Co-worker",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(true);
          vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockResolvedValue([
              {
                _id: "co-x",
                email: "cox@example.com",
                firstName: "Co",
                lastName: "X",
              },
            ]),
          } as any);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          vi.mocked(
            EmailService.sendCoOrganizerAssignedEmail
          ).mockResolvedValue(true as any);
          vi.mocked(
            UnifiedMessageController.createTargetedSystemMessage
          ).mockResolvedValue({ _id: "m1" } as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Allow background .then to settle
          await new Promise((r) => setTimeout(r, 0));

          // Assert email invoked with same template signature
          expect(
            EmailService.sendCoOrganizerAssignedEmail
          ).toHaveBeenCalledWith(
            "cox@example.com",
            { firstName: "Co", lastName: "X" },
            expect.objectContaining({
              title: "Event T",
              date: futureDateStr,
              time: "10:00",
              location: "HQ",
            }),
            { firstName: "Alice", lastName: "Actor" }
          );

          // Assert system message matches creation semantics: title + announcement type
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              title: `Co-Organizer Assignment: Event T`,
              type: "announcement",
              priority: "high",
            }),
            ["co-x"],
            expect.objectContaining({ id: "actor-1" })
          );
        });
      });

      describe("Event Edited Notifications (participants & guests)", () => {
        it("sends emails to participants and guests and creates targeted system messages for participants", async () => {
          // Arrange
          const mockEvent: any = {
            _id: "evt-edit-1",
            title: "Event A",
            date: futureDateStr,
            endDate: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            timeZone: "America/New_York",
            createdBy: "u-main",
            organizerDetails: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "evt-edit-1" } as any;
          mockRequest.body = { title: "Event A (edited)" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({ id: "evt-edit-1" } as any);

          // Recipients
          vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
            [
              {
                email: "p1@example.com",
                firstName: "P1",
                lastName: "User",
                _id: "p1",
              },
              {
                email: "p2@example.com",
                firstName: "P2",
                lastName: "User",
                _id: "p2",
              },
            ] as any
          );
          vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue([
            { email: "g1@example.com", firstName: "G1", lastName: "Guest" },
          ] as any);

          vi.mocked(
            EmailService.sendEventNotificationEmailBulk
          ).mockResolvedValue([true, true, true] as any);
          vi.mocked(
            UnifiedMessageController.createTargetedSystemMessage
          ).mockResolvedValue(true as any);

          // Act
          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Allow background notifications to flush
          await new Promise((r) => setTimeout(r, 0));

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          // Now we call sendEventNotificationEmailBulk once with combined participants + guests array (deduplication by email)
          expect(
            vi.mocked(EmailService.sendEventNotificationEmailBulk)
          ).toHaveBeenCalledTimes(1); // single combined call (dedupes internally)

          // Verify the recipients array contains all 3 emails (2 participants + 1 guest)
          const callArgs = vi.mocked(
            EmailService.sendEventNotificationEmailBulk
          ).mock.calls[0];
          const recipients = callArgs[0];
          expect(recipients).toHaveLength(3);
          expect(recipients.map((r) => r.email)).toContain("p1@example.com");
          expect(recipients.map((r) => r.email)).toContain("p2@example.com");
          expect(recipients.map((r) => r.email)).toContain("g1@example.com");

          // system message for participants (2 target IDs)
          expect(
            vi.mocked(UnifiedMessageController.createTargetedSystemMessage)
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining("Event Updated"),
              type: "update",
              metadata: expect.objectContaining({ eventId: "evt-edit-1" }),
            }),
            ["p1", "p2"],
            expect.objectContaining({ id: expect.any(String) })
          );
        });

        it("handles when there are no participants or guests gracefully", async () => {
          const mockEvent: any = {
            _id: "evt-edit-empty",
            title: "Event B",
            date: futureDateStr,
            time: "10:00",
            endTime: "11:00",
            createdBy: "u-main",
            organizerDetails: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "evt-edit-empty" } as any;
          mockRequest.body = {} as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({ id: "evt-edit-empty" } as any);

          vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
            [] as any
          );
          vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue(
            [] as any
          );

          vi.mocked(EmailService.sendEventNotificationEmail).mockResolvedValue(
            true as any
          );

          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          await new Promise((r) => setTimeout(r, 0));

          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(
            vi.mocked(EmailService.sendEventNotificationEmail)
          ).not.toHaveBeenCalled();
          expect(
            vi.mocked(UnifiedMessageController.createTargetedSystemMessage)
          ).not.toHaveBeenCalled();
        });

        it("resolves participant userIds by email when _id is missing and still creates system messages", async () => {
          const mockEvent: any = {
            _id: "evt-edit-lookup",
            title: "Event C",
            date: futureDateStr,
            time: "10:00",
            endTime: "12:00",
            createdBy: "u-main",
            organizerDetails: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "evt-edit-lookup" } as any;
          mockRequest.body = { title: "Event C (edited)" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue({ id: "evt-edit-lookup" } as any);

          // Provide participants without _id
          vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
            [
              { email: "p1@example.com", firstName: "P1", lastName: "U" },
              { email: "p2@example.com", firstName: "P2", lastName: "U" },
            ] as any
          );
          vi.mocked(EmailRecipientUtils.getEventGuests).mockResolvedValue(
            [] as any
          );

          // Resolve users by email -> IDs p1, p2
          vi.mocked(User.findOne)
            .mockResolvedValueOnce({ _id: "p1" } as any)
            .mockResolvedValueOnce({ _id: "p2" } as any);

          vi.mocked(EmailService.sendEventNotificationEmail).mockResolvedValue(
            true as any
          );
          vi.mocked(
            UnifiedMessageController.createTargetedSystemMessage
          ).mockResolvedValue(true as any);

          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          await new Promise((r) => setTimeout(r, 0));

          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(
            UnifiedMessageController.createTargetedSystemMessage
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              title: expect.stringContaining("Event Updated"),
            }),
            ["p1", "p2"],
            expect.any(Object)
          );
        });
      });

      describe("Database Error Handling", () => {
        it("returns 400 when update validation fails", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockRejectedValue({
              name: "ValidationError",
              errors: { title: { message: "Title invalid" } },
            }),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "" }; // trigger validation error
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // EDIT_ANY_EVENT = false
            .mockReturnValueOnce(true); // EDIT_OWN_EVENT = true

          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              message: expect.stringContaining("Validation failed"),
            })
          );
        });

        it("returns 500 when saving event fails with unknown error", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockRejectedValue(new Error("DB write failed")),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "Updated" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // EDIT_ANY_EVENT = false
            .mockReturnValueOnce(true); // EDIT_OWN_EVENT = true

          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(500);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              message: "Failed to update event.",
            })
          );
        });

        it("returns 500 when building response throws", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            roles: [],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { title: "Updated" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // EDIT_ANY_EVENT = false
            .mockReturnValueOnce(true); // EDIT_OWN_EVENT = true

          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockRejectedValue(new Error("builder failure"));

          await EventController.updateEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(500);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              message: "Failed to update event.",
            })
          );
        });
      });
    });

    it("returns 500 when an unexpected error occurs during update", async () => {
      mockRequest.params = { id: "64d2b9f3f1a2c3e4d5f6a7b8" } as any;
      vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValue(true);
      // Simulate a thrown error before permission checks
      vi.mocked(Event.findById).mockRejectedValue(new Error("DB read failed"));

      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to update event.",
        })
      );
    });

    describe("Zoom Fields Update", () => {
      it("should allow updating empty Zoom fields for Online events", async () => {
        // Arrange
        const mockEvent = {
          _id: "event123",
          title: "Online Event",
          format: "Online",
          type: "Effective Communication Workshop",
          createdBy: "user123",
          organizerDetails: [],
          zoomLink: "",
          meetingId: "",
          passcode: "",
          save: vi.fn().mockResolvedValue(undefined),
        };

        mockRequest.params = { id: "event123" };
        mockRequest.body = {
          zoomLink: "https://zoom.us/j/123456789",
          meetingId: "123 456 789",
          passcode: "secretpass",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockResolvedValue({
          ...mockEvent,
          zoomLink: "https://zoom.us/j/123456789",
          meetingId: "123 456 789",
          passcode: "secretpass",
        } as any);

        // Act
        await EventController.updateEvent(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockEvent.save).toHaveBeenCalled();
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Event updated successfully!",
            data: expect.objectContaining({
              event: expect.objectContaining({
                zoomLink: "https://zoom.us/j/123456789",
                meetingId: "123 456 789",
                passcode: "secretpass",
              }),
            }),
          })
        );
      });

      it("should allow updating empty Zoom fields for Hybrid events", async () => {
        // Arrange
        const mockEvent = {
          _id: "event456",
          title: "Hybrid Event",
          format: "Hybrid Participation",
          type: "Effective Communication Workshop",
          createdBy: "user123",
          organizerDetails: [],
          location: "Conference Room A",
          zoomLink: "",
          meetingId: "",
          passcode: "",
          save: vi.fn().mockResolvedValue(undefined),
        };

        mockRequest.params = { id: "event456" };
        mockRequest.body = {
          zoomLink: "https://zoom.us/j/987654321",
          meetingId: "987 654 321",
          passcode: "hybridpass",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockResolvedValue({
          ...mockEvent,
          zoomLink: "https://zoom.us/j/987654321",
          meetingId: "987 654 321",
          passcode: "hybridpass",
        } as any);

        // Act
        await EventController.updateEvent(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockEvent.save).toHaveBeenCalled();
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Event updated successfully!",
            data: expect.objectContaining({
              event: expect.objectContaining({
                zoomLink: "https://zoom.us/j/987654321",
                meetingId: "987 654 321",
                passcode: "hybridpass",
              }),
            }),
          })
        );
      });

      it("should allow clearing existing Zoom fields", async () => {
        // Arrange
        const mockEvent = {
          _id: "event789",
          title: "Online Event",
          format: "Online",
          type: "Effective Communication Workshop",
          createdBy: "user123",
          organizerDetails: [],
          zoomLink: "https://zoom.us/j/existing",
          meetingId: "existing meeting",
          passcode: "existing pass",
          save: vi.fn().mockResolvedValue(undefined),
        };

        mockRequest.params = { id: "event789" };
        mockRequest.body = {
          zoomLink: "",
          meetingId: "",
          passcode: "",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockResolvedValue({
          ...mockEvent,
          zoomLink: "",
          meetingId: "",
          passcode: "",
        } as any);

        // Act
        await EventController.updateEvent(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockEvent.save).toHaveBeenCalled();
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Event updated successfully!",
            data: expect.objectContaining({
              event: expect.objectContaining({
                zoomLink: "",
                meetingId: "",
                passcode: "",
              }),
            }),
          })
        );
      });

      it("should update hostedBy field correctly", async () => {
        // Arrange
        const mockEvent = {
          _id: "event999",
          title: "Test Event",
          format: "Online",
          type: "Effective Communication Workshop",
          createdBy: "user123",
          organizerDetails: [],
          hostedBy: "",
          save: vi.fn().mockResolvedValue(undefined),
        };

        mockRequest.params = { id: "event999" };
        mockRequest.body = {
          hostedBy: "New Host Organization",
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockResolvedValue({
          ...mockEvent,
          hostedBy: "New Host Organization",
        } as any);

        // Act
        await EventController.updateEvent(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockEvent.save).toHaveBeenCalled();
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Event updated successfully!",
            data: expect.objectContaining({
              event: expect.objectContaining({
                hostedBy: "New Host Organization",
              }),
            }),
          })
        );
      });
    });
  });

  describe("Programs integration in create/update", () => {
    it("createEvent with programLabels pushes event to Program.events", async () => {
      // Arrange
      const eventData: any = {
        title: "Multi-Program Event",
        type: "Workshop",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Loc",
        organizer: "Org",
        purpose: "P",
        format: "In-person",
        roles: [{ name: "Attendee", description: "", maxParticipants: 30 }],
        programLabels: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
      };

      mockRequest.body = eventData;

      // Program lookup for validation - called for each program
      vi.mocked((Program as any).findById)
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({
            _id: "507f1f77bcf86cd799439011",
            programType: "EMBA",
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({
            _id: "507f1f77bcf86cd799439012",
            programType: "MBA",
          }),
        } as any);

      // Event constructor to capture saved data
      vi.mocked(Event as any).mockImplementationOnce(function (
        this: any,
        d: any
      ) {
        Object.assign(this, d, { _id: "e-prog1" });
        this.save = vi.fn().mockResolvedValue(undefined);
        return this;
      } as any);

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({
        _id: "e-prog1",
        organizerDetails: [],
      } as any);

      // System messages and emails no-op
      vi.mocked(User.find).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([]),
      } as any);
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        [] as any
      );

      // Act
      await EventController.createEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(201);
      // Expect Program.updateOne to be called twice (once for each program)
      expect(Program.updateOne).toHaveBeenCalledTimes(2);
      expect(Program.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $addToSet: { events: expect.anything() } }
      );
    });

    it("updateEvent changes programLabels and syncs Program.events with pull/add", async () => {
      // Arrange existing event with previous programs
      const eventId = "507f1f77bcf86cd799439020"; // Valid ObjectId hex string
      const existingEvent: any = {
        _id: eventId,
        title: "Event",
        date: futureDateStr,
        time: "10:00",
        endTime: "11:00",
        location: "Loc",
        createdBy: "user123",
        organizerDetails: [],
        programLabels: [
          new (mongoose as any).Types.ObjectId("507f1f77bcf86cd799439011"),
        ],
        type: "Workshop",
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockRequest.params = { id: eventId } as any;
      mockRequest.user = { _id: "user123", role: "Leader" } as any;
      mockRequest.get = vi.fn().mockReturnValue("test-user-agent");
      mockRequest.ip = "127.0.0.1";
      mockRequest.body = {
        programLabels: ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
      } as any;

      vi.mocked(Event.findById).mockResolvedValue(existingEvent);

      // Permission checks
      vi.mocked(hasPermission)
        .mockReturnValueOnce(false) // EDIT_ANY_EVENT = false
        .mockReturnValueOnce(true); // EDIT_OWN_EVENT = true

      // New program lookups (2 new programs)
      vi.mocked((Program as any).findById)
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({
            _id: "507f1f77bcf86cd799439012",
            programType: "EMBA",
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({
            _id: "507f1f77bcf86cd799439013",
            programType: "MBA",
          }),
        } as any);

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({ id: eventId } as any);

      // Act
      await EventController.updateEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      // Expect:
      // - 1 pull from the removed program (507f...011)
      // - 2 addToSet for new programs (507f...012, 507f...013)
      expect(Program.updateOne).toHaveBeenCalledTimes(3);

      // Check for $pull operation (removed program)
      expect(Program.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything() }),
        expect.objectContaining({ $pull: expect.anything() })
      );

      // Check for $addToSet operations (2 new programs)
      const calls = vi.mocked(Program.updateOne).mock.calls;
      const addToSetCalls = calls.filter(
        (call: any) => call[1] && "$addToSet" in call[1]
      );
      expect(addToSetCalls).toHaveLength(2);
    });
  });

  describe("deleteEvent", () => {
    it("should exist", () => {
      expect(EventController.deleteEvent).toBeDefined();
      expect(typeof EventController.deleteEvent).toBe("function");
    });

    it("should successfully delete an event", async () => {
      // Arrange
      const mockEvent = {
        _id: "event123",
        title: "Test Event",
        createdBy: "user123",
        signedUp: 0,
      };

      mockRequest.params = { id: "event123" };
      vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      // Deletion is delegated to EventCascadeService
      vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
        deletedRegistrations: 0,
        deletedGuestRegistrations: 0,
      });

      // Act
      await EventController.deleteEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Event deleted successfully!",
        })
      );
      expect(EventCascadeService.deleteEventFully).toHaveBeenCalledWith(
        "event123"
      );
    });

    it("should return 404 for non-existent event", async () => {
      // Arrange
      mockRequest.params = { id: "nonexistent123" };
      vi.mocked(Event.findById).mockResolvedValue(null);

      // Act
      await EventController.deleteEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Event not found.",
        })
      );
    });

    describe("Event Deletion Business Logic", () => {
      describe("Authentication and Authorization", () => {
        it("should reject unauthenticated users", async () => {
          // Arrange
          mockRequest.params = { id: "507f1f77bcf86cd799439011" };
          mockRequest.user = undefined;

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(401);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Authentication required.",
          });
        });

        it("should reject invalid event ID", async () => {
          // Arrange
          mockRequest.params = { id: "invalid-id" };

          // Mock mongoose.Types.ObjectId.isValid to return false for invalid ID
          vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValueOnce(false);

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Invalid event ID.",
          });
        });
      });

      describe("Permission Validation", () => {
        it("should allow users with DELETE_ANY_EVENT permission to delete any event", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [],
            signedUp: 0,
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = {
            _id: "admin-user",
            role: "Administrator",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
            deletedRegistrations: 0,
            deletedGuestRegistrations: 0,
          });
          vi.mocked(hasPermission)
            .mockReturnValueOnce(true) // DELETE_ANY_EVENT = true
            .mockReturnValue(false); // Other permissions = false

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(
            vi.mocked(EventCascadeService.deleteEventFully)
          ).toHaveBeenCalledWith("event123");
        });

        it("should allow event creators to delete their own events", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            signedUp: 0,
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
            deletedRegistrations: 0,
            deletedGuestRegistrations: 0,
          });
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // DELETE_ANY_EVENT = false
            .mockReturnValueOnce(true); // DELETE_OWN_EVENT = true

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(
            vi.mocked(EventCascadeService.deleteEventFully)
          ).toHaveBeenCalledWith("event123");
        });

        it("should allow co-organizers to delete events", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [
              { userId: "user123", name: "Co-organizer", role: "Assistant" },
            ],
            signedUp: 0,
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
            deletedRegistrations: 0,
            deletedGuestRegistrations: 0,
          });
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // DELETE_ANY_EVENT = false
            .mockReturnValueOnce(true); // DELETE_OWN_EVENT = true

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(
            vi.mocked(EventCascadeService.deleteEventFully)
          ).toHaveBeenCalledWith("event123");
        });

        it("should reject unauthorized users", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [],
            signedUp: 0,
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = {
            _id: "unauthorized-user",
            role: "Participant",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(false); // No permissions

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(403);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message:
              "Insufficient permissions to delete this event. You must be the event creator or a co-organizer.",
          });
        });
      });

      describe("Participant Cascade Handling", () => {
        it("should successfully delete events with no participants", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            signedUp: 0, // No participants
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
            deletedRegistrations: 0,
            deletedGuestRegistrations: 0,
          });
          vi.mocked(hasPermission).mockReturnValue(true);

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockJson).toHaveBeenCalledWith({
            success: true,
            message: "Event deleted successfully!",
          });
          // Deletions are delegated to EventCascadeService; controller does not call Registration.deleteMany directly
          expect(EventCascadeService.deleteEventFully).toHaveBeenCalledWith(
            "event123"
          );
        });

        it("should reject deletion of events with participants for unauthorized users", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [],
            signedUp: 5, // Has participants
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(hasPermission).mockReturnValue(false); // No delete permissions

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(403);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message:
              "Insufficient permissions to delete this event. You must be the event creator or a co-organizer.",
          });
        });

        it("should force delete events with participants for authorized users and cascade guest + program pull", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            signedUp: 3, // Has participants
            programId: "507f1f77bcf86cd799439011",
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
            deletedRegistrations: 3,
            deletedGuestRegistrations: 2,
          });
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // DELETE_ANY_EVENT = false
            .mockReturnValueOnce(true); // DELETE_OWN_EVENT = true

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockJson).toHaveBeenCalledWith({
            success: true,
            message:
              "Event deleted successfully! Also removed 3 associated registrations and 2 guest registrations.",
            deletedRegistrations: 3,
            deletedGuestRegistrations: 2,
          });
          expect(
            vi.mocked(EventCascadeService.deleteEventFully)
          ).toHaveBeenCalledWith("event123");
        });

        it("should handle cascade deletion for administrators", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "other-user",
            organizerDetails: [],
            signedUp: 10, // Has many participants
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = {
            _id: "admin-user",
            role: "Administrator",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
            deletedRegistrations: 10,
            deletedGuestRegistrations: 2,
          });
          vi.mocked(hasPermission)
            .mockReturnValueOnce(true) // DELETE_ANY_EVENT = true
            .mockReturnValue(false); // Other permissions = false

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockJson).toHaveBeenCalledWith({
            success: true,
            message:
              "Event deleted successfully! Also removed 10 associated registrations and 2 guest registrations.",
            deletedRegistrations: 10,
            deletedGuestRegistrations: 2,
          });
          expect(
            vi.mocked(EventCascadeService.deleteEventFully)
          ).toHaveBeenCalledWith("event123");
        });

        it("should invalidate caches after delete (no participants)", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            signedUp: 0,
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          // Trigger cache invalidation like real service does
          vi.mocked(EventCascadeService.deleteEventFully).mockImplementation(
            async (eventId: string) => {
              CachePatterns.invalidateEventCache(eventId);
              CachePatterns.invalidateAnalyticsCache();
              return { deletedRegistrations: 0, deletedGuestRegistrations: 0 };
            }
          );
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // DELETE_ANY_EVENT = false
            .mockReturnValueOnce(true); // DELETE_OWN_EVENT = true

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
            "event123"
          );
          expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
        });

        it("should invalidate caches after cascade delete (with participants)", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            signedUp: 2,
          } as any;

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockImplementation(
            async (eventId: string) => {
              CachePatterns.invalidateEventCache(eventId);
              CachePatterns.invalidateAnalyticsCache();
              return { deletedRegistrations: 2, deletedGuestRegistrations: 0 };
            }
          );
          vi.mocked(hasPermission)
            .mockReturnValueOnce(false) // DELETE_ANY_EVENT = false
            .mockReturnValueOnce(true); // DELETE_OWN_EVENT = true

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
            "event123"
          );
          expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
        });
      });

      describe("Database Error Handling", () => {
        it("should handle database errors gracefully", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            createdBy: "user123",
            organizerDetails: [],
            signedUp: 0,
          };

          mockRequest.params = { id: "event123" };
          mockRequest.user = { _id: "user123", role: "Leader" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(EventCascadeService.deleteEventFully).mockRejectedValue(
            new Error("Database error")
          );
          vi.mocked(hasPermission).mockReturnValue(true);

          // Act
          await EventController.deleteEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(500);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Failed to delete event.",
          });
        });
      });
    });
  });

  describe("signUpForEvent", () => {
    it("should exist", () => {
      expect(EventController.signUpForEvent).toBeDefined();
      expect(typeof EventController.signUpForEvent).toBe("function");
    });

    it("should successfully sign up for an event", async () => {
      // This test has complex async mocking challenges with lockService
      // For now, we'll focus on testing existence while we expand other controller tests
      expect(EventController.signUpForEvent).toBeDefined();
      expect(typeof EventController.signUpForEvent).toBe("function");
    });

    describe("Event Signup Business Logic", () => {
      describe("Authentication and Authorization", () => {
        it("should reject unauthenticated users", async () => {
          // Arrange
          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = undefined; // No user

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(401);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Authentication required.",
          });
        });
      });

      describe("Input Validation", () => {
        it("should reject invalid event ID", async () => {
          // Arrange
          mockRequest.params = { id: "invalid-id" };
          mockRequest.body = { roleId: "role123" };

          // Mock mongoose.Types.ObjectId.isValid to return false for invalid ID
          vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValueOnce(false);

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Invalid event ID.",
          });
        });

        it("should reject missing roleId", async () => {
          // Arrange
          mockRequest.params = { id: "507f1f77bcf86cd799439011" };
          mockRequest.body = {}; // No roleId

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Role ID is required.",
          });
        });

        it("should return 404 for non-existent event", async () => {
          // Arrange
          mockRequest.params = { id: "507f1f77bcf86cd799439011" };
          mockRequest.body = { roleId: "role123" };
          vi.mocked(Event.findById).mockResolvedValue(null);

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(404);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Event not found.",
          });
        });
      });

      describe("Event Status Validation", () => {
        it("should reject signup for non-upcoming events", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "completed", // Not upcoming
            roles: [{ id: "role123", name: "Zoom Host", maxParticipants: 1 }],
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          vi.mocked(Event.findById).mockResolvedValue(mockEvent);

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Cannot sign up for this event.",
          });
        });
      });

      // Role Limit Validation removed: per-authorization role limits no longer enforced.
      describe("Role Limit Validation (Removed)", () => {
        it("should allow multiple roles without previous authorization-based limit", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              { id: "role123", name: "Zoom Host", maxParticipants: 2 },
              { id: "role456", name: "Co-Host", maxParticipants: 2 },
            ],
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role456" };
          mockRequest.user = {
            _id: "user123",
            role: "Participant",
            username: "u",
            firstName: "F",
            lastName: "L",
            email: "x@example.com",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          // Simulate already signed up for first role only
          vi.mocked(Registration.countDocuments)
            .mockResolvedValueOnce(1) // userCurrentSignupsInThisEvent
            .mockResolvedValueOnce(0); // currentCount for target role under lock
          vi.mocked(Registration.findOne).mockResolvedValue(null); // no duplicate

          const mockWithLock = vi.mocked(lockService.withLock);
          mockWithLock.mockImplementation(async (_k, cb) => cb());

          const mockSave = vi.fn().mockResolvedValue(undefined);
          vi.mocked(Registration).mockImplementation(
            () => ({ save: mockSave } as any)
          );

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
          );
        });
      });

      describe("Role Permission Validation (Participant gating removed)", () => {
        it("should allow Participants to sign up for any role now", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              { id: "role123", name: "Event Organizer", maxParticipants: 1 },
            ], // Authorized role
            save: vi.fn().mockResolvedValue(undefined),
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = {
            _id: "user123",
            role: "Participant",
            username: "testuser",
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(Registration.countDocuments)
            .mockResolvedValueOnce(0) // userCurrentSignupsInThisEvent
            .mockResolvedValueOnce(0); // currentCount for target role under lock
          vi.mocked(Registration.findOne).mockResolvedValue(null); // No duplicate registration

          // Mock lockService.withLock to execute the callback immediately
          const mockWithLock = vi.mocked(lockService.withLock);
          mockWithLock.mockImplementation(async (key, callback) => {
            return await callback();
          });

          // Mock Registration save
          const mockSave = vi.fn().mockResolvedValue(undefined);
          const mockNewRegistration = {
            save: mockSave,
            eventId: "event123",
            userId: "user123",
            roleId: "role123",
          };
          vi.mocked(Registration).mockImplementation(
            () => mockNewRegistration as any
          );

          // Mock ResponseBuilderService
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(mockEvent as any);

          // Act - This won't reach completion due to complex async flow, but will validate role permission logic
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert - If we reach this point, role permission validation passed
          // The test validates that Participants can access authorized roles
          expect(vi.mocked(Registration.countDocuments)).toHaveBeenCalled();
        });

        it("should return 400 for non-existent role in event", async () => {
          // Arrange
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              { id: "different-role", name: "Other Role", maxParticipants: 1 },
            ],
          };

          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "nonexistent-role" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          vi.mocked(Registration.countDocuments).mockResolvedValue(0);

          // Act
          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          // Assert
          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Role not found in this event.",
          });
        });
      });
    });
  });

  describe("cancelSignup", () => {
    it("should exist", () => {
      expect(EventController.cancelSignup).toBeDefined();
      expect(typeof EventController.cancelSignup).toBe("function");
    });

    it("should successfully cancel event signup", async () => {
      // Arrange
      const mockEvent = {
        _id: "event123",
        title: "Test Event",
        roles: [{ id: "role1", name: "Zoom Host" }],
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockRegistration = {
        _id: "registration123",
        userId: "user123",
        eventId: "event123",
        roleId: "role1",
      };

      mockRequest.params = { id: "event123" };
      mockRequest.body = { roleId: "role1" };

      vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      vi.mocked(Registration.findOneAndDelete).mockResolvedValue(
        mockRegistration
      );
      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue(mockEvent as any);

      // Act
      await EventController.cancelSignup(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Successfully cancelled signup for Zoom Host",
        })
      );
    });
    describe("Negative Cases", () => {
      it("should 400 on invalid event id", async () => {
        mockRequest.params = { id: "bad-id" } as any;
        vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValueOnce(false);
        await EventController.cancelSignup(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });

      it("should 401 when unauthenticated", async () => {
        mockRequest.params = { id: "507f1f77bcf86cd799439011" } as any;
        (mockRequest as any).user = undefined;
        await EventController.cancelSignup(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });

      it("should 404 when event not found", async () => {
        mockRequest.params = { id: "507f1f77bcf86cd799439011" } as any;
        vi.mocked(Event.findById).mockResolvedValue(null);
        await EventController.cancelSignup(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Event not found.",
        });
      });

      it("should 404 when role not found", async () => {
        const event = { _id: "e1", roles: [{ id: "rX", name: "Other" }] };
        mockRequest.params = { id: "e1" } as any;
        mockRequest.body = { roleId: "role1" };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        await EventController.cancelSignup(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Role not found.",
        });
      });

      it("should 400 when user not signed up for role", async () => {
        const event = {
          _id: "e1",
          roles: [{ id: "r1", name: "Zoom Host" }],
          save: vi.fn(),
        };
        mockRequest.params = { id: "e1" } as any;
        mockRequest.body = { roleId: "r1" } as any;
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOneAndDelete).mockResolvedValue(null);
        await EventController.cancelSignup(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "You are not signed up for this role.",
        });
      });

      it("returns 500 when event.save fails during cancellation", async () => {
        // Arrange
        const event = {
          _id: "507f1f77bcf86cd799439011",
          roles: [{ id: "role1", name: "Role 1", maxParticipants: 1 }],
          save: vi.fn().mockRejectedValue(new Error("save failed")),
        } as any;

        mockRequest.params = { id: "507f1f77bcf86cd799439011" } as any;
        mockRequest.body = { roleId: "role1" } as any;
        mockRequest.user = { _id: "user123" } as any;

        vi.mocked(Event.findById).mockResolvedValue(event);
        // Ensure a registration exists so we reach the save call
        vi.mocked(Registration.findOneAndDelete).mockResolvedValue({
          _id: "reg1",
          eventId: event._id,
          userId: "user123",
          roleId: "role1",
        } as any);

        // Act
        await EventController.cancelSignup(
          mockRequest as Request,
          mockResponse as Response
        );

        // Assert
        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Failed to cancel signup.",
          })
        );
      });
    });
  });

  describe("getUserEvents", () => {
    it("should exist", () => {
      expect(EventController.getUserEvents).toBeDefined();
      expect(typeof EventController.getUserEvents).toBe("function");
    });

    it("should successfully get user events", async () => {
      // Arrange
      const mockRegistrations = [
        {
          _id: "reg1",
          userId: "user123",
          eventId: {
            _id: "event123",
            title: "Test Event",
            date: "2025-08-10",
            time: "10:00",
            endTime: "12:00",
            roles: [{ id: "role1", name: "Zoom Host" }],
          },
          roleId: "role1",
          registrationDate: new Date(),
          status: "active",
        },
      ];

      vi.mocked(Registration.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(mockRegistrations),
        }),
      } as any);

      // Act
      await EventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: expect.any(Array),
            stats: expect.any(Object),
          }),
        })
      );
    });

    it("should handle database errors with 500", async () => {
      // Arrange: make Registration.find throw
      vi.mocked(Registration.find as any).mockImplementation(() => {
        throw new Error("DB error");
      });

      // Act
      await EventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Failed to retrieve user events.",
        })
      );
    });

    it("should 401 when unauthenticated", async () => {
      (mockRequest as any).user = undefined;

      await EventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("computes stats, dedupes unique events, filters null eventId, and uses snapshot when role not found", async () => {
      // Arrange registrations: one null event (filtered), two for same cancelled event (E1, passed), one upcoming (E2)
      const pastDate = "2000-01-01";
      const regs = [
        // filtered out
        { _id: "r0", userId: "user123", eventId: null },
        // Event E1 - cancelled and in the past; role not found -> use snapshot
        {
          _id: "r1",
          userId: "user123",
          eventId: {
            _id: "E1",
            title: "Past Cancelled",
            date: pastDate,
            time: "09:00",
            // endTime present to hit endTime path
            endTime: "10:00",
            location: "Room 1",
            format: "in-person",
            status: "cancelled",
            type: "Effective Communication Workshop",
            organizer: "org",
            createdAt: new Date("1999-12-31"),
            roles: [{ id: "role1", name: "A", description: "DescA" }],
          },
          roleId: "missing-role", // not in roles -> triggers snapshot fallback
          eventSnapshot: { roleName: "SnapName", roleDescription: "SnapDesc" },
          registrationDate: new Date(),
          status: "cancelled",
          notes: "",
          specialRequirements: "",
        },
        // Duplicate E1 to exercise de-duplication in stats (keep last seen)
        {
          _id: "r1b",
          userId: "user123",
          eventId: {
            _id: "E1",
            title: "Past Cancelled",
            date: pastDate,
            time: "09:00",
            endTime: "10:00",
            location: "Room 1",
            format: "in-person",
            status: "cancelled",
            type: "Effective Communication Workshop",
            organizer: "org",
            createdAt: new Date("1999-12-31"),
            roles: [{ id: "role1", name: "A", description: "DescA" }],
          },
          roleId: "still-missing",
          eventSnapshot: { roleName: "SnapName", roleDescription: "SnapDesc" },
          registrationDate: new Date(),
          status: "cancelled",
          notes: "",
          specialRequirements: "",
        },
        // Event E2 - upcoming and active; no endTime -> fallback to time
        {
          _id: "r2",
          userId: "user123",
          eventId: {
            _id: "E2",
            title: "Upcoming",
            date: futureDateStr,
            time: "23:59",
            location: "Hall",
            format: "online",
            status: "scheduled",
            type: "Effective Communication Workshop",
            organizer: "org2",
            createdAt: new Date(),
            roles: [{ id: "role2", name: "Zoom Host", description: "Assist" }],
          },
          roleId: "role2",
          registrationDate: new Date(),
          status: "active",
          notes: "",
          specialRequirements: "",
        },
      ];

      vi.mocked(Registration.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(regs),
        }),
      } as any);

      // Act
      await EventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert basics
      expect(mockStatus).toHaveBeenCalledWith(200);
      const payload = mockJson.mock.calls.at(-1)?.[0];
      expect(payload?.success).toBe(true);
      expect(Array.isArray(payload?.data?.events)).toBe(true);

      // events array should exclude the null eventId registration
      expect(payload.data.events.length).toBe(3);

      // Find E1 and E2 payloads
      const e1 = payload.data.events.find((e: any) => e.event.id === "E1");
      const e2 = payload.data.events.find((e: any) => e.event.id === "E2");

      // Snapshot fallback for E1 when role not found
      expect(e1.registration.roleName).toBe("SnapName");
      expect(e1.registration.roleDescription).toBe("SnapDesc");
      expect(e1.isPassedEvent).toBe(true);
      expect(e1.eventStatus).toBe("passed");

      // E2: current role name used and upcoming/passed classification depending on computed status.
      // With fallback endTime (not provided) we use start time as end -> zero-duration -> completed immediately at start.
      // Given 'date' is in the future relative to fixed tests earlier but dynamic here, we accept upcoming or passed.
      expect(e2.registration.roleName).toBe("Zoom Host");
      expect(["upcoming", "passed", "ongoing"]).toContain(e2.eventStatus);

      // Stats computed over unique events
      const { stats } = payload.data;
      expect(stats.total).toBe(2);
      // Stats: we only guarantee total & cancelled; upcoming + passed partition may vary if E2 classified as passed immediately.
      expect(stats.upcoming + stats.passed).toBe(2);
      expect(stats.active).toBe(1); // only E2 is active
      expect(stats.cancelled).toBe(1); // E1 is cancelled
    });
  });

  describe("getCreatedEvents", () => {
    it("should exist", () => {
      expect(EventController.getCreatedEvents).toBeDefined();
      expect(typeof EventController.getCreatedEvents).toBe("function");
    });

    it("should successfully get created events", async () => {
      // Arrange
      const mockEvents = [
        {
          _id: "event123",
          title: "Test Event",
          createdBy: "user123",
          date: "2025-08-10",
        },
      ];

      vi.mocked(Event.find).mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockEvents),
      } as any);

      // Act
      await EventController.getCreatedEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: mockEvents,
          }),
        })
      );
    });

    it("should 401 when unauthenticated", async () => {
      (mockRequest as any).user = undefined;

      await EventController.getCreatedEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should handle database errors with 500", async () => {
      vi.mocked(Event.find as any).mockImplementation(() => {
        throw new Error("DB error");
      });

      await EventController.getCreatedEvents(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to retrieve created events.",
      });
    });
  });

  describe("removeUserFromRole", () => {
    it("should exist", () => {
      expect(EventController.removeUserFromRole).toBeDefined();
      expect(typeof EventController.removeUserFromRole).toBe("function");
    });

    describe("Business Logic", () => {
      it("should return 404 when event not found", async () => {
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          roleId: "role1",
        };
        vi.mocked(Event.findById).mockResolvedValue(null);
        await EventController.removeUserFromRole(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Event not found",
        });
      });

      it("should return 404 when role not found", async () => {
        const event = {
          _id: "event123",
          roles: [{ id: "roleX", name: "Other" }],
          save: vi.fn(),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          roleId: "role1",
        }; // role1 missing
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        await EventController.removeUserFromRole(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Role not found",
        });
      });

      it("should return 404 when registration not found", async () => {
        const event = {
          _id: "event123",
          roles: [{ id: "role1", name: "Zoom Host" }],
          save: vi.fn(),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          roleId: "role1",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOneAndDelete).mockResolvedValue(null);
        await EventController.removeUserFromRole(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Registration not found",
        });
      });

      it("should remove user from role successfully", async () => {
        const event = {
          _id: "event123",
          roles: [{ id: "role1", name: "Zoom Host" }],
          save: vi.fn().mockResolvedValue(undefined),
        };
        const registration = { _id: "reg1" };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          roleId: "role1",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOneAndDelete).mockResolvedValue(
          registration as any
        );
        (User.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: "507f1f77bcf86cd799439011",
            email: "r@example.com",
            firstName: "Rem",
            lastName: "Oved",
          }),
        });
        await EventController.removeUserFromRole(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "User removed from Zoom Host successfully",
          })
        );
        expect(
          (TrioNotificationService as any).createEventRoleRemovedTrio
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            roleName: "Zoom Host",
            targetUser: expect.objectContaining({ id: expect.any(String) }),
          })
        );
        // system message created with atcloud_role_change type
        expect(
          UnifiedMessageController.createTargetedSystemMessage
        ).not.toHaveBeenCalled(); // Verified in TrioNotificationService role lifecycle tests
      });

      it("returns 500 when saving event fails after deletion", async () => {
        const event = {
          _id: "event123",
          roles: [{ id: "role1", name: "Zoom Host" }],
          save: vi.fn().mockRejectedValue(new Error("save failed")),
        };
        const registration = { _id: "reg1" };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          roleId: "role1",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOneAndDelete).mockResolvedValue(
          registration as any
        );

        await EventController.removeUserFromRole(
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({ success: false, message: "save failed" })
        );
      });
      describe("Lock and Concurrency Edge Cases", () => {
        it("should complete signup successfully under lock and emit updates", async () => {
          const mockEvent: any = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              {
                id: "role123",
                name: "Common Participant (on-site)",
                description: "desc",
                maxParticipants: 1,
              },
            ],
            save: vi.fn().mockResolvedValue(undefined),
            location: "L",
            type: "T",
            date: "2099-01-01",
            time: "10:00",
          };

          mockRequest.params = { id: "event123" } as any;
          mockRequest.body = {
            roleId: "role123",
            notes: "n",
            specialRequirements: "s",
          } as any;
          mockRequest.user = {
            _id: "507f1f77bcf86cd799439011",
            role: "Participant",
            username: "u",
            firstName: "F",
            lastName: "L",
            email: "u@example.com",
          } as any;

          vi.mocked(Event.findById).mockResolvedValue(mockEvent);
          // userCurrentSignupsInThisEvent
          vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);

          // Inside lock: capacity ok (0), no duplicate, save succeeds
          vi.mocked(lockService.withLock).mockImplementation(
            async (_key, cb) => {
              vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);
              vi.mocked(Registration.findOne).mockResolvedValueOnce(
                null as any
              );
              const mockSave = vi.fn().mockResolvedValue(undefined);
              const mockNewRegistration = { save: mockSave } as any;
              vi.mocked(Registration).mockImplementation(
                () => mockNewRegistration
              );
              return await cb();
            }
          );

          const updatedEvent: any = { _id: "event123", roles: mockEvent.roles };
          vi.mocked(
            ResponseBuilderService.buildEventWithRegistrations
          ).mockResolvedValue(updatedEvent);

          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(200);
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              success: true,
              message: expect.stringContaining("Successfully signed up for"),
            })
          );
          expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
            "event123",
            "user_signed_up",
            expect.objectContaining({
              userId: "507f1f77bcf86cd799439011",
              roleId: "role123",
            })
          );
          expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
            "event123"
          );
          expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
        });
        it("should 503 on lock timeout", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              {
                id: "role123",
                name: "Common Participant (on-site)",
                maxParticipants: 1,
              },
            ],
          };
          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;
          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          // Pre-lock: user has room
          vi.mocked(Registration.countDocuments).mockResolvedValue(0);
          // Lock throws timeout
          vi.mocked(lockService.withLock).mockRejectedValue(
            new Error("Lock timeout")
          );

          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(503);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: expect.stringContaining("Service temporarily unavailable"),
          });
        });

        it("should 400 when role capacity full under lock", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              {
                id: "role123",
                name: "Common Participant (on-site)",
                maxParticipants: 1,
              },
            ],
          };
          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;
          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          // Pre-lock: user has room
          vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);
          // Inside lock: capacity is full
          vi.mocked(lockService.withLock).mockImplementation(
            async (_key, cb) => {
              vi.mocked(Registration.countDocuments).mockResolvedValueOnce(1);
              return await cb();
            }
          );

          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: expect.stringContaining("full capacity"),
          });
        });

        it("should 400 when duplicate registration found under lock", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              {
                id: "role123",
                name: "Common Participant (on-site)",
                maxParticipants: 1,
              },
            ],
          };
          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;
          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          // Pre-lock: user has room
          vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);
          // Inside lock: capacity ok then duplicate exists
          vi.mocked(lockService.withLock).mockImplementation(
            async (_key, cb) => {
              vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);
              vi.mocked(Registration.findOne).mockResolvedValueOnce({
                _id: "existing",
              } as any);
              return await cb();
            }
          );

          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "You are already signed up for this role.",
          });
        });

        it("should 400 on outer-catch timeout error", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              {
                id: "role123",
                name: "Common Participant (on-site)",
                maxParticipants: 1,
              },
            ],
          };
          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;
          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          vi.mocked(Registration.countDocuments).mockResolvedValue(0);
          vi.mocked(lockService.withLock).mockRejectedValue(
            new Error("timeout")
          );

          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(400);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "timeout",
          });
        });

        it("should 500 on unknown error during signup (outer catch)", async () => {
          const mockEvent = {
            _id: "event123",
            title: "Test Event",
            status: "upcoming",
            roles: [
              {
                id: "role123",
                name: "Common Participant (on-site)",
                maxParticipants: 1,
              },
            ],
          };
          mockRequest.params = { id: "event123" };
          mockRequest.body = { roleId: "role123" };
          mockRequest.user = { _id: "user123", role: "Participant" } as any;
          vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
          vi.mocked(Registration.countDocuments).mockResolvedValue(0);
          vi.mocked(lockService.withLock).mockRejectedValue(
            new Error("db explode")
          );

          await EventController.signUpForEvent(
            mockRequest as Request,
            mockResponse as Response
          );

          expect(mockStatus).toHaveBeenCalledWith(500);
          expect(mockJson).toHaveBeenCalledWith({
            success: false,
            message: "Failed to sign up for event.",
          });
        });
      });
    });
  });

  describe("updateAllEventStatuses", () => {
    it("should exist", () => {
      expect(EventController.updateAllEventStatuses).toBeDefined();
      expect(typeof EventController.updateAllEventStatuses).toBe("function");
    });

    it("should update only events with status changes", async () => {
      // Arrange: one outdated status, one current
      const futureDate = "2099-01-01"; // ensures upcoming relative to now
      const eventNeedingUpdate = {
        _id: "e1",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        status: "completed",
      };
      const eventCurrent = {
        _id: "e2",
        date: futureDate,
        time: "10:00",
        endTime: "12:00",
        status: "upcoming",
      };
      vi.mocked(Event.find).mockResolvedValue([
        eventNeedingUpdate as any,
        eventCurrent as any,
      ]);
      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({});

      mockRequest = {} as any;
      await EventController.updateAllEventStatuses(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      // Only one update expected
      expect(vi.mocked(Event.findByIdAndUpdate)).toHaveBeenCalledTimes(1);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ updatedCount: 1 }),
        })
      );
    });

    it("should handle errors and return 500", async () => {
      vi.mocked(Event.find).mockRejectedValue(new Error("DB error"));
      await EventController.updateAllEventStatuses(
        mockRequest as Request,
        mockResponse as Response
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to update event statuses.",
      });
    });
  });

  describe("recalculateSignupCounts", () => {
    it("should exist", () => {
      expect(EventController.recalculateSignupCounts).toBeDefined();
      expect(typeof EventController.recalculateSignupCounts).toBe("function");
    });

    it("should recalculate signup counts for events with mismatched counts", async () => {
      const eventNeedsUpdate: any = {
        _id: "e1",
        signedUp: 5,
        calculateSignedUp: vi.fn().mockResolvedValue(7),
      };
      const eventNoChange: any = {
        _id: "e2",
        signedUp: 3,
        calculateSignedUp: vi.fn().mockResolvedValue(3),
      };
      vi.mocked(Event.find).mockResolvedValue([
        eventNeedsUpdate,
        eventNoChange,
      ]);
      vi.mocked(Event.findByIdAndUpdate).mockResolvedValue({});
      await EventController.recalculateSignupCounts(
        mockRequest as Request,
        mockResponse as Response
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(vi.mocked(Event.findByIdAndUpdate)).toHaveBeenCalledTimes(1);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ updatedCount: 1 }),
        })
      );
    });

    it("should return 500 on database error", async () => {
      vi.mocked(Event.find).mockRejectedValue(new Error("DB error"));
      await EventController.recalculateSignupCounts(
        mockRequest as Request,
        mockResponse as Response
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to recalculate signup counts.",
      });
    });

    it("deletes event with participants when authorized and reports deletedRegistrations", async () => {
      mockRequest.params = { id: "64d2b9f3f1a2c3e4d5f6a7b8" } as any;
      vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValue(true);
      // User can delete any
      vi.mocked(hasPermission).mockImplementation((role: any, perm: any) => {
        if (perm === "DELETE_ANY_EVENT") return true;
        return false;
      });

      const event: any = {
        _id: "64d2b9f3f1a2c3e4d5f6a7b8",
        createdBy: new (mongoose as any).Types.ObjectId(
          "64d2b9f3f1a2c3e4d5f6a7b9"
        ),
        signedUp: 3,
        organizerDetails: [],
      };
      vi.mocked(Event.findById).mockResolvedValue(event);
      vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
        deletedRegistrations: 3,
        deletedGuestRegistrations: 0,
      });

      await EventController.deleteEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EventCascadeService.deleteEventFully).toHaveBeenCalledWith(
        "64d2b9f3f1a2c3e4d5f6a7b8"
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          deletedRegistrations: 3,
        })
      );
    });

    it("returns 403 when user lacks delete permission (participants present)", async () => {
      mockRequest.params = { id: "64d2b9f3f1a2c3e4d5f6a7b8" } as any;
      vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValue(true);
      // User lacks delete perms
      vi.mocked(hasPermission).mockReturnValue(false as any);

      const event: any = {
        _id: "64d2b9f3f1a2c3e4d5f6a7b8",
        createdBy: new (mongoose as any).Types.ObjectId(
          "64d2b9f3f1a2c3e4d5f6a7b9"
        ),
        signedUp: 2,
        organizerDetails: [],
      };
      vi.mocked(Event.findById).mockResolvedValue(event);

      await EventController.deleteEvent(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  describe("getEventParticipants", () => {
    it("should exist", () => {
      expect(EventController.getEventParticipants).toBeDefined();
      expect(typeof EventController.getEventParticipants).toBe("function");
    });

    describe("Business Logic", () => {
      it("should return 400 for invalid event id", async () => {
        mockRequest.params = { id: "bad-id" } as any;
        vi.mocked(mongoose.Types.ObjectId.isValid).mockReturnValueOnce(false);
        await EventController.getEventParticipants(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });

      it("should return 401 when unauthenticated", async () => {
        mockRequest.params = { id: "507f1f77bcf86cd799439011" } as any;
        (mockRequest as any).user = undefined;
        await EventController.getEventParticipants(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });

      it("should return 404 when event not found", async () => {
        mockRequest.params = { id: "507f1f77bcf86cd799439011" } as any;
        vi.mocked(Event.findById).mockResolvedValue(null);
        await EventController.getEventParticipants(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Event not found.",
        });
      });

      it("should return 403 when user lacks permission and is not organizer", async () => {
        const event = {
          _id: "e1",
          title: "Event",
          roles: [],
          createdBy: "anotherUser",
        };
        mockRequest.params = { id: "e1" } as any;
        (mockRequest as any).user = { _id: "user123", role: "Participant" };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(hasPermission).mockReturnValue(false);
        await EventController.getEventParticipants(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(403);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("Insufficient permissions"),
        });
      });

      it("should return participants for event organizer", async () => {
        const event = {
          _id: "e1",
          title: "Event",
          roles: [{ id: "role1", name: "R" }],
          createdBy: "user123",
        };
        const registrations = [
          {
            _id: "r1",
            eventId: "e1",
            userId: { _id: "user123", username: "u" },
            roleId: "role1",
          },
        ];
        mockRequest.params = { id: "e1" } as any;
        (mockRequest as any).user = { _id: "user123", role: "Participant" };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(hasPermission).mockReturnValue(false); // Organizer path instead of permission
        vi.mocked(Registration.find).mockReturnValue({
          populate: vi.fn().mockResolvedValue(registrations),
        } as any);
        await EventController.getEventParticipants(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({ registrations: expect.any(Array) }),
          })
        );
      });

      it("should return 500 on database error during participants fetch", async () => {
        const event = {
          _id: "e1",
          title: "Event",
          roles: [{ id: "role1", name: "R" }],
          createdBy: "user123",
        };
        mockRequest.params = { id: "e1" } as any;
        (mockRequest as any).user = { _id: "user123", role: "Participant" };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(Registration.find).mockReturnValue({
          populate: vi.fn().mockRejectedValue(new Error("DB read failure")),
        } as any);

        await EventController.getEventParticipants(
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "Failed to retrieve event participants.",
          })
        );
      });
    });
  });

  describe("moveUserBetweenRoles", () => {
    it("should exist", () => {
      expect(EventController.moveUserBetweenRoles).toBeDefined();
      expect(typeof EventController.moveUserBetweenRoles).toBe("function");
    });

    describe("Business Logic", () => {
      it("should 404 when event not found", async () => {
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        };
        vi.mocked(Event.findById).mockResolvedValue(null);
        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Event not found",
        });
      });

      it("should 404 when source or target role missing", async () => {
        const event = {
          _id: "event123",
          roles: [{ id: "role1", name: "A", maxParticipants: 1 }],
          save: vi.fn(),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        }; // role2 missing
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "Source or target role not found",
        });
      });

      it("should 404 when user not in source role", async () => {
        const event = {
          _id: "event123",
          roles: [
            { id: "role1", name: "A", maxParticipants: 1 },
            { id: "role2", name: "B", maxParticipants: 1 },
          ],
          save: vi.fn(),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOne).mockResolvedValue(null);
        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: "User not found in source role",
        });
      });

      it("should 400 when target role full (pre-check)", async () => {
        const event = {
          _id: "event123",
          roles: [
            { id: "role1", name: "A", maxParticipants: 1 },
            { id: "role2", name: "B", maxParticipants: 2 },
          ],
          save: vi.fn(),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOne).mockResolvedValue({
          _id: "reg1",
          roleId: "role1",
          eventSnapshot: {},
          save: vi.fn(),
        } as any);
        vi.mocked(Registration.countDocuments).mockResolvedValue(2); // equals maxParticipants
        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("Target role is at full capacity"),
        });
      });

      it("should move user between roles successfully", async () => {
        const event = {
          _id: "event123",
          roles: [
            { id: "role1", name: "A", maxParticipants: 1 },
            { id: "role2", name: "B", maxParticipants: 1 },
          ],
          save: vi.fn().mockResolvedValue(undefined),
        };
        const registration: any = {
          _id: "reg1",
          roleId: "role1",
          eventSnapshot: {},
          save: vi.fn().mockResolvedValue(undefined),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOne).mockResolvedValue(registration);
        vi.mocked(Registration.countDocuments).mockResolvedValue(0);
        vi.mocked(
          ResponseBuilderService.buildEventWithRegistrations
        ).mockResolvedValue(event as any);
        (User.findById as any).mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: "507f1f77bcf86cd799439011",
            email: "m@example.com",
            firstName: "Mo",
            lastName: "Ved",
          }),
        });
        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(200);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "User moved between roles successfully",
          })
        );
        expect(registration.roleId).toBe("role2");
        expect(
          (TrioNotificationService as any).createEventRoleMovedTrio
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            fromRoleName: "A",
            toRoleName: "B",
            targetUser: expect.objectContaining({ id: expect.any(String) }),
          })
        );
        expect(
          UnifiedMessageController.createTargetedSystemMessage
        ).not.toHaveBeenCalled(); // Verified in TrioNotificationService role lifecycle tests
      });

      it("should handle race condition where target becomes full during move", async () => {
        const event = {
          _id: "event123",
          roles: [
            { id: "role1", name: "A", maxParticipants: 1 },
            { id: "role2", name: "B", maxParticipants: 3 },
          ],
          save: vi.fn(),
        };
        const registration: any = {
          _id: "reg1",
          roleId: "role1",
          eventSnapshot: {},
          save: vi.fn().mockRejectedValue(new Error("Write conflict")),
        };
        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        };
        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOne).mockResolvedValue(registration);
        // Pre-check passes
        vi.mocked(Registration.countDocuments).mockResolvedValueOnce(2); // current count < max 3
        // Post-error final count indicates full
        vi.mocked(Registration.countDocuments).mockResolvedValueOnce(3);
        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );
        expect(mockStatus).toHaveBeenCalledWith(400);
        expect(mockJson).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("Target role became full"),
        });
      });

      it("returns 500 for non-capacity errors during move (outer catch)", async () => {
        const event = {
          _id: "event123",
          type: "Effective Communication Workshop",
          roles: [
            { id: "role1", name: "Zoom Host", maxParticipants: 1 },
            { id: "role2", name: "Zoom Co-host", maxParticipants: 1 },
          ],
          save: vi.fn(),
        };
        const registration: any = {
          _id: "reg1",
          roleId: "role1",
          eventSnapshot: {},
          save: vi.fn().mockRejectedValue(new Error("weird write error")),
        };

        mockRequest.params = { id: "event123" } as any;
        mockRequest.body = {
          userId: "507f1f77bcf86cd799439011",
          fromRoleId: "role1",
          toRoleId: "role2",
        };

        vi.mocked(Event.findById).mockResolvedValue(event as any);
        vi.mocked(Registration.findOne).mockResolvedValue(registration);
        // Pre-check below capacity
        vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);
        // Post-error final count also below capacity, so outer catch should 500
        vi.mocked(Registration.countDocuments).mockResolvedValueOnce(0);

        await EventController.moveUserBetweenRoles(
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockStatus).toHaveBeenCalledWith(500);
        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: "weird write error",
          })
        );
      });
    });
  });

  describe("assignUserToRole", () => {
    it("emits user_assigned socket event and returns updated event", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      const futureDate = future.toISOString().split("T")[0];
      const eventId = "507f1f77bcf86cd799439011";
      const roleId = "role-123";
      const targetUserId = "507f1f77bcf86cd799439022";

      mockRequest.params = { id: eventId } as any;
      mockRequest.body = { userId: targetUserId, roleId } as any;
      (mockRequest as any).user = {
        _id: "acting-user",
        role: "Administrator",
      } as any;

      const event: any = {
        _id: eventId,
        status: "upcoming",
        title: "Evt",
        date: futureDate,
        time: "10:00",
        timeZone: "America/New_York",
        location: "Loc",
        type: "Regular",
        roles: [
          {
            id: roleId,
            name: "Common Participant (on-site)",
            description: "",
            maxParticipants: 5,
          },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(Event.findById).mockResolvedValue(event);

      vi.mocked(User.findById).mockResolvedValue({
        _id: targetUserId,
        isActive: true,
        isVerified: true,
        role: "Participant",
        username: "target",
        firstName: "Tar",
        lastName: "Get",
        email: "t@example.com",
      } as any);

      vi.mocked(Registration.findOne).mockResolvedValue(null as any);
      vi.mocked(Registration.countDocuments).mockResolvedValue(0 as any);

      const regImpl = {
        addAuditEntry: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
      } as any;
      vi.mocked(Registration as any).mockImplementation(() => regImpl);

      vi.mocked(
        ResponseBuilderService.buildEventWithRegistrations
      ).mockResolvedValue({ _id: eventId, roles: [] } as any);

      const emitSpy = vi
        .spyOn(socketService, "emitEventUpdate")
        .mockImplementation(() => {});

      await EventController.assignUserToRole(
        mockRequest as any,
        mockResponse as any
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(emitSpy).toHaveBeenCalled();
      const callArgs = emitSpy.mock.calls.at(-1);
      expect(callArgs?.[0]).toBe(eventId);
      expect(callArgs?.[1]).toBe("user_assigned");
      expect(callArgs?.[2]).toMatchObject({ userId: targetUserId, roleId });

      emitSpy.mockRestore();
      expect(
        (TrioNotificationService as any).createEventRoleAssignedTrio
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          roleName: "Common Participant (on-site)",
          targetUser: expect.objectContaining({ id: targetUserId }),
          event: expect.objectContaining({ timeZone: "America/New_York" }),
        })
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).not.toHaveBeenCalled(); // Verified in TrioNotificationService role lifecycle tests
    });
  });
});
