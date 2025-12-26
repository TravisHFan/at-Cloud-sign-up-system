import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GuestTokenCancellationController from "../../../../src/controllers/guest/GuestTokenCancellationController";

// Mock crypto module
vi.mock("crypto", async () => {
  return {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => "hashedtoken123"),
      })),
    })),
  };
});

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findOne: vi.fn(),
    deleteOne: vi.fn(),
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

vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitEventUpdate: vi.fn(),
  },
}));

import { GuestRegistration } from "../../../../src/models";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

interface MockRequest {
  params: Record<string, string>;
}

describe("GuestTokenCancellationController", () => {
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
        token: "validtoken123",
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("cancelByToken", () => {
    describe("Invalid Token", () => {
      it("should return 404 for invalid or expired token", async () => {
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

        await GuestTokenCancellationController.cancelByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid or expired link",
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
        status: "registered",
        manageToken: "hashedtoken123",
        manageTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day in future
      };

      beforeEach(() => {
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuestRegistration
        );
        vi.mocked(GuestRegistration.deleteOne).mockResolvedValue({
          deletedCount: 1,
        } as any);
      });

      it("should delete guest registration successfully", async () => {
        await GuestTokenCancellationController.cancelByToken(
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

      it("should emit socket event for cancellation", async () => {
        await GuestTokenCancellationController.cancelByToken(
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

      it("should succeed even if socket emission fails", async () => {
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket failed");
        });

        await GuestTokenCancellationController.cancelByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          message: "Guest registration cancelled successfully",
        });
      });
    });

    describe("Fallback Token Lookup", () => {
      it("should try fallback lookup when findByManageToken returns null", async () => {
        // First call returns null (findByManageToken), second returns doc (fallback)
        const mockGuestRegistration = {
          _id: "guestreg123",
          eventId: { toString: () => "event123" },
          roleId: "role456",
          fullName: "John Guest",
          status: "cancelled", // Already cancelled
          manageToken: "hashedtoken123",
        };

        vi.mocked(GuestRegistration.findOne)
          .mockResolvedValueOnce(null) // findByManageToken
          .mockResolvedValueOnce(mockGuestRegistration); // fallback lookup

        vi.mocked(GuestRegistration.deleteOne).mockResolvedValue({
          deletedCount: 1,
        } as any);

        await GuestTokenCancellationController.cancelByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findOne).toHaveBeenCalledTimes(2);
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should return 404 when both lookups fail", async () => {
        vi.mocked(GuestRegistration.findOne)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        await GuestTokenCancellationController.cancelByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid or expired link",
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findOne).mockRejectedValue(
          new Error("Database error")
        );

        await GuestTokenCancellationController.cancelByToken(
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
    });
  });
});
