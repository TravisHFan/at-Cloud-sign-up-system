import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import GuestRetrievalController from "../../../../src/controllers/guest/GuestRetrievalController";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  GuestRegistration: {
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

import { GuestRegistration } from "../../../../src/models";

interface MockRequest {
  params: Record<string, string>;
}

describe("GuestRetrievalController", () => {
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
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("getGuestRegistration", () => {
    describe("Not Found", () => {
      it("should return 404 if guest registration not found", async () => {
        vi.mocked(GuestRegistration.findById).mockResolvedValue(null);

        await GuestRetrievalController.getGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(GuestRegistration.findById).toHaveBeenCalledWith("guestreg123");
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          message: "Guest registration not found",
        });
      });
    });

    describe("Successful Retrieval", () => {
      it("should return guest registration with public JSON", async () => {
        const mockPublicJson = {
          id: "guestreg123",
          fullName: "John Guest",
          eventId: "event123",
          roleId: "role456",
          status: "registered",
        };

        const mockGuestRegistration = {
          _id: "guestreg123",
          toPublicJSON: vi.fn().mockReturnValue(mockPublicJson),
        };

        vi.mocked(GuestRegistration.findById).mockResolvedValue(
          mockGuestRegistration
        );

        await GuestRetrievalController.getGuestRegistration(
          mockReq as unknown as Request,
          mockRes as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockGuestRegistration.toPublicJSON).toHaveBeenCalled();
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: { guest: mockPublicJson },
        });
      });
    });

    describe("Error Handling", () => {
      it("should return 500 on database error", async () => {
        vi.mocked(GuestRegistration.findById).mockRejectedValue(
          new Error("Database error")
        );

        await GuestRetrievalController.getGuestRegistration(
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
