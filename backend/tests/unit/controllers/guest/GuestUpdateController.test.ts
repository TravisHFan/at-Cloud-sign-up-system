import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GuestUpdateController from "../../../../src/controllers/guest/GuestUpdateController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findById: vi.fn(),
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

import { GuestRegistration } from "../../../../src/models";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  params: {
    id?: string;
    guestId?: string;
  };
  body: {
    fullName?: string;
    phone?: string;
    notes?: string;
  };
}

describe("GuestUpdateController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const guestId = "guest123";

  const createMockGuest = (overrides = {}) => ({
    _id: guestId,
    eventId: { toString: () => "event123" },
    roleId: "role1",
    fullName: "Test Guest",
    email: "guest@test.com",
    phone: "1234567890",
    notes: "Some notes",
    status: "confirmed",
    save: vi.fn().mockResolvedValue(true),
    toPublicJSON: vi.fn().mockReturnValue({
      id: guestId,
      fullName: "Test Guest",
      email: "guest@test.com",
      phone: "1234567890",
    }),
    ...overrides,
  });

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
      params: { id: guestId },
      body: {
        fullName: "Updated Guest",
        phone: "9876543210",
        notes: "Updated notes",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("updateGuestRegistration", () => {
    describe("Validation", () => {
      it("should return 400 if guest registration id is missing", async () => {
        mockReq.params.id = undefined;

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Missing guest registration id",
        });
      });

      it("should support guestId param alias", async () => {
        mockReq.params = { guestId };
        delete mockReq.params.id;
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(GuestRegistration.findById).toHaveBeenCalledWith(guestId);
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Resource Not Found", () => {
      it("should return 404 if guest registration not found", async () => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Guest registration not found",
        });
      });
    });

    describe("Status Validation", () => {
      it("should return 400 for cancelled registration", async () => {
        const mockGuest = createMockGuest({ status: "cancelled" });
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Cannot update cancelled registration",
        });
      });
    });

    describe("Successful Update", () => {
      it("should update guest registration successfully", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(mockGuest.fullName).toBe("Updated Guest");
        expect(mockGuest.phone).toBe("9876543210");
        expect(mockGuest.notes).toBe("Updated notes");
        expect(mockGuest.save).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Guest registration updated successfully",
          }),
        );
      });

      it("should trim whitespace from input fields", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );
        mockReq.body = {
          fullName: "  Trimmed Name  ",
          notes: "  Trimmed Notes  ",
        };

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(mockGuest.fullName).toBe("Trimmed Name");
        expect(mockGuest.notes).toBe("Trimmed Notes");
      });

      it("should clear phone when empty string provided", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );
        mockReq.body = { phone: "" };

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(mockGuest.phone).toBeUndefined();
      });

      it("should emit socket update after save", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "guest_updated",
          expect.objectContaining({
            eventId: "event123",
            roleId: "role1",
            guestName: "Updated Guest",
          }),
        );
      });

      it("should succeed even if socket emit fails", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket error");
        });

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to emit guest update:",
          expect.any(Error),
        );
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findById).mockRejectedValue(
          new Error("Database error"),
        );

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update guest registration",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("should return 500 if save fails", async () => {
        const mockGuest = createMockGuest();
        mockGuest.save.mockRejectedValue(new Error("Save failed"));
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update guest registration",
        });
      });

      it("should handle non-string phone value (e.g., number)", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );
        mockReq.body = { phone: 12345 as unknown as string };

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        // Non-string phone triggers the else branch which sets to undefined
        expect(mockGuest.phone).toBeUndefined();
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should update phone when valid string provided", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );
        mockReq.body = { phone: "555-123-4567" };

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        expect(mockGuest.phone).toBe("555-123-4567");
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should handle whitespace-only phone as empty", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuest as any,
        );
        mockReq.body = { phone: "   " };

        await GuestUpdateController.updateGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response,
        );

        // Whitespace only should be treated as empty (undefined)
        expect(mockGuest.phone).toBeUndefined();
        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });
  });
});
