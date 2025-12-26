import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GuestTokenRetrievalController from "../../../../src/controllers/guest/GuestTokenRetrievalController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
    findOne: vi.fn(),
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

interface MockRequest {
  params: {
    token?: string;
  };
}

describe("GuestTokenRetrievalController", () => {
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
      params: { token: "validManageToken123" },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getGuestByToken", () => {
    describe("Token Not Found", () => {
      it("should return 404 when token is not provided", async () => {
        mockReq.params.token = "";

        await GuestTokenRetrievalController.getGuestByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Invalid or expired link",
        });
      });

      it("should return 404 when token is not found in database", async () => {
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(null);

        await GuestTokenRetrievalController.getGuestByToken(
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

    describe("Successful Retrieval", () => {
      it("should return guest registration when valid token provided", async () => {
        const mockGuest = {
          _id: "guest123",
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          toPublicJSON: vi.fn().mockReturnValue({
            _id: "guest123",
            firstName: "John",
            lastName: "Doe",
            email: "john@test.com",
          }),
        };
        vi.mocked(GuestRegistration.findOne).mockResolvedValue(mockGuest);

        await GuestTokenRetrievalController.getGuestByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findOne).toHaveBeenCalledWith(
          expect.objectContaining({
            manageTokenExpires: expect.any(Object),
            status: { $ne: "cancelled" },
          })
        );
        expect(mockGuest.toPublicJSON).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: {
            guest: {
              _id: "guest123",
              firstName: "John",
              lastName: "Doe",
              email: "john@test.com",
            },
          },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 when database error occurs", async () => {
        vi.mocked(GuestRegistration.findOne).mockRejectedValue(
          new Error("Database error")
        );

        await GuestTokenRetrievalController.getGuestByToken(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Failed to fetch guest registration",
        });
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });
});
