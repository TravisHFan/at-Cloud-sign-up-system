import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import mongoose from "mongoose";
import GuestRoleManagementController from "../../../../src/controllers/guest/GuestRoleManagementController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findById: vi.fn(),
  },
  Event: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LockService", () => ({
  lockService: {
    withLock: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CapacityService", () => ({
  CapacityService: {
    getRoleOccupancy: vi.fn(),
    isRoleFull: vi.fn(),
  },
}));

vi.mock("../../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
    invalidateAnalyticsCache: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ResponseBuilderService", () => ({
  ResponseBuilderService: {
    buildEventWithRegistrations: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventRoleMovedEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { GuestRegistration, Event } from "../../../../src/models";
import { lockService } from "../../../../src/services/LockService";
import { CapacityService } from "../../../../src/services/CapacityService";
import { CachePatterns } from "../../../../src/services";
import { ResponseBuilderService } from "../../../../src/services/ResponseBuilderService";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  params: {
    id?: string;
  };
  body: {
    guestRegistrationId?: string;
    fromRoleId?: string;
    toRoleId?: string;
  };
}

describe("GuestRoleManagementController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  const validEventId = new mongoose.Types.ObjectId().toString();
  const validGuestId = new mongoose.Types.ObjectId().toString();
  const fromRoleId = "role-source";
  const toRoleId = "role-target";

  const createMockEvent = () => ({
    _id: validEventId,
    title: "Test Event",
    roles: [
      { id: fromRoleId, name: "Source Role", maxParticipants: 10 },
      { id: toRoleId, name: "Target Role", maxParticipants: 10 },
    ],
    save: vi.fn().mockResolvedValue(true),
  });

  const createMockGuest = () => ({
    _id: validGuestId,
    eventId: { toString: () => validEventId },
    roleId: fromRoleId,
    email: "guest@test.com",
    fullName: "Test Guest",
    status: "confirmed",
    save: vi.fn().mockResolvedValue(true),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      user: {
        _id: "admin123",
        firstName: "Admin",
        lastName: "User",
      },
      params: { id: validEventId },
      body: {
        guestRegistrationId: validGuestId,
        fromRoleId,
        toRoleId,
      },
    };

    vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(undefined);
    vi.mocked(CachePatterns.invalidateAnalyticsCache).mockResolvedValue(
      undefined
    );
    vi.mocked(
      ResponseBuilderService.buildEventWithRegistrations
    ).mockResolvedValue({
      _id: validEventId,
      title: "Test Event",
    } as any);
    vi.mocked(EmailService.sendEventRoleMovedEmail).mockResolvedValue(
      undefined as any
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("moveGuestBetweenRoles", () => {
    describe("Validation", () => {
      it("should return 400 for invalid event ID", async () => {
        mockReq.params.id = "invalid-id";

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid event ID.",
        });
      });

      it("should return 400 for invalid guest registration ID", async () => {
        mockReq.body.guestRegistrationId = "invalid-id";

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid guest registration ID.",
        });
      });

      it("should return 400 if fromRoleId is missing", async () => {
        mockReq.body.fromRoleId = undefined;

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Source and target role IDs are required.",
        });
      });

      it("should return 400 if toRoleId is missing", async () => {
        mockReq.body.toRoleId = undefined;

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Source and target role IDs are required.",
        });
      });

      it("should return 200 with no-op if fromRoleId equals toRoleId", async () => {
        mockReq.body.toRoleId = fromRoleId;

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "No change - same role",
          data: {},
        });
      });
    });

    describe("Resource Not Found", () => {
      it("should return 404 if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Event not found",
        });
      });

      it("should return 404 if source role not found", async () => {
        const mockEvent = createMockEvent();
        mockEvent.roles = [
          { id: toRoleId, name: "Target Role", maxParticipants: 10 },
        ];
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Source or target role not found",
        });
      });

      it("should return 404 if target role not found", async () => {
        const mockEvent = createMockEvent();
        mockEvent.roles = [
          { id: fromRoleId, name: "Source Role", maxParticipants: 10 },
        ];
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Source or target role not found",
        });
      });

      it("should return 404 if guest registration not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(createMockEvent());
        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Guest registration not found",
        });
      });
    });

    describe("Guest State Validation", () => {
      it("should return 400 for cancelled registration", async () => {
        vi.mocked(Event.findById).mockResolvedValue(createMockEvent());
        const mockGuest = createMockGuest();
        mockGuest.status = "cancelled";
        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Cannot move a cancelled registration",
        });
      });

      it("should return 400 if registration does not belong to event", async () => {
        vi.mocked(Event.findById).mockResolvedValue(createMockEvent());
        const mockGuest = createMockGuest();
        mockGuest.eventId = { toString: () => "different-event-id" };
        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Registration does not belong to this event",
        });
      });

      it("should return 400 if registration is not in source role", async () => {
        vi.mocked(Event.findById).mockResolvedValue(createMockEvent());
        const mockGuest = createMockGuest();
        mockGuest.roleId = "different-role";
        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest);

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Registration is not in the specified source role",
        });
      });
    });

    describe("Capacity Check", () => {
      it("should return 400 if target role is at full capacity", async () => {
        const mockEvent = createMockEvent();
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          createMockGuest()
        );
        vi.mocked(lockService.withLock).mockImplementation(
          async (_key, fn: () => Promise<any>) => {
            // Mock capacity being full inside the lock
            vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
              total: 10,
              capacity: 10,
            } as any);
            vi.mocked(CapacityService.isRoleFull).mockReturnValue(true);
            return {
              type: "error",
              status: 400,
              message: "Target role is at full capacity (10/$10)",
            };
          }
        );

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: expect.stringContaining("full capacity"),
          })
        );
      });
    });

    describe("Successful Move", () => {
      beforeEach(() => {
        const mockEvent = createMockEvent();
        const mockGuest = createMockGuest();

        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(GuestRegistration.findById).mockResolvedValue(mockGuest);
        vi.mocked(lockService.withLock).mockImplementation(
          async (_key, fn: () => Promise<any>) => {
            vi.mocked(CapacityService.getRoleOccupancy).mockResolvedValue({
              total: 5,
              capacity: 10,
            } as any);
            vi.mocked(CapacityService.isRoleFull).mockReturnValue(false);
            return fn();
          }
        );
      });

      it("should move guest successfully", async () => {
        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Guest moved between roles successfully",
          })
        );
      });

      it("should invalidate caches after move", async () => {
        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(CachePatterns.invalidateEventCache).toHaveBeenCalledWith(
          validEventId
        );
        expect(CachePatterns.invalidateAnalyticsCache).toHaveBeenCalled();
      });

      it("should send email notification to guest", async () => {
        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleMovedEmail).toHaveBeenCalledWith(
          "guest@test.com",
          expect.objectContaining({
            fromRoleName: "Source Role",
            toRoleName: "Target Role",
          })
        );
      });

      it("should emit socket events", async () => {
        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          validEventId,
          "guest_updated",
          expect.any(Object)
        );
        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          validEventId,
          "guest_moved",
          expect.objectContaining({
            fromRoleId,
            toRoleId,
            fromRoleName: "Source Role",
            toRoleName: "Target Role",
          })
        );
      });

      it("should continue even if email fails", async () => {
        vi.mocked(EmailService.sendEventRoleMovedEmail).mockRejectedValue(
          new Error("Email failed")
        );

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to send guest moved email:",
          expect.any(Error)
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(Event.findById).mockRejectedValue(
          new Error("Database error")
        );

        await GuestRoleManagementController.moveGuestBetweenRoles(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Database error",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
