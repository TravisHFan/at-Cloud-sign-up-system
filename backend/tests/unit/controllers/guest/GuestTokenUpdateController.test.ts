import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import * as crypto from "crypto";
import GuestTokenUpdateController from "../../../../src/controllers/guest/GuestTokenUpdateController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findOne: vi.fn(),
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
    token?: string;
  };
  body: {
    fullName?: string;
    phone?: string;
    notes?: string;
  };
}

describe("GuestTokenUpdateController", () => {
  let mockReq: MockRequest;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;

  const rawToken = "valid-manage-token";
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const createMockGuest = (overrides = {}) => ({
    _id: "guest123",
    eventId: { toString: () => "event123" },
    roleId: "role1",
    fullName: "Test Guest",
    email: "guest@test.com",
    phone: "1234567890",
    notes: "Some notes",
    status: "confirmed",
    manageToken: hashedToken,
    manageTokenExpires: new Date(Date.now() + 86400000), // 24 hours from now
    save: vi.fn().mockResolvedValue(true),
    toPublicJSON: vi.fn().mockReturnValue({
      id: "guest123",
      fullName: "Test Guest",
      email: "guest@test.com",
      phone: "1234567890",
    }),
    generateManageToken: vi.fn().mockReturnValue("new-manage-token"),
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
      params: { token: rawToken },
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

  describe("updateByToken", () => {
    describe("Token Validation", () => {
      it("should return 404 for invalid token", async () => {
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid or expired link",
        });
      });

      it("should return 404 for empty token", async () => {
        mockReq.params.token = "";
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should hash the token before lookup", async () => {
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findOne).toHaveBeenCalledWith({
          manageToken: hashedToken,
          manageTokenExpires: { $gt: expect.any(Date) },
          status: { $ne: "cancelled" },
        });
      });
    });

    describe("Successful Update", () => {
      it("should update guest registration successfully", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
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
          })
        );
      });

      it("should rotate manage token after update", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.generateManageToken).toHaveBeenCalled();
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              manageToken: "new-manage-token",
            }),
          })
        );
      });

      it("should clear phone when empty string provided", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );
        mockReq.body = { phone: "" };

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.phone).toBeUndefined();
      });

      it("should trim input values", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );
        mockReq.body = {
          fullName: "  Trimmed Name  ",
          notes: "  Trimmed Notes  ",
        };

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(mockGuest.fullName).toBe("Trimmed Name");
        expect(mockGuest.notes).toBe("Trimmed Notes");
      });

      it("should emit socket update after save", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(socketService.emitEventUpdate).toHaveBeenCalledWith(
          "event123",
          "guest_updated",
          expect.objectContaining({
            eventId: "event123",
            roleId: "role1",
            guestName: "Updated Guest",
          })
        );
      });

      it("should succeed even if socket emit fails", async () => {
        const mockGuest = createMockGuest();
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );
        vi.mocked(socketService.emitEventUpdate).mockImplementation(() => {
          throw new Error("Socket error");
        });

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        // Should still succeed
        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it("should succeed even if token rotation fails", async () => {
        const mockGuest = createMockGuest();
        mockGuest.generateManageToken.mockImplementation(() => {
          throw new Error("Token generation failed");
        });
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findOne).mockRejectedValue(
          new Error("Database error")
        );

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
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
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(
          mockGuest as any
        );

        await GuestTokenUpdateController.updateByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to update guest registration",
        });
      });
    });
  });
});
