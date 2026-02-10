import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { DeletionController } from "../../../../src/controllers/event/DeletionController";
import { Event, Registration } from "../../../../src/models";
import { EventCascadeService } from "../../../../src/services";
import AuditLog from "../../../../src/models/AuditLog";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Event: {
    findById: vi.fn(),
  },
  Registration: {
    deleteMany: vi.fn(),
  },
  GuestRegistration: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  EventCascadeService: {
    deleteEventFully: vi.fn(),
  },
}));

vi.mock("../../../../src/models/AuditLog", () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  PERMISSIONS: {
    DELETE_ANY_EVENT: "delete_any_event",
    DELETE_OWN_EVENT: "delete_own_event",
  },
  ROLES: {
    SUPER_ADMIN: "super-admin",
    ADMIN: "admin",
    LEADER: "leader",
    MEMBER: "member",
    GUEST: "guest",
  },
  hasPermission: vi.fn(),
}));

vi.mock("../../../../src/utils/event/eventPermissions", () => ({
  isEventOrganizer: vi.fn(),
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      error: vi.fn(),
    })),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      child: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
      })),
    })),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: vi.fn((id) => id.toString()),
  },
}));

describe("DeletionController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as any;

    req = {
      params: { id: "507f1f77bcf86cd799439011" },
      user: {
        _id: "user-id-123",
        role: "admin",
        email: "admin@example.com",
      } as any,
      ip: "127.0.0.1",
      get: vi.fn(() => "test-user-agent") as any,
    };

    res = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  describe("deleteEvent", () => {
    describe("validation", () => {
      it("should return 400 for invalid event ID", async () => {
        req.params = { id: "invalid-id" };

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });

      it("should return 401 if user is not authenticated", async () => {
        req.user = undefined;

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Authentication required.",
        });
      });

      it("should return 404 if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(Event.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found.",
        });
      });
    });

    describe("permissions", () => {
      beforeEach(() => {
        const mockEvent: any = {
          _id: "507f1f77bcf86cd799439011",
          title: "Test Event",
          type: "workshop",
          date: new Date(),
          location: "Test Location",
          signedUp: 0,
        };
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      });

      it("should return 403 if user lacks delete permissions", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        const { isEventOrganizer } =
          await import("../../../../src/utils/event/eventPermissions");

        vi.mocked(hasPermission).mockReturnValue(false);
        vi.mocked(isEventOrganizer).mockReturnValue(false);

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Insufficient permissions to delete this event. You must be the event creator or a co-organizer.",
        });
      });

      it("should allow deletion with DELETE_ANY_EVENT permission", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "delete_any_event";
        });

        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 0,
          deletedGuestRegistrations: 0,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Event deleted successfully!",
          }),
        );
      });

      it("should allow deletion with DELETE_OWN_EVENT permission if user is organizer", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        const { isEventOrganizer } =
          await import("../../../../src/utils/event/eventPermissions");

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "delete_own_event";
        });
        vi.mocked(isEventOrganizer).mockReturnValue(true);

        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 0,
          deletedGuestRegistrations: 0,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Event deleted successfully!",
          }),
        );
      });

      it("should deny deletion if user is not organizer and lacks DELETE_ANY_EVENT", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        const { isEventOrganizer } =
          await import("../../../../src/utils/event/eventPermissions");

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "delete_own_event";
        });
        vi.mocked(isEventOrganizer).mockReturnValue(false);

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message:
            "Insufficient permissions to delete this event. You must be the event creator or a co-organizer.",
        });
      });
    });

    describe("events with participants", () => {
      beforeEach(() => {
        const mockEvent: any = {
          _id: "507f1f77bcf86cd799439011",
          title: "Test Event",
          type: "workshop",
          date: new Date(),
          location: "Test Location",
          signedUp: 5, // Has participants
        };
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
      });

      it("should return 400 if event has participants and user lacks force-delete permission", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        const { isEventOrganizer } =
          await import("../../../../src/utils/event/eventPermissions");

        // User has delete_own_event but is not organizer
        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "delete_own_event";
        });
        vi.mocked(isEventOrganizer).mockReturnValue(false);

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should allow force deletion if user has DELETE_ANY_EVENT permission", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "delete_any_event";
        });

        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 5,
          deletedGuestRegistrations: 2,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: expect.stringContaining(
              "Event deleted successfully! Also removed 5 associated registrations and 2 guest registrations",
            ),
            deletedRegistrations: 5,
            deletedGuestRegistrations: 2,
          }),
        );
      });

      it("should allow force deletion if user is organizer with DELETE_OWN_EVENT", async () => {
        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        const { isEventOrganizer } =
          await import("../../../../src/utils/event/eventPermissions");

        vi.mocked(hasPermission).mockImplementation((role, permission) => {
          return permission === "delete_own_event";
        });
        vi.mocked(isEventOrganizer).mockReturnValue(true);

        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 3,
          deletedGuestRegistrations: 0,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: expect.stringContaining(
              "Event deleted successfully! Also removed 3 associated registrations",
            ),
            deletedRegistrations: 3,
          }),
        );
      });
    });

    describe("successful deletion", () => {
      beforeEach(async () => {
        const mockEvent: any = {
          _id: "507f1f77bcf86cd799439011",
          title: "Test Event",
          type: "workshop",
          date: new Date("2025-12-01"),
          location: "Test Location",
          signedUp: 0,
        };
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should delete event successfully without registrations", async () => {
        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 0,
          deletedGuestRegistrations: 0,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(EventCascadeService.deleteEventFully).toHaveBeenCalledWith(
          "507f1f77bcf86cd799439011",
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Event deleted successfully!",
        });
      });

      it("should delete event and report deleted registrations", async () => {
        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 10,
          deletedGuestRegistrations: 5,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message:
            "Event deleted successfully! Also removed 10 associated registrations and 5 guest registrations.",
          deletedRegistrations: 10,
          deletedGuestRegistrations: 5,
        });
      });

      it("should create audit log for deletion", async () => {
        const mockEvent: any = {
          _id: "507f1f77bcf86cd799439011",
          title: "Test Event",
          type: "workshop",
          date: new Date("2025-12-01"),
          location: "Test Location",
          signedUp: 0,
        };
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 3,
          deletedGuestRegistrations: 1,
        });

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(AuditLog.create).toHaveBeenCalledWith({
          action: "event_deletion",
          actor: {
            id: "user-id-123",
            role: "admin",
            email: "admin@example.com",
          },
          targetModel: "Event",
          targetId: "507f1f77bcf86cd799439011",
          details: {
            targetEvent: {
              id: mockEvent._id,
              title: "Test Event",
              type: "workshop",
              date: mockEvent.date,
              location: "Test Location",
            },
            cascadeInfo: {
              deletedRegistrations: 3,
              deletedGuestRegistrations: 1,
            },
          },
          ipAddress: "127.0.0.1",
          userAgent: "test-user-agent",
        });
      });

      it("should still succeed if audit log creation fails", async () => {
        vi.mocked(EventCascadeService.deleteEventFully).mockResolvedValue({
          deletedRegistrations: 0,
          deletedGuestRegistrations: 0,
        });

        vi.mocked(AuditLog.create).mockRejectedValue(
          new Error("Audit log failed"),
        );

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          }),
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to create audit log for event deletion:",
          expect.any(Error),
        );

        consoleErrorSpy.mockRestore();
      });
    });

    describe("error handling", () => {
      beforeEach(async () => {
        const mockEvent: any = {
          _id: "507f1f77bcf86cd799439011",
          title: "Test Event",
          signedUp: 0,
        };
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        const { hasPermission } =
          await import("../../../../src/utils/roleUtils");
        vi.mocked(hasPermission).mockReturnValue(true);
      });

      it("should handle cascade deletion errors", async () => {
        vi.mocked(EventCascadeService.deleteEventFully).mockRejectedValue(
          new Error("Cascade deletion failed"),
        );

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to delete event.",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Delete event error:",
          expect.any(Error),
        );

        consoleErrorSpy.mockRestore();
      });

      it("should handle database errors", async () => {
        vi.mocked(Event.findById).mockRejectedValue(
          new Error("Database connection lost"),
        );

        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await DeletionController.deleteEvent(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to delete event.",
        });

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe("deleteAllRegistrationsForEvent", () => {
    it("should delete all user and guest registrations", async () => {
      const { GuestRegistration } = await import("../../../../src/models");

      vi.mocked(Registration.deleteMany).mockResolvedValue({
        deletedCount: 10,
      } as any);

      vi.mocked(GuestRegistration.deleteMany).mockResolvedValue({
        deletedCount: 5,
      } as any);

      const result =
        await DeletionController.deleteAllRegistrationsForEvent("event-id-123");

      expect(Registration.deleteMany).toHaveBeenCalledWith({
        eventId: "event-id-123",
      });
      expect(result.deletedRegistrations).toBe(10);
      expect(result.deletedGuestRegistrations).toBe(5);
    });

    it("should handle user registration deletion errors", async () => {
      vi.mocked(Registration.deleteMany).mockRejectedValue(
        new Error("Delete failed"),
      );

      await expect(
        DeletionController.deleteAllRegistrationsForEvent("event-id-123"),
      ).rejects.toThrow("Delete failed");
    });

    it("should handle guest registration deletion errors", async () => {
      const { GuestRegistration } = await import("../../../../src/models");

      vi.mocked(Registration.deleteMany).mockResolvedValue({
        deletedCount: 10,
      } as any);

      vi.mocked(GuestRegistration.deleteMany).mockRejectedValue(
        new Error("Guest delete failed"),
      );

      await expect(
        DeletionController.deleteAllRegistrationsForEvent("event-id-123"),
      ).rejects.toThrow("Guest delete failed");
    });
  });
});
