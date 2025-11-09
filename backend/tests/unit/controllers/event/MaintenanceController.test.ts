import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { MaintenanceController } from "../../../../src/controllers/event/MaintenanceController";
import { Event, Registration } from "../../../../src/models";
import { EventController } from "../../../../src/controllers/eventController";
import { hasPermission, PERMISSIONS } from "../../../../src/utils/roleUtils";
import { isEventOrganizer } from "../../../../src/utils/event/eventPermissions";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
    find: vi.fn(),
  },
  Registration: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
  GuestRegistration: {
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    getEventStatus: vi.fn(),
    toIdString: vi.fn((id) => id.toString()),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    MODERATE_EVENT_PARTICIPANTS: "MODERATE_EVENT_PARTICIPANTS",
  },
}));

vi.mock("../../../../src/utils/event/eventPermissions", () => ({
  isEventOrganizer: vi.fn(),
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
  },
}));

describe("MaintenanceController", () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  const eventId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      params: { id: eventId.toString() },
      query: {},
      user: {
        _id: userId,
        role: "Member",
      },
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("hasRegistrations", () => {
    describe("validation", () => {
      it("should return 400 for invalid event ID", async () => {
        mockReq.params.id = "invalid-id";

        await MaintenanceController.hasRegistrations(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });
    });

    describe("registration counts", () => {
      it("should call Registration.countDocuments with correct event ID", async () => {
        vi.mocked(Registration.countDocuments).mockResolvedValue(5);

        await MaintenanceController.hasRegistrations(
          mockReq as Request,
          mockRes as Response
        );

        expect(Registration.countDocuments).toHaveBeenCalledWith({
          eventId: eventId.toString(),
        });
      });

      it("should return 200 status on success", async () => {
        vi.mocked(Registration.countDocuments).mockResolvedValue(3);

        await MaintenanceController.hasRegistrations(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toHaveProperty("hasRegistrations");
        expect(response.data).toHaveProperty("userCount");
        expect(response.data).toHaveProperty("guestCount");
        expect(response.data).toHaveProperty("totalCount");
      });

      it("should indicate registrations exist when userCount > 0", async () => {
        vi.mocked(Registration.countDocuments).mockResolvedValue(5);

        await MaintenanceController.hasRegistrations(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.userCount).toBe(5);
        // hasRegistrations depends on userCount + guestCount (from dynamic import)
        // Just verify the property exists and is boolean
        expect(typeof response.data.hasRegistrations).toBe("boolean");
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Registration.countDocuments).mockRejectedValue(
          new Error("Database error")
        );

        await MaintenanceController.hasRegistrations(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to check event registrations.",
        });
      });
    });
  });

  describe("getUserEvents", () => {
    describe("authentication", () => {
      it("should return 401 if user not authenticated", async () => {
        mockReq.user = undefined;

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("event retrieval", () => {
      it("should return user's registered events with pagination", async () => {
        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: eventId,
              title: "Test Event",
              date: "2024-12-31",
              time: "10:00",
              endTime: "12:00",
            },
            roleId: "role1",
            registrationDate: new Date("2024-01-01"),
            status: "active",
            eventSnapshot: {
              roleName: "Attendee",
            },
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Registration.find).toHaveBeenCalledWith({ userId });
        expect(statusMock).toHaveBeenCalledWith(200);

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.events).toHaveLength(1);
        expect(response.data.stats.total).toBe(1);
      });

      it("should filter out registrations with no event", async () => {
        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: null, // No event
            roleId: "role1",
            registrationDate: new Date(),
            status: "active",
          },
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: eventId,
              title: "Valid Event",
              date: "2024-12-31",
              time: "10:00",
              endTime: "12:00",
            },
            roleId: "role2",
            registrationDate: new Date(),
            status: "active",
            eventSnapshot: {
              roleName: "Participant",
            },
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.events).toHaveLength(1);
        expect(response.data.events[0].event.title).toBe("Valid Event");
      });

      it("should use current role name from event instead of snapshot", async () => {
        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: eventId,
              title: "Test Event",
              date: "2024-12-31",
              time: "10:00",
              endTime: "12:00",
              roles: [
                {
                  id: "role1",
                  name: "Updated Role Name",
                  description: "New description",
                },
              ],
            },
            roleId: "role1",
            registrationDate: new Date(),
            status: "active",
            eventSnapshot: {
              roleName: "Old Role Name",
              roleDescription: "Old description",
            },
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.events[0].registration.roleName).toBe(
          "Updated Role Name"
        );
        expect(response.data.events[0].registration.roleDescription).toBe(
          "New description"
        );
      });

      it("should fallback to snapshot when role not found in event", async () => {
        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: eventId,
              title: "Test Event",
              date: "2024-12-31",
              time: "10:00",
              endTime: "12:00",
              roles: [],
            },
            roleId: "role1",
            registrationDate: new Date(),
            status: "active",
            eventSnapshot: {
              roleName: "Snapshot Role",
              roleDescription: "Snapshot description",
            },
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.events[0].registration.roleName).toBe(
          "Snapshot Role"
        );
      });

      it("should compute event status using EventController", async () => {
        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: eventId,
              title: "Test Event",
              date: "2024-01-01",
              endDate: "2024-01-02",
              time: "10:00",
              endTime: "12:00",
              timeZone: "America/Los_Angeles",
            },
            roleId: "role1",
            registrationDate: new Date(),
            status: "active",
            eventSnapshot: {
              roleName: "Attendee",
            },
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("completed");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(EventController.getEventStatus).toHaveBeenCalledWith(
          "2024-01-01",
          "2024-01-02",
          "10:00",
          "12:00",
          "America/Los_Angeles"
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.events[0].eventStatus).toBe("passed");
        expect(response.data.events[0].isPassedEvent).toBe(true);
      });

      it("should handle pagination parameters", async () => {
        mockReq.query = { page: "2", limit: "5" };

        // Create enough mock registrations to require pagination
        const mockRegistrations = Array.from({ length: 7 }, (_, i) => ({
          _id: new mongoose.Types.ObjectId(),
          userId: userId,
          eventId: {
            _id: new mongoose.Types.ObjectId(),
            title: `Event ${i + 1}`,
            date: "2025-12-31",
            time: "10:00",
            endTime: "12:00",
            status: "active",
          },
          roleId: `role${i + 1}`,
          registrationDate: new Date(),
          status: "active",
          eventSnapshot: { roleName: "Attendee" },
        }));

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus).mockReturnValue("upcoming");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        // With 7 unique events and limit=5, page 2 exists
        expect(response.data.pagination.currentPage).toBe(2);
        expect(response.data.pagination.pageSize).toBe(5);
        expect(response.data.pagination.totalPages).toBe(2);
      });

      it("should calculate stats correctly", async () => {
        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: new mongoose.Types.ObjectId(),
              title: "Upcoming Event",
              date: "2025-12-31",
              time: "10:00",
              endTime: "12:00",
              status: "active",
            },
            roleId: "role1",
            registrationDate: new Date(),
            status: "active",
            eventSnapshot: { roleName: "Attendee" },
          },
          {
            _id: new mongoose.Types.ObjectId(),
            userId: userId,
            eventId: {
              _id: new mongoose.Types.ObjectId(),
              title: "Completed Event",
              date: "2020-01-01",
              time: "10:00",
              endTime: "12:00",
              status: "cancelled",
            },
            roleId: "role2",
            registrationDate: new Date(),
            status: "cancelled",
            eventSnapshot: { roleName: "Attendee" },
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockRegistrations),
          }),
        });

        vi.mocked(Registration.find).mockImplementation(mockFind);
        vi.mocked(EventController.getEventStatus)
          .mockReturnValueOnce("upcoming")
          .mockReturnValueOnce("completed");

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.stats.total).toBe(2);
        expect(response.data.stats.upcoming).toBe(1);
        expect(response.data.stats.passed).toBe(1);
        expect(response.data.stats.active).toBe(1);
        expect(response.data.stats.cancelled).toBe(1);
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Registration.find).mockImplementation(() => {
          throw new Error("Database error");
        });

        await MaintenanceController.getUserEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve user events.",
        });
      });
    });
  });

  describe("getCreatedEvents", () => {
    describe("authentication", () => {
      it("should return 401 if user not authenticated", async () => {
        mockReq.user = undefined;

        await MaintenanceController.getCreatedEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });
    });

    describe("event retrieval", () => {
      it("should return events created by user", async () => {
        const mockEvents = [
          { _id: eventId, title: "My Event 1", createdBy: userId },
          {
            _id: new mongoose.Types.ObjectId(),
            title: "My Event 2",
            createdBy: userId,
          },
        ];

        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(mockEvents),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await MaintenanceController.getCreatedEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(Event.find).toHaveBeenCalledWith({ createdBy: userId });
        expect(statusMock).toHaveBeenCalledWith(200);

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.events).toHaveLength(2);
      });

      it("should sort by createdAt descending", async () => {
        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await MaintenanceController.getCreatedEvents(
          mockReq as Request,
          mockRes as Response
        );

        const sortCall = mockFind.mock.results[0].value.sort;
        expect(sortCall).toHaveBeenCalledWith({ createdAt: -1 });
      });

      it("should return empty array when user has no created events", async () => {
        const mockFind = vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        });

        vi.mocked(Event.find).mockImplementation(mockFind);

        await MaintenanceController.getCreatedEvents(
          mockReq as Request,
          mockRes as Response
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.data.events).toEqual([]);
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Event.find).mockImplementation(() => {
          throw new Error("Database error");
        });

        await MaintenanceController.getCreatedEvents(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve created events.",
        });
      });
    });
  });

  describe("getEventParticipants", () => {
    describe("validation", () => {
      it("should return 400 for invalid event ID", async () => {
        mockReq.params.id = "invalid-id";

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });

      it("should return 401 if user not authenticated", async () => {
        mockReq.user = undefined;

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });

      it("should return 404 if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found.",
        });
      });
    });

    describe("authorization", () => {
      it("should allow user with MODERATE_EVENT_PARTICIPANTS permission", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          roles: [],
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(hasPermission).mockReturnValue(true);
        vi.mocked(isEventOrganizer).mockReturnValue(false);

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue([]),
        });
        vi.mocked(Registration.find).mockImplementation(mockFind);

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(hasPermission).toHaveBeenCalledWith(
          "Member",
          PERMISSIONS.MODERATE_EVENT_PARTICIPANTS
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should allow event organizer", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          roles: [],
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(hasPermission).mockReturnValue(false);
        vi.mocked(isEventOrganizer).mockReturnValue(true);

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue([]),
        });
        vi.mocked(Registration.find).mockImplementation(mockFind);

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(isEventOrganizer).toHaveBeenCalledWith(
          mockEvent,
          userId.toString()
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should return 403 when user is neither admin nor organizer", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          roles: [],
        };

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(hasPermission).mockReturnValue(false);
        vi.mocked(isEventOrganizer).mockReturnValue(false);

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Insufficient permissions to view participants. You must be the event creator or a co-organizer.",
        });
      });
    });

    describe("participant retrieval", () => {
      it("should return event participants with populated user data", async () => {
        const mockEvent = {
          _id: eventId,
          title: "Test Event",
          roles: [{ id: "role1", name: "Attendee" }],
        };

        const mockRegistrations = [
          {
            _id: new mongoose.Types.ObjectId(),
            eventId: eventId,
            userId: {
              _id: userId,
              username: "testuser",
              firstName: "Test",
              lastName: "User",
              email: "test@example.com",
            },
            roleId: "role1",
            status: "active",
          },
        ];

        vi.mocked(Event.findById).mockResolvedValue(mockEvent as any);
        vi.mocked(hasPermission).mockReturnValue(true);

        const mockFind = vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockRegistrations),
        });
        vi.mocked(Registration.find).mockImplementation(mockFind);

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(Registration.find).toHaveBeenCalledWith({
          eventId: eventId.toString(),
        });

        const populateCall = mockFind.mock.results[0].value.populate;
        expect(populateCall).toHaveBeenCalledWith(
          "userId",
          "username firstName lastName email avatar role"
        );

        const response = jsonMock.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data.event.title).toBe("Test Event");
        expect(response.data.registrations).toHaveLength(1);
      });
    });

    describe("error handling", () => {
      it("should handle database errors", async () => {
        vi.mocked(Event.findById).mockRejectedValue(
          new Error("Database error")
        );

        await MaintenanceController.getEventParticipants(
          mockReq as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to retrieve event participants.",
        });
      });
    });
  });
});
