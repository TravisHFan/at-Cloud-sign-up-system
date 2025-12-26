import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GuestCancellationController from "../../../../src/controllers/guest/GuestCancellationController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findById: vi.fn(),
    deleteOne: vi.fn(),
  },
  Event: {
    findById: vi.fn(),
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

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEventRoleRemovedEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

import { GuestRegistration, Event } from "../../../../src/models";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  params: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  user?: {
    _id: string;
    firstName?: string;
    lastName?: string;
  };
}

describe("GuestCancellationController", () => {
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
      status: statusMock as unknown as Response["status"],
      json: jsonMock as unknown as Response["json"],
    };

    mockReq = {
      params: {
        id: "guestreg123",
      },
      body: {},
      user: {
        _id: "admin123",
        firstName: "Admin",
        lastName: "User",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("cancelGuestRegistration", () => {
    describe("Validation", () => {
      it("should return 400 if no guest registration id provided", async () => {
        mockReq.params = {};

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing guest registration id",
        });
      });

      it("should accept id from params.guestId", async () => {
        mockReq.params = { guestId: "guestreg456" };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findById).toHaveBeenCalledWith("guestreg456");
      });

      it("should accept id from params.id", async () => {
        mockReq.params = { id: "guestreg789" };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findById).toHaveBeenCalledWith("guestreg789");
      });
    });

    describe("Not Found", () => {
      it("should return 404 if guest registration not found", async () => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestCancellationController.cancelGuestRegistration(
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

    describe("Successful Cancellation", () => {
      const mockGuestRegistration = {
        _id: "guestreg123",
        eventId: {
          toString: () => "event123",
        },
        roleId: "role456",
        fullName: "John Guest",
        email: "guest@test.com",
        eventSnapshot: {
          roleName: "Speaker",
        },
      };

      const mockEvent = {
        _id: "event123",
        title: "Test Event",
        roles: [{ id: "role456", name: "Speaker" }],
      };

      beforeEach(() => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuestRegistration
        );
        vi.mocked(GuestRegistration.deleteOne).mockResolvedValue({
          deletedCount: 1,
        } as any);
        vi.mocked(Event.findById).mockResolvedValue(mockEvent);
        vi.mocked(EmailService.sendEventRoleRemovedEmail).mockResolvedValue(
          true
        );
      });

      it("should delete guest registration successfully", async () => {
        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.deleteOne).toHaveBeenCalledWith({
          _id: mockGuestRegistration._id,
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Guest registration cancelled successfully",
        });
      });

      it("should send removal email to guest", async () => {
        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleRemovedEmail).toHaveBeenCalledWith(
          "guest@test.com",
          {
            event: { title: "Test Event" },
            user: { email: "guest@test.com", name: "John Guest" },
            roleName: "Speaker",
            actor: { firstName: "Admin", lastName: "User" },
          }
        );
      });

      it("should emit socket event for cancellation", async () => {
        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "guest_cancellation",
          expect.objectContaining({
            eventId: "event123",
            roleId: "role456",
            guestName: "John Guest",
          })
        );
      });

      it("should use role name from event roles array", async () => {
        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleRemovedEmail).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            roleName: "Speaker",
          })
        );
      });

      it("should fallback to eventSnapshot roleName if role not found in event", async () => {
        vi.mocked(Event.findById).mockResolvedValue({
          _id: "event123",
          title: "Test Event",
          roles: [], // No matching role
        });

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleRemovedEmail).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            roleName: "Speaker", // Falls back to eventSnapshot.roleName
          })
        );
      });

      it("should fallback to 'the role' if no role name available", async () => {
        const registrationWithoutSnapshot = {
          ...mockGuestRegistration,
          eventSnapshot: undefined,
        };
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          registrationWithoutSnapshot
        );
        vi.mocked(Event.findById).mockResolvedValue({
          _id: "event123",
          title: "Test Event",
          roles: [],
        });

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleRemovedEmail).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            roleName: "the role",
          })
        );
      });

      it("should use 'Event' as title if event not found", async () => {
        vi.mocked(Event.findById).mockResolvedValue(null);

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleRemovedEmail).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            event: { title: "Event" },
          })
        );
      });
    });

    describe("Email Error Handling", () => {
      const mockGuestRegistration = {
        _id: "guestreg123",
        eventId: { toString: () => "event123" },
        roleId: "role456",
        fullName: "John Guest",
        email: "guest@test.com",
      };

      it("should succeed even if email sending fails", async () => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuestRegistration
        );
        vi.mocked(GuestRegistration.deleteOne).mockResolvedValue({
          deletedCount: 1,
        } as any);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: "event123",
          title: "Test Event",
          roles: [],
        });
        vi.mocked(EmailService.sendEventRoleRemovedEmail).mockRejectedValue(
          new Error("Email failed")
        );

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Guest registration cancelled successfully",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to send guest removal email:",
          expect.any(Error)
        );
      });
    });

    describe("Socket Error Handling", () => {
      const mockGuestRegistration = {
        _id: "guestreg123",
        eventId: { toString: () => "event123" },
        roleId: "role456",
        fullName: "John Guest",
        email: "guest@test.com",
      };

      it("should succeed even if socket emission fails", async () => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuestRegistration
        );
        vi.mocked(GuestRegistration.deleteOne).mockResolvedValue({
          deletedCount: 1,
        } as any);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: "event123",
          title: "Test Event",
          roles: [],
        });
        vi.mocked(EmailService.sendEventRoleRemovedEmail).mockResolvedValue(
          true
        );
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket failed");
        });

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Guest registration cancelled successfully",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to emit cancellation update:",
          expect.any(Error)
        );
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findById).mockRejectedValue(
          new Error("Database error")
        );

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to cancel guest registration",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should handle actor without name properties", async () => {
        mockReq.user = { _id: "admin123" };

        const mockGuestRegistration = {
          _id: "guestreg123",
          eventId: { toString: () => "event123" },
          roleId: "role456",
          fullName: "John Guest",
          email: "guest@test.com",
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuestRegistration
        );
        vi.mocked(GuestRegistration.deleteOne).mockResolvedValue({
          deletedCount: 1,
        } as any);
        vi.mocked(Event.findById).mockResolvedValue({
          _id: "event123",
          title: "Test Event",
          roles: [],
        });
        vi.mocked(EmailService.sendEventRoleRemovedEmail).mockResolvedValue(
          true
        );

        await GuestCancellationController.cancelGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(EmailService.sendEventRoleRemovedEmail).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            actor: { firstName: "", lastName: "" },
          })
        );
      });
    });
  });
});
